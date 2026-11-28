import base64
import io
import wave

import pytest
from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app)
BODY = {"text": "మీకు ప్రమాదం అర్థమైందా?", "lang": "te", "pace": 1.25}


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    for name in ["SARVAM_API_KEY", "OPENROUTER_API_KEY"]:
        monkeypatch.delenv(name, raising=False)
    main.tts_calls.clear()


def wav(samples: int) -> str:
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(b"\1\0" * samples)
    return base64.b64encode(out.getvalue()).decode()


def test_without_a_key_it_says_so():
    assert client.post("/api/tts", json=BODY).json() == {"error": "key_not_set"}


def test_speaks_the_reply_in_its_language_and_never_returns_the_key(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "secret-key")
    asked = []

    async def fake(key, text, language_code, pace):
        asked.append((key, text, language_code, pace))
        return [wav(10)]

    monkeypatch.setattr(main, "ask_sarvam_tts", fake)
    reply = client.post("/api/tts", json=BODY)
    assert reply.json() == {"audio": wav(10)}
    assert asked == [("secret-key", BODY["text"], "te-IN", 1.25)]
    assert "secret-key" not in reply.text


def test_several_audio_parts_become_one_file(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "k")

    async def fake(*_):
        return [wav(10), wav(5)]

    monkeypatch.setattr(main, "ask_sarvam_tts", fake)
    audio = base64.b64decode(client.post("/api/tts", json=BODY).json()["audio"])
    with wave.open(io.BytesIO(audio)) as w:
        assert w.getnframes() == 15


def test_limits_what_can_be_asked():
    for body in [{**BODY, "text": ""}, {**BODY, "text": "a" * 2501}, {**BODY, "lang": "ta"}, {**BODY, "pace": 3}]:
        assert client.post("/api/tts", json=body).status_code == 422, body


def test_failures_and_rate_limits_are_reported_not_raised(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", "k")

    class Limited(Exception):
        status_code = 429

    for error, expected in [(ConnectionError(), "unavailable"), (Limited(), "rate_limited")]:
        async def fail(*_, error=error):
            raise error

        monkeypatch.setattr(main, "ask_sarvam_tts", fail)
        assert client.post("/api/tts", json=BODY).json() == {"error": expected}


@pytest.mark.parametrize("path", ["/api/tts", "/api/cloud", "/api/vision/fallback"])
def test_another_website_cannot_spend_the_keys(path):
    assert client.post(path, json=BODY, headers={"origin": "https://evil.example"}).status_code == 403
    assert client.post(path, json=BODY, headers={"origin": "http://testserver"}).status_code != 403


def test_the_voice_settings_that_passed_the_strength_check(monkeypatch):
    import asyncio

    import sarvamai

    asked = {}

    class FakeSpeech:
        async def convert(self, **options):
            asked.update(options)
            return type("Reply", (), {"audios": ["AAAA"]})()

    class FakeClient:
        def __init__(self, api_subscription_key):
            self.text_to_speech = FakeSpeech()

    monkeypatch.setattr(sarvamai, "AsyncSarvamAI", FakeClient)
    assert asyncio.run(main.ask_sarvam_tts("k", "Dolo 650", "te-IN", 1.0)) == ["AAAA"]
    assert (asked["model"], asked["speaker"], asked["enable_preprocessing"]) == ("bulbul:v3", "shubh", True)
