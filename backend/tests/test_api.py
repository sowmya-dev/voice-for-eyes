import asyncio
import json

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app import main

client = TestClient(main.app)
KEYS = ["SARVAM_API_KEY", "OPENROUTER_API_KEY", "ROBOFLOW_PRIVATE_API_KEY", "ROBOFLOW_MODEL_ID"]
ORIGIN = {"origin": "http://testserver"}


@pytest.fixture(autouse=True)
def no_keys(monkeypatch):
    for name in KEYS:
        monkeypatch.delenv(name, raising=False)
    main.cloud_calls.clear()


def test_starts_without_keys_and_says_what_is_missing():
    assert client.get("/api/status").json() == {"voice": False, "cloud": False, "visionFallback": False}
    assert client.get("/api/cloud/status").json() == {"keyConfigured": False}
    assert client.post("/api/cloud", json={"task": "general", "lang": "en", "text": "who is Gandhi"}).json() == {"error": "key_not_set"}
    assert client.post("/api/vision/fallback", json={"imageJpeg": "aGk="}).json() == {"error": "key_not_set"}


def test_keys_never_appear_in_responses(monkeypatch):
    for name in KEYS:
        monkeypatch.setenv(name, f"secret-{name}")
    body = client.get("/api/status").text + client.get("/api/cloud/status").text
    assert "secret" not in body
    assert client.get("/api/status").json() == {"voice": True, "cloud": True, "visionFallback": True}


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


def test_speech_reports_a_refused_stream(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "k")

    def refuse(key, **options):
        raise ConnectionError("no")

    monkeypatch.setattr(main, "connect_sarvam", refuse)
    with client.websocket_connect("/ws/stt?language_code=hi-IN", headers=ORIGIN) as socket:
        message = socket.receive_json()
    assert (message["code"], message["is_fatal"]) == ("unavailable", True)
