import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app import main

client = TestClient(main.app)
KEYS = ["SARVAM_API_KEY", "OPENROUTER_API_KEY", "ROBOFLOW_PRIVATE_API_KEY", "ROBOFLOW_MODEL_ID", "ROBOFLOW_CLASS_MAP",
        "GOOGLE_CLOUD_VISION_API_KEY"]
ORIGIN = {"origin": "http://testserver"}


@pytest.fixture(autouse=True)
def no_keys(monkeypatch):
    for name in KEYS:
        monkeypatch.delenv(name, raising=False)
    main.cloud_calls.clear()
    main.ocr_calls.clear()


def test_starts_without_keys_and_says_what_is_missing():
    assert client.get("/api/status").json() == {"voice": False, "cloud": False, "visionFallback": False, "cloudOcr": False}
    assert client.post("/api/ocr", json={"images": ["aGk="]}).json() == {"error": "key_not_set"}
    assert client.get("/api/cloud/status").json() == {"keyConfigured": False}
    assert client.post("/api/cloud", json={"task": "general", "lang": "en", "text": "who is Gandhi"}).json() == {"error": "key_not_set"}
    assert client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json() == {"error": "key_not_set"}


def test_keys_never_appear_in_responses(monkeypatch):
    for name in KEYS:
        monkeypatch.setenv(name, f"secret-{name}")
    body = client.get("/api/status").text + client.get("/api/cloud/status").text
    assert "secret" not in body
    assert client.get("/api/status").json() == {"voice": True, "cloud": True, "visionFallback": True, "cloudOcr": True}


def test_fallback_needs_a_model_id_so_no_photo_leaves_by_default(monkeypatch):
    monkeypatch.setenv("ROBOFLOW_PRIVATE_API_KEY", "k")
    assert client.get("/api/status").json()["visionFallback"] is False
    assert client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json() == {"error": "not_configured"}


def test_roboflow_predictions_become_boxes():
    found = main.to_strip_result([
        {"class": "medicine_strip", "x": 100, "y": 80, "width": 60, "height": 40, "confidence": 0.9},
        {"class": "full_cavity", "x": 90, "y": 80, "width": 10, "height": 10, "confidence": 0.8},
        {"class": "empty_cavity", "x": 110, "y": 80, "width": 10, "height": 10, "confidence": 0.8},
        {"class": "full_cavity", "x": 1, "y": 1, "width": 1, "height": 1, "confidence": 0.1},
        {"class": "crack_pill", "x": 1, "y": 1, "width": 1, "height": 1, "confidence": 0.9},
    ])
    assert found["strip"] == {"x": 70, "y": 60, "w": 60, "h": 40}
    assert (len(found["full"]), len(found["empty"])) == (1, 1)


def box(name, x=100):
    return {"class": name, "x": x, "y": 80, "width": 10, "height": 10, "confidence": 0.9}


STRIP = {"class": "medicine_strip", "x": 100, "y": 80, "width": 60, "height": 40, "confidence": 0.9}


def models(monkeypatch, replies: dict, ids: str, class_map: str = ""):
    """Fake strip models: each id answers with its predictions, or raises when given an exception."""
    monkeypatch.setenv("ROBOFLOW_PRIVATE_API_KEY", "k")
    monkeypatch.setenv("ROBOFLOW_MODEL_ID", ids)
    monkeypatch.setenv("ROBOFLOW_CLASS_MAP", class_map)
    asked = []

    def infer(image, model_id):
        asked.append(model_id)
        reply = replies[model_id]
        if isinstance(reply, Exception):
            raise reply
        return {"predictions": reply}

    monkeypatch.setattr(main, "infer_strip", infer)
    return asked


def test_first_model_finds_nothing_so_the_second_is_used(monkeypatch):
    asked = models(monkeypatch, {"a/1": [], "b/2": [STRIP, box("full_cavity")]}, "a/1, b/2")
    found = client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json()
    assert asked == ["a/1", "b/2"]
    assert found["strip"] and len(found["full"]) == 1


def test_a_failing_model_does_not_stop_the_next(monkeypatch):
    models(monkeypatch, {"a/1": RuntimeError("down"), "b/2": [STRIP, box("full_cavity")]}, "a/1,b/2")
    assert len(client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json()["full"]) == 1


def test_class_names_are_mapped_to_ours(monkeypatch):
    theirs = [{**STRIP, "class": "strip"}, box("pill"), box("pill", 120), box("missing", 140)]
    models(monkeypatch, {"x/2": theirs}, "x/2", "strip=medicine_strip, pill=full_cavity, missing=empty_cavity")
    found = client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json()
    assert found["strip"] and (len(found["full"]), len(found["empty"])) == (2, 1)


def test_a_model_that_sees_only_used_cells_is_accepted(monkeypatch):
    # blister-strips-defect-detection/2: "missing" is an empty cell; it has no strip or full-pocket class.
    theirs = [{**box("missing"), "confidence": 0.9}, {**box("missing", 140), "confidence": 0.75},
              {**box("missing", 180), "confidence": 0.6}, box("cracked")]
    asked = models(monkeypatch, {"a/2": theirs, "b/1": [STRIP, box("full_cavity")]}, "a/2,b/1", "missing=empty_cavity")
    found = client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json()
    assert asked == ["a/2"], "empty pockets alone are enough"
    assert (found["strip"], len(found["full"]), len(found["empty"])) == (None, 0, 2), "below 0.7 is ignored"


def test_no_model_finds_a_strip(monkeypatch):
    models(monkeypatch, {"a/1": [box("cracked")], "b/2": []}, "a/1,b/2")
    assert client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json() == {"strip": None, "full": [], "empty": []}
    models(monkeypatch, {"a/1": RuntimeError("down")}, "a/1")
    assert client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json() == {"error": "unavailable"}


def test_cloud_takes_only_surroundings_and_general_questions(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    for task in ["dose", "safety", "identify", "stt"]:
        assert client.post("/api/cloud", json={"task": task, "lang": "en", "text": "x"}).status_code == 422
    blocked = client.post("/api/cloud", json={"task": "general", "lang": "en", "text": "how many tablets should I take"})
    assert blocked.json() == {"error": "blocked"}


def test_cloud_tries_the_next_free_model(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    asked = []

    async def fake(key, model, messages):
        asked.append((model, messages))
        return (429, None) if len(asked) == 1 else (200, " A table with a cup. ")

    monkeypatch.setattr(main, "ask_openrouter", fake)
    reply = client.post("/api/cloud", json={"task": "scene", "lang": "hi", "text": "what is around me", "imageJpeg": "aGk=",
                                            "history": [{"question": "q", "answer": "a"}]}).json()
    assert reply == {"text": "A table with a cup.", "model": main.DEFAULT_MODELS[1]}
    content = asked[1][1][-1]["content"]
    assert content[1]["image_url"]["url"] == "data:image/jpeg;base64,aGk="
    assert "Hindi" in asked[1][1][0]["content"]


def test_cloud_reports_rate_limit(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")

    async def limited(*_):
        return 429, None

    monkeypatch.setattr(main, "ask_openrouter", limited)
    assert client.post("/api/cloud", json={"task": "general", "lang": "en", "text": "who is Gandhi"}).json() == {"error": "rate_limited"}


def test_speech_without_a_key_says_so():
    with client.websocket_connect("/ws/stt?language_code=auto", headers=ORIGIN) as socket:
        message = socket.receive_json()
    assert (message["event"], message["code"], message["is_fatal"]) == ("error", "key_not_set", True)


def test_speech_refuses_other_websites_and_unknown_languages(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "k")
    for path, headers in [("/ws/stt?language_code=auto", {"origin": "https://evil.example"}), ("/ws/stt?language_code=xx-XX", ORIGIN)]:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(path, headers=headers) as socket:
                socket.receive_json()


class FakeSarvam:
    """Stands in for the sarvamai realtime socket."""

    def __init__(self):
        self.sent = []
        self.options = None
        self.heard = asyncio.Event()

    async def send_realtime_audio_input(self, message):
        self.sent.append(message.audio)
        self.heard.set()

    async def send_realtime_end(self, message):
        self.sent.append("end")

    async def __aiter__(self):
        yield {"event": "session.begin", "request_id": "r1"}
        await self.heard.wait()
        yield {"event": "transcript.final", "utterance_idx": 0, "text": "what is this tablet", "language": "en-IN", "language_confidence": 0.9}


def test_speech_relay_passes_audio_and_transcripts_with_the_contract_settings(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "k")
    fake = FakeSarvam()

    class Connection:
        async def __aenter__(self):
            return fake

        async def __aexit__(self, *_):
            return False

    def connect(key, **options):
        fake.options = options
        return Connection()

    monkeypatch.setattr(main, "connect_sarvam", connect)
    with client.websocket_connect("/ws/stt?language_code=auto", headers=ORIGIN) as socket:
        assert socket.receive_json()["event"] == "session.begin"
        socket.send_text(json.dumps({"event": "audio_input", "audio": "AAAA"}))
        assert socket.receive_json()["text"] == "what is this tablet"
    assert fake.sent[0] == "AAAA"
    assert fake.options == {"language_code": "auto", "model": "saaras:v4", "mode": "codemix", "stream_type": "balanced",
                            "endpointing": "vad", "encoding": "linear16", "sample_rate": "16000", "threshold": "0.5",
                            "silence_duration_ms": "800"}


def relay_one(monkeypatch, language_code, text, identify):
    """Streams one utterance through /ws/stt and returns the transcript the browser gets."""
    monkeypatch.setenv("SARVAM_API_KEY", "k")

    class Speaking(FakeSarvam):
        async def __aiter__(self):
            yield {"event": "session.begin", "request_id": "r1"}
            await self.heard.wait()
            yield {"event": "transcript.final", "utterance_idx": 0, "text": text, "language": "en-IN"}

    fake = Speaking()

    class Connection:
        async def __aenter__(self):
            return fake

        async def __aexit__(self, *_):
            return False

    monkeypatch.setattr(main, "connect_sarvam", lambda key, **options: Connection())
    monkeypatch.setattr(main, "identify_base_language", identify)
    with client.websocket_connect(f"/ws/stt?language_code={language_code}", headers=ORIGIN) as socket:
        socket.receive_json()
        socket.send_text(json.dumps({"event": "audio_input", "audio": "AAAA"}))
        return socket.receive_json()


def test_romanised_telugu_is_identified_and_written_in_telugu(monkeypatch):
    async def identify(key, text):
        assert text == "Ee maatra enti?"
        return {"base_language": "te-IN", "text": "ఈ మాత్రం ఏంటి?"}

    final = relay_one(monkeypatch, "auto", "Ee maatra enti?", identify)
    assert (final["text"], final["base_language"]) == ("ఈ మాత్రం ఏంటి?", "te-IN")


def test_identification_failure_or_delay_keeps_the_transcript(monkeypatch):
    async def fails(key, text):
        raise RuntimeError("down")

    async def slow(key, text):
        await asyncio.sleep(5)

    monkeypatch.setattr(main, "LID_TIMEOUT_S", 0.1)
    for identify in (fails, slow):
        final = relay_one(monkeypatch, "auto", "Ee maatra enti?", identify)
        assert final["text"] == "Ee maatra enti?" and "base_language" not in final


def test_a_stream_set_to_a_language_is_not_identified_again(monkeypatch):
    async def never(key, text):
        raise AssertionError("must not be called")

    assert relay_one(monkeypatch, "te-IN", "ఈ మాత్ర ఏమిటి", never)["text"] == "ఈ మాత్ర ఏమిటి"


def test_speech_reports_a_refused_stream(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "k")

    def refuse(key, **options):
        raise ConnectionError("no")

    monkeypatch.setattr(main, "connect_sarvam", refuse)
    with client.websocket_connect("/ws/stt?language_code=hi-IN", headers=ORIGIN) as socket:
        message = socket.receive_json()
    assert (message["code"], message["is_fatal"]) == ("unavailable", True)


# ---------- Cloud Vision OCR (no live calls: a real response saved on 2026-11-28 is the fixture) ----------
VISION = json.loads((Path(__file__).parent / "fixtures" / "vision_label.json").read_text())["responses"][0]


def test_vision_words_become_lines_with_their_letter_height():
    page = main.vision_lines(VISION)
    assert (page["width"], page["height"]) == (960, 640)
    texts = [line["text"] for line in page["lines"]]
    assert texts == ["DOLO 650", "Paracetamol Tablets IP 650 mg", "MFG 01/2025 EXP 12/2027", "1 x 15 Tablets", "Batch B2345"]
    name = page["lines"][0]
    assert name["box"]["h"] > 300 and 40 < name["size"] < 70, "a vertical name: tall box, real letter height"
    expiry = page["lines"][2]
    assert expiry["box"]["h"] < 60 and abs(expiry["size"] - expiry["box"]["h"]) < 10
    assert all(0.5 < line["score"] <= 1 for line in page["lines"])


def test_vision_with_no_text_gives_no_lines():
    assert main.vision_lines({})["lines"] == []


def ocr_with(monkeypatch, reply):
    monkeypatch.setenv("GOOGLE_CLOUD_VISION_API_KEY", "secret-vision-key")
    sent = []

    async def ask(key, images):
        sent.append((key, images))
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(main, "ask_vision", ask)
    return sent


def test_two_frames_are_read_and_the_key_stays_on_the_server(monkeypatch):
    sent = ocr_with(monkeypatch, [VISION, VISION])
    reply = client.post("/api/ocr", json={"images": ["aGk=", "aGk="]})
    assert [len(page["lines"]) for page in reply.json()["pages"]] == [5, 5]
    assert sent[0][0] == "secret-vision-key" and len(sent[0][1]) == 2
    assert "secret" not in reply.text + client.get("/api/status").text


def test_vision_errors_and_timeouts_say_unavailable(monkeypatch):
    ocr_with(monkeypatch, RuntimeError("timeout"))
    assert client.post("/api/ocr", json={"images": ["aGk="]}).json() == {"error": "unavailable"}
    ocr_with(monkeypatch, [{"error": {"code": 7, "message": "denied"}}])
    assert client.post("/api/ocr", json={"images": ["aGk="]}).json() == {"error": "unavailable"}


def test_vision_calls_are_limited_per_minute(monkeypatch):
    ocr_with(monkeypatch, [VISION])
    replies = [client.post("/api/ocr", json={"images": ["aGk="]}).json() for _ in range(main.OCR_CALLS_PER_MINUTE + 1)]
    assert "pages" in replies[0] and replies[-1] == {"error": "rate_limited"}


def test_ocr_takes_one_or_two_images_only(monkeypatch):
    ocr_with(monkeypatch, [VISION])
    assert client.post("/api/ocr", json={"images": []}).status_code == 422
    assert client.post("/api/ocr", json={"images": ["aGk="] * 3}).status_code == 422
