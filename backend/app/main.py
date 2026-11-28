"""The app server. It holds the keys; the browser never sees them. It starts with no keys at all.

/ws/stt              relays microphone audio to Sarvam realtime speech-to-text
/api/tts             speaks a reply with Sarvam text-to-speech
/api/cloud           surroundings and general questions through OpenRouter free models
/api/vision/fallback strip detection on Roboflow, only when a model id is configured
"""
import asyncio
import base64
import io
import logging
import os
import re
import time
import wave
from collections import deque
from typing import Literal
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
MAX_AUDIO_CHARS = 64_000  # one base64 audio frame
MAX_IMAGE_CHARS = 4_000_000
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODELS = ["google/gemma-4-31b-it:free", "nvidia/nemotron-3.5-super-vl:free", "openrouter/free"]
LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "te": "Telugu", "kn": "Kannada"}
CALLS_PER_MINUTE = 30
cloud_calls: deque = deque()
TTS_CALLS_PER_MINUTE = 90
tts_calls: deque = deque()
# Same rule as the browser: medicine and dosage questions never go to the cloud.
MEDICAL = re.compile(r"\b(dos(e|age)|tablets?|capsules?|pills?|medicines?|medication|drug|\d+\s*mg|expir\w*|paracetamol)\b|गोली|दवा|खुराक|మాత్ర|మందు|ಮಾತ್ರೆ|ಔಷಧ", re.I)


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, "").strip() or default


def roboflow_ready() -> bool:
    return bool(env("ROBOFLOW_PRIVATE_API_KEY") and env("ROBOFLOW_MODEL_ID"))


@app.get("/api/status")
def status():
    return {"voice": bool(env("SARVAM_API_KEY")), "cloud": bool(env("OPENROUTER_API_KEY")), "visionFallback": roboflow_ready()}


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


# ---------- strip detection fallback ----------
class ImageRequest(BaseModel):
    imageJpeg: str = Field(min_length=1, max_length=MAX_IMAGE_CHARS)


def to_strip_result(predictions: list, minimum: float = 0.5) -> dict:
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


def infer_strip(image: str) -> dict:
    from inference_sdk import InferenceHTTPClient  # imported on first use: it is large

    client = InferenceHTTPClient(api_url=env("ROBOFLOW_API_URL", "https://serverless.roboflow.com"),
                                 api_key=env("ROBOFLOW_PRIVATE_API_KEY"))
    return client.infer(image, model_id=env("ROBOFLOW_MODEL_ID"))


@app.post("/api/vision/fallback")
async def vision_fallback(request: ImageRequest):
    if not env("ROBOFLOW_PRIVATE_API_KEY"):
        return {"error": "key_not_set"}
    if not env("ROBOFLOW_MODEL_ID"):
        return {"error": "not_configured"}
    if too_many_calls():
        return {"error": "rate_limited"}
    try:
        reply = await run_in_threadpool(infer_strip, request.imageJpeg)
        return to_strip_result(reply.get("predictions", []))
    except Exception as error:  # the app must keep running whatever the service does
        log.warning("strip detection failed: %s", type(error).__name__)
        return {"error": "unavailable"}


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


async def to_browser(socket: WebSocket, upstream) -> None:
    async for message in upstream:
        if isinstance(message, bytes):
            continue
        data = message if isinstance(message, dict) else message.dict()
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
            tasks = [asyncio.create_task(from_browser(socket, upstream)), asyncio.create_task(to_browser(socket, upstream))]
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
