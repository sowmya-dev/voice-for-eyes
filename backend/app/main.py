"""The app server. It holds the keys; the browser never sees them. It starts with no keys at all.

/ws/stt              relays microphone audio to Sarvam realtime speech-to-text
/api/tts             speaks a reply with Sarvam text-to-speech
/api/cloud           surroundings and general questions through OpenRouter free models
/api/vision/fallback strip detection on Roboflow: a trained model when its id is configured, or SAM 3 when chosen
"""
import asyncio
import base64
import io
import logging
import math
import os
import re
import time
import wave
from collections import deque
from typing import Awaitable, Callable, Literal, NamedTuple
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Logs never include audio, images, transcripts, questions or keys.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("voai")

app = FastAPI(title="Voice for Eyes", docs_url=None, redoc_url=None, openapi_url=None)

STT_LANGUAGES = {"auto", "en-IN", "hi-IN", "te-IN", "kn-IN"}
BASE_LANGUAGES = STT_LANGUAGES - {"auto"}  # languages the app has replies for
LID_TIMEOUT_S = 2.0  # language identification and transliteration together, before giving up
MAX_AUDIO_CHARS = 64_000  # one base64 audio frame
MAX_IMAGE_CHARS = 4_000_000
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODELS = ["google/gemma-4-31b-it:free", "nvidia/nemotron-3.5-super-vl:free", "openrouter/free"]
LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "te": "Telugu", "kn": "Kannada"}
CALLS_PER_MINUTE = 30
cloud_calls: deque = deque()
TTS_CALLS_PER_MINUTE = 90
tts_calls: deque = deque()
OCR_CALLS_PER_MINUTE = 20  # each call reads up to 2 frames (2 Cloud Vision units)
ocr_calls: deque = deque()
VISION_TIMEOUT_S = 10
VISION_URL = "https://vision.googleapis.com/v1/images:annotate"
# Same rule as the browser: medicine and dosage questions never go to the cloud.
MEDICAL = re.compile(r"\b(dos(e|age)|tablets?|capsules?|pills?|medicines?|medication|drug|\d+\s*mg|expir\w*|paracetamol)\b|गोली|दवा|खुराक|మాత్ర|మందు|ಮಾತ್ರೆ|ಔಷಧ", re.I)


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, "").strip() or default


def roboflow_problem() -> str | None:
    if not env("ROBOFLOW_PRIVATE_API_KEY"):
        return "key_not_set"
    return None if env("ROBOFLOW_MODEL_ID") else "not_configured"


# ---------- swappable vision engines ----------
class Engine(NamedTuple):
    """One adapter: why it cannot run now (None when it can), and the call itself."""
    problem: Callable[[], str | None]
    run: Callable[..., Awaitable]


warned: set = set()


def pick(setting: str, registry: dict, off: str, default: str) -> str:
    """The engine named in a setting, or the default when the name is unknown (logged once)."""
    name = env(setting).lower() or default
    if name != off and name not in registry:
        if (setting, name) not in warned:
            warned.add((setting, name))
            log.warning("%s=%s is not one of %s; using %s", setting, name, sorted([*registry, off]), default)
        name = default
    return name


def text_reader() -> str:
    """TEXT_READER: google (Cloud Vision on the server) or device (PaddleOCR in the browser), as actually usable."""
    name = pick("TEXT_READER", TEXT_READERS, "device", "google" if env("GOOGLE_CLOUD_VISION_API_KEY") else "device")
    return name if name == "device" or TEXT_READERS[name].problem() is None else "device"


def pocket_detector() -> str:
    """POCKET_DETECTOR: roboflow (YOLO models in ROBOFLOW_MODEL_ID) or none."""
    return pick("POCKET_DETECTOR", POCKET_DETECTORS, "none", "roboflow")


@app.get("/api/status")
def status():
    detector = pocket_detector()
    return {"voice": bool(env("SARVAM_API_KEY")), "cloud": bool(env("OPENROUTER_API_KEY")),
            "visionFallback": detector != "none" and POCKET_DETECTORS[detector].problem() is None, "textReader": text_reader()}


@app.get("/api/cloud/status")
def cloud_status():
    return {"keyConfigured": bool(env("OPENROUTER_API_KEY"))}


def too_many_calls(calls: deque = cloud_calls, limit: int = CALLS_PER_MINUTE) -> bool:
    now = time.monotonic()
    while calls and now - calls[0] > 60:
        calls.popleft()
    if len(calls) >= limit:
        return True
    calls.append(now)
    return False


def from_this_site(headers) -> bool:
    """True when the browser says the request came from this app, so another website cannot spend the keys."""
    origin = headers.get("origin")
    return bool(origin) and urlsplit(origin).netloc == headers.get("host")


@app.middleware("http")
async def refuse_other_websites(request, call_next):
    # Browsers send an Origin header with cross-site POSTs; tools without one are not browsers.
    if request.method == "POST" and request.headers.get("origin") and not from_this_site(request.headers):
        return JSONResponse({"error": "forbidden"}, status_code=403)
    return await call_next(request)


# ---------- spoken replies ----------
class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    lang: Literal["en", "hi", "te", "kn"]
    pace: float = Field(default=1.0, ge=0.5, le=2.0)


async def ask_sarvam_tts(key: str, text: str, language_code: str, pace: float) -> list[str]:
    from sarvamai import AsyncSarvamAI

    reply = await AsyncSarvamAI(api_subscription_key=key).text_to_speech.convert(
        # These settings passed a round-trip check of tablet strengths; bulbul:v4-flash did not.
        text=text, language_code=language_code, model="bulbul:v3", speaker="shubh", enable_preprocessing=True, pace=pace,
        speech_sample_rate=24000, request_options={"timeout_in_seconds": 8, "max_retries": 0})
    return list(reply.audios)


def join_wav(parts: list[str]) -> str:
    """Sarvam may return a long reply in several WAV parts. They are joined into one."""
    if len(parts) == 1:
        return parts[0]
    out = io.BytesIO()
    with wave.open(out, "wb") as joined:
        for index, part in enumerate(parts):
            with wave.open(io.BytesIO(base64.b64decode(part))) as piece:
                if index == 0:
                    joined.setparams(piece.getparams())
                joined.writeframes(piece.readframes(piece.getnframes()))
    return base64.b64encode(out.getvalue()).decode()


@app.post("/api/tts")
async def speak(request: TtsRequest):
    # The reply text can name a medicine and its printed dosage. It is never logged.
    key = env("SARVAM_API_KEY")
    if not key:
        return {"error": "key_not_set"}
    if too_many_calls(tts_calls, TTS_CALLS_PER_MINUTE):
        return {"error": "rate_limited"}
    try:
        parts = await ask_sarvam_tts(key, request.text, f"{request.lang}-IN", request.pace)
        return {"audio": join_wav(parts)}
    except Exception as error:  # the browser falls back to a voice on the device
        log.warning("speech synthesis failed: %s", type(error).__name__)
        return {"error": "rate_limited" if getattr(error, "status_code", None) == 429 else "unavailable"}


# ---------- cloud help ----------
class Turn(BaseModel):
    question: str = Field(max_length=500)
    answer: str = Field(max_length=2000)


class CloudRequest(BaseModel):
    task: Literal["general", "scene"]
    lang: Literal["en", "hi", "te", "kn"]
    text: str = Field(min_length=1, max_length=500)
    imageJpeg: str | None = Field(default=None, max_length=MAX_IMAGE_CHARS)
    history: list[Turn] = Field(default_factory=list, max_length=4)


async def ask_openrouter(key: str, model: str, messages: list) -> tuple[int, str | None]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(OPENROUTER_URL, headers={"Authorization": f"Bearer {key}"},
                                     json={"model": model, "messages": messages, "max_tokens": 600})
    if response.status_code != 200:
        return response.status_code, None
    choices = response.json().get("choices") or [{}]
    return 200, (choices[0].get("message") or {}).get("content")


def build_messages(request: CloudRequest) -> list:
    system = ("You help a blind person. Answer in at most two short plain sentences, in "
              f"{LANGUAGE_NAMES[request.lang]}. For surroundings, describe only what is visible and where it is. "
              "Never give any information or advice about medicines, doses or whether something is safe to take.")
    messages = [{"role": "system", "content": system}]
    for turn in request.history:
        messages += [{"role": "user", "content": turn.question}, {"role": "assistant", "content": turn.answer}]
    content = request.text
    if request.task == "scene" and request.imageJpeg:
        content = [{"type": "text", "text": request.text},
                   {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{request.imageJpeg}"}}]
    return messages + [{"role": "user", "content": content}]


@app.post("/api/cloud")
async def cloud(request: CloudRequest):
    key = env("OPENROUTER_API_KEY")
    if not key:
        return {"error": "key_not_set"}
    if MEDICAL.search(request.text):
        return {"error": "blocked"}
    if too_many_calls():
        return {"error": "rate_limited"}
    models = [m.strip() for m in env("OPENROUTER_MODELS").split(",") if m.strip()] or DEFAULT_MODELS
    limited = False
    for model in models:
        try:
            code, text = await ask_openrouter(key, model, build_messages(request))
        except httpx.HTTPError as error:
            log.warning("cloud %s failed: %s", model, type(error).__name__)
            continue
        if code == 200 and text and text.strip():
            return {"text": text.strip(), "model": model}
        limited = limited or code == 429
        log.warning("cloud %s returned %s", model, code)
    return {"error": "rate_limited" if limited else "unavailable"}


# ---------- label text: Google Cloud Vision ----------
class OcrRequest(BaseModel):
    images: list[str] = Field(min_length=1, max_length=2)


async def ask_vision(key: str, images: list[str]) -> list[dict]:
    """Document text detection on each image. The key goes in a header, never in a URL."""
    body = {"requests": [{"image": {"content": image}, "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                          "imageContext": {"languageHints": ["en"]}} for image in images]}
    async with httpx.AsyncClient(timeout=VISION_TIMEOUT_S) as client:
        reply = await client.post(VISION_URL, json=body, headers={"X-Goog-Api-Key": key})
    reply.raise_for_status()
    return reply.json().get("responses", [])


def vision_lines(response: dict) -> dict:
    """Cloud Vision symbols joined into lines at its line breaks. Each line keeps an axis-aligned box in image
    pixels (for guidance) and its real letter height, which stays right for text running up the strip."""
    page = ((response.get("fullTextAnnotation") or {}).get("pages") or [{}])[0]
    lines, text, words = [], "", []

    def point(v):
        return (v.get("x", 0), v.get("y", 0))  # Cloud Vision leaves out zero values

    def close():
        nonlocal text, words
        if text.strip() and words:
            corners = [point(v) for w in words for v in w["boundingBox"]["vertices"]]
            xs, ys = [c[0] for c in corners], [c[1] for c in corners]
            heights = sorted(math.dist(point(w["boundingBox"]["vertices"][0]), point(w["boundingBox"]["vertices"][3])) for w in words)
            lines.append({"text": text.strip(), "score": sum(w.get("confidence", 0) for w in words) / len(words),
                          "box": {"x": min(xs), "y": min(ys), "w": max(xs) - min(xs), "h": max(ys) - min(ys)},
                          "size": heights[len(heights) // 2]})
        text, words = "", []

    for block in page.get("blocks", []):
        for paragraph in block.get("paragraphs", []):
            for word in paragraph.get("words", []):
                words.append(word)
                for symbol in word.get("symbols", []):
                    text += symbol.get("text", "")
                    kind = ((symbol.get("property") or {}).get("detectedBreak") or {}).get("type")
                    if kind in ("SPACE", "SURE_SPACE"):
                        text += " "
                    elif kind in ("EOL_SURE_SPACE", "LINE_BREAK", "HYPHEN"):
                        close()
            close()
    return {"width": page.get("width", 0), "height": page.get("height", 0), "lines": lines}


async def read_with_google(images: list[str]) -> list[dict] | None:
    """Text reader adapter: base64 JPEGs in, one page of lines per image out, or None."""
    responses = await ask_vision(env("GOOGLE_CLOUD_VISION_API_KEY"), images)
    if len(responses) != len(images) or any(r.get("error") for r in responses):
        return None
    return [vision_lines(r) for r in responses]


@app.post("/api/ocr")
async def read_text(request: OcrRequest):
    name = pick("TEXT_READER", TEXT_READERS, "device", "google" if env("GOOGLE_CLOUD_VISION_API_KEY") else "device")
    if name == "device":
        return {"error": "off"}  # the browser reads the label itself
    if problem := TEXT_READERS[name].problem():
        return {"error": problem}
    if any(len(image) > MAX_IMAGE_CHARS for image in request.images):
        return JSONResponse({"error": "too_large"}, status_code=413)
    if too_many_calls(ocr_calls, OCR_CALLS_PER_MINUTE):
        return {"error": "rate_limited"}
    try:
        pages = await TEXT_READERS[name].run(request.images)
    except Exception as error:  # the browser reads the label on the device instead
        log.warning("cloud text reading failed: %s", type(error).__name__)
        return {"error": "unavailable"}
    return {"pages": pages} if pages else {"error": "unavailable"}


# ---------- strip detection fallback ----------
class ImageRequest(BaseModel):
    imageJpeg: str = Field(min_length=1, max_length=MAX_IMAGE_CHARS)


def to_strip_result(predictions: list, minimum: float = 0.7) -> dict:
    """Roboflow boxes are centre based. Only the agreed class names count; anything else is ignored."""
    result: dict = {"strip": None, "full": [], "empty": []}
    for p in sorted(predictions, key=lambda p: -p.get("confidence", 0)):
        if p.get("confidence", 0) < minimum:
            continue
        box = {"x": p["x"] - p["width"] / 2, "y": p["y"] - p["height"] / 2, "w": p["width"], "h": p["height"]}
        if p["class"] == "medicine_strip" and result["strip"] is None:
            result["strip"] = box
        elif p["class"] in ("full_cavity", "empty_cavity"):
            result["full" if p["class"] == "full_cavity" else "empty"].append(box)
    return result


def infer_strip(image: str, model_id: str) -> dict:
    from inference_sdk import InferenceHTTPClient  # imported on first use: it is large

    client = InferenceHTTPClient(api_url=env("ROBOFLOW_API_URL", "https://serverless.roboflow.com"),
                                 api_key=env("ROBOFLOW_PRIVATE_API_KEY"))
    return client.infer(image, model_id=model_id)


def class_renames() -> dict:
    """ROBOFLOW_CLASS_MAP="theirs=ours,..." lets a model with other class names be used."""
    pairs = (p.split("=", 1) for p in env("ROBOFLOW_CLASS_MAP").split(",") if "=" in p)
    return {theirs.strip(): ours.strip() for theirs, ours in pairs}


async def detect_strip(image: str) -> dict:
    """Models in ROBOFLOW_MODEL_ID are tried in order; the first that finds full or empty pockets wins."""
    renames = class_renames()
    result: dict = {"error": "unavailable"}
    for model_id in [m.strip() for m in env("ROBOFLOW_MODEL_ID").split(",") if m.strip()]:
        try:
            reply = await run_in_threadpool(infer_strip, image, model_id)
        except Exception as error:  # one model failing must not stop the next
            log.warning("strip detection failed for one model: %s", type(error).__name__)
            continue
        predictions = [{**p, "class": renames.get(p.get("class"), p.get("class"))} for p in reply.get("predictions", [])]
        result = to_strip_result(predictions)
        if result["full"] or result["empty"]:  # a model with only empty cells still helps (printed total - used)
            break
    return result


# ---------- pills found by name: SAM 3 on Roboflow ----------
SAM3_WORDS = ("pill", "blister pack")
# Measured on 12 hand-counted photos: used pockets and false marks scored at most 0.68, real pills at least 0.76.
SAM3_BAR = 0.7


def sam3_segment(image: str) -> dict:
    from inference_sdk import InferenceHTTPClient  # imported on first use: it is large

    client = InferenceHTTPClient(api_url=env("ROBOFLOW_API_URL", "https://serverless.roboflow.com"),
                                 api_key=env("ROBOFLOW_PRIVATE_API_KEY"))
    return client.sam3_concept_segment(image, prompts=[{"type": "text", "text": word} for word in SAM3_WORDS])


def polygons_of(prediction: dict) -> list:
    """The outline of one SAM 3 prediction: one or more polygons, each a list of [x, y]."""
    return [polygon for polygon in prediction.get("masks") or [] if len(polygon) >= 3]


def inside(point: tuple, polygon: list) -> bool:
    """Ray casting: is the point inside the polygon itself, not just its bounding box?"""
    x, y = point
    hit = False
    for (x1, y1), (x2, y2) in zip(polygon, polygon[1:] + polygon[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def box_of(polygons: list) -> dict:
    xs = [point[0] for polygon in polygons for point in polygon]
    ys = [point[1] for polygon in polygons for point in polygon]
    return {"x": min(xs), "y": min(ys), "w": max(xs) - min(xs), "h": max(ys) - min(ys)}


def sam3_result(reply: dict) -> dict:
    """SAM 3's outlines as the result every pocket detector gives, plus how many strips it outlined.
    A pill counts only inside the one strip outline and at SAM3_BAR or more, so loose pills, pills printed
    on a box and used pockets are left out. With no strip outline, or more than one, nothing is counted."""
    found: dict = {}
    for position, result in enumerate(reply.get("prompt_results") or []):
        index = result.get("prompt_index", position)
        word = (result.get("echo") or {}).get("text") or (SAM3_WORDS[index] if 0 <= index < len(SAM3_WORDS) else None)
        found[word] = result.get("predictions") or []
    strips = [polygons_of(strip) for strip in found.get("blister pack", []) if polygons_of(strip)]
    if len(strips) != 1:
        return {"strip": None, "full": [], "empty": [], "strips": len(strips)}
    full = []
    for pill in found.get("pill", []):
        shape = polygons_of(pill)
        if not shape or pill.get("confidence", 0) < SAM3_BAR:
            continue
        box = box_of(shape)
        centre = (box["x"] + box["w"] / 2, box["y"] + box["h"] / 2)
        if any(inside(centre, polygon) for polygon in strips[0]):
            full.append(box)
    return {"strip": box_of(strips[0]), "full": full, "empty": [], "strips": 1}


async def detect_with_sam3(image: str) -> dict:
    """Pocket detector adapter: a base64 JPEG in, the common result out. Works on any strip, with no trained model."""
    return sam3_result(await run_in_threadpool(sam3_segment, image))


@app.post("/api/vision/fallback")
async def vision_fallback(request: ImageRequest):
    name = pocket_detector()
    if name == "none":
        return {"error": "off"}
    if problem := POCKET_DETECTORS[name].problem():
        return {"error": problem}
    if too_many_calls():
        return {"error": "rate_limited"}
    try:
        return await POCKET_DETECTORS[name].run(request.imageJpeg)
    except Exception as error:  # the app must keep running whatever the service does
        log.warning("strip detection failed: %s", type(error).__name__)
        return {"error": "unavailable"}


# The engines each job can use. A new engine is one more adapter here, chosen with its setting.
TEXT_READERS = {"google": Engine(lambda: None if env("GOOGLE_CLOUD_VISION_API_KEY") else "key_not_set", read_with_google)}
POCKET_DETECTORS = {
    "roboflow": Engine(roboflow_problem, detect_strip),
    # Chosen with POCKET_DETECTOR=sam3, never the default: alone it was wrong on 1 of 10 strips (see test_sam3.py).
    "sam3": Engine(lambda: None if env("ROBOFLOW_PRIVATE_API_KEY") else "key_not_set", detect_with_sam3),
}


# ---------- speech relay ----------
def connect_sarvam(key: str, **options):
    from sarvamai import AsyncSarvamAI

    return AsyncSarvamAI(api_subscription_key=key).speech_to_text_realtime_streaming.connect(**options)


async def fatal(socket: WebSocket, code: str, message: str) -> None:
    await socket.send_json({"event": "error", "code": code, "is_fatal": True, "message": message})
    await socket.close()


async def from_browser(socket: WebSocket, upstream) -> None:
    from sarvamai import RealtimeAudioInput, RealtimeEnd

    while True:
        message = await socket.receive_json()
        if message.get("event") == "audio_input":
            audio = message.get("audio")
            if isinstance(audio, str) and 0 < len(audio) <= MAX_AUDIO_CHARS:
                await upstream.send_realtime_audio_input(RealtimeAudioInput(audio=audio))
        elif message.get("event") == "end":
            await upstream.send_realtime_end(RealtimeEnd())
            return


async def identify_base_language(key: str, text: str) -> dict:
    """Automatic recognition writes Telugu, Hindi and Kannada speech in English letters and labels it en-IN,
    so the base language is identified from the words, and English letters are turned into that language's script."""
    from sarvamai import AsyncSarvamAI

    text_api = AsyncSarvamAI(api_subscription_key=key).text
    found = await text_api.identify_language(input=text)
    if found.language_code not in BASE_LANGUAGES:
        return {}  # no reply text in the app for it: the session language stays
    if found.language_code != "en-IN" and found.script_code == "Latn":
        text = (await text_api.transliterate(input=text, source_language_code="en-IN",
                                             target_language_code=found.language_code)).transliterated_text
    return {"base_language": found.language_code, "text": text}


async def to_browser(socket: WebSocket, upstream, identify=None) -> None:
    async for message in upstream:
        if isinstance(message, bytes):
            continue
        data = message if isinstance(message, dict) else message.dict()
        if identify and data.get("event") == "transcript.final" and str(data.get("text", "")).strip():
            try:
                data = {**data, **await asyncio.wait_for(identify(data["text"]), LID_TIMEOUT_S)}
            except Exception as error:  # too slow or failed: the transcript goes on as it came
                log.warning("language identification failed: %s", type(error).__name__)
        await socket.send_json(data)


@app.websocket("/ws/stt")
async def speech(socket: WebSocket, language_code: str = "auto"):
    if not from_this_site(socket.headers) or language_code not in STT_LANGUAGES:
        await socket.close(code=1008)
        return
    await socket.accept()
    key = env("SARVAM_API_KEY")
    if not key:
        await fatal(socket, "key_not_set", "The speech key is not set.")
        return
    options = {"language_code": language_code, "model": "saaras:v4", "mode": "codemix", "stream_type": "balanced",
               "endpointing": "vad", "encoding": "linear16", "sample_rate": "16000",
               "threshold": env("STT_THRESHOLD", "0.5"), "silence_duration_ms": env("STT_SILENCE_MS", "800")}
    try:
        async with connect_sarvam(key, **options) as upstream:
            log.info("speech stream open")
            # Only automatic recognition needs the base language worked out from the words.
            identify = (lambda text: identify_base_language(key, text)) if language_code == "auto" else None
            tasks = [asyncio.create_task(from_browser(socket, upstream)), asyncio.create_task(to_browser(socket, upstream, identify))]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            # After a browser "end", give Sarvam a moment to send the last transcript.
            if tasks[0] in done and tasks[0].exception() is None and pending:
                done_late, pending = await asyncio.wait(pending, timeout=3)
                done |= done_late
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                task.result()
        await socket.close()
    except WebSocketDisconnect:
        pass
    except Exception as error:
        refused = "invalid_subscription_key" if getattr(error, "status_code", None) in (401, 403) else "unavailable"
        log.warning("speech stream failed: %s", type(error).__name__)
        try:
            await fatal(socket, refused, "Voice input is unavailable.")
        except (RuntimeError, WebSocketDisconnect):
            pass  # the browser has already gone
    finally:
        log.info("speech stream closed")
