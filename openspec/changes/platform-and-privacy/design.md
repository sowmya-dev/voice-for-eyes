# Design: platform-and-privacy

## Context
`docker-compose.yml`, `Dockerfile` and `web/index.html` already serve a start screen on 3000:3000. The submitted prompt's Android client is deferred (D1 in `openspec/traceability.md`). See [`proposal.md`](proposal.md) for the motivation.

**As built (2026-11-28):** Built: nginx (port 3000) and FastAPI containers; keys come from an optional `.env` that reaches only the backend; OCR models, ONNX runtime, OpenCV and fonts are served by the app; cross-origin isolation for OCR threads; a service worker keeps label reading working offline after one visit. Checked in Chrome: fresh copy with no keys, offline label reading, plain-HTTP network address, a real Sarvam utterance, and no key value in served files or images. Not built: on-device Silero VAD and Whisper language identification.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Static app served by nginx
- **Status:** Proposed
- **Plain English:** Docker serves the app and passes speech to Sarvam; image processing happens on the user's device.
- **Pseudo-technical:** `nginx:listen 3000 -> web/; compose "3000:3000"`

### 2. Models in the browser
- **Status:** Proposed
- **Plain English:** Speech detection, language identification and OCR run inside the browser.
- **Pseudo-technical:** `sherpa-onnx WebAssembly (VAD, LID); PaddleOCR in the browser; OpenCV.js; run in web workers`

### 3. Cache for offline use
- **Status:** Proposed
- **Plain English:** After the first load the app works without a network.
- **Pseudo-technical:** `service worker caches app and models; offlineReady = all assets cached`

### 4. No browser speech recognition
- **Status:** Proposed
- **Plain English:** Some browsers send its audio to the cloud, which breaks privacy.
- **Pseudo-technical:** `do not use the browser SpeechRecognition API for local recognition`

### 5. Sarvam realtime speech-to-text
- **Status:** Proposed (the user agreed on 2026-11-28 to use Sarvam; the relay is not yet agreed)
- **Plain English:** Speech is sent through our server to Sarvam, so the secret key never reaches the browser.
- **Pseudo-technical:** `browser <-> FastAPI backend (/ws/stt, pip install sarvamai; AsyncSarvamAI(api_subscription_key=env SARVAM_API_KEY).speech_to_text_realtime_streaming.connect(...)) <-> wss://api.sarvam.ai/speech-to-text-realtime/ws`

### 6. FastAPI backend
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** A small Python backend built with FastAPI holds the Sarvam key and relays speech. It runs as its own Docker service next to nginx, and the app still starts without a key.
- **Pseudo-technical:** `backend/requirements.txt: fastapi, uvicorn[standard], sarvamai, inference-sdk, httpx (versions pinned when first installed)
pip install -r backend/requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
WebSocket /ws/stt: browser audio_input -> sarvamai realtime stream -> transcript events back
nginx :3000 proxies /ws/stt and /api/* to backend :8000; SARVAM_API_KEY, ROBOFLOW_* and OPENROUTER_API_KEY read from the environment at run time, both optional`

### 7. Reply text goes to Sarvam
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Besides the user's speech, the text of each reply now goes to Sarvam to be spoken. It can include a medicine name and printed dosage text. Images still stay on the device. See `medicine-label-reading` decision 4.
- **Pseudo-technical:** `browser -> POST /api/tts -> FastAPI -> AsyncSarvamAI.text_to_speech.convert; nothing logged; same-origin only`

### 10. Google Cloud Vision reads labels, PaddleOCR stays as the fallback
- **Status:** Agreed (user, 2026-11-28: "let's use Google Cloud Vision API for OCR")
- **Plain English:** Checked on 2026-11-28 with one call on a made-up label: Cloud Vision read a bold red name running up the strip, the expiry across it and "1 x 15 Tablets" correctly, which the on-device reader does not. The app server sends the two sharpest colour frames, turns the words into lines with their real letter height, and the browser keeps two-frame agreement. With no key, no network, an error, a 10 s timeout or 20 calls in a minute, the on-device reader is used as before. Label photos now go to Google, recorded as departure D16.
- **Pseudo-technical:** `POST /api/ocr {images: [jpeg, jpeg]} -> vision.googleapis.com/v1/images:annotate?key=… DOCUMENT_TEXT_DETECTION, languageHints [en] -> words joined into lines at LINE_BREAK / EOL_SURE_SPACE -> {pages: [{width, height, lines: [{text, score, box (axis-aligned), size (|v3 - v0|)}]}]}; browser: reading = agree(pages.map(extractFields)); on error -> PaddleOCR copies`

## High-level architecture flow
```text
docker compose up -> nginx :3000 -> browser loads app and models -> cached
browser: VAD, language ID, image processing, OCR on device
speech audio -> app server relay -> Sarvam realtime -> transcript -> browser
reply text   -> app server /api/tts -> Sarvam text-to-speech -> audio -> browser
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| nginx container | serves files on port 3000 | later proxies /api/cloud |
| Speech relay | FastAPI WebSocket endpoint using `sarvamai`; holds the Sarvam key and relays the stream | between the browser and Sarvam |
| Vision fallback | FastAPI endpoint /api/vision/fallback using inference-sdk | called by the browser when the strip model gives no result |
| Service worker | caches the app and models | reports offline readiness |
| ModelLoader | loads models and applies fallback order | used by VAD, LID, STT and OCR |
| LocalLogger | writes log entries on the device | called by the pipeline |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
ModelManifest = { id: string, role: 'vad'|'lid'|'stt'|'ocr', url: string, bytes: int, langs: BCP47[], order: int }
LogEntry      = { at: ms, turnId: int, stage: string, durationMs: int, outcome: 'ok'|'error', code?: string }
                (no audio, images, transcripts or label text)
```

### Sarvam saaras:v4 realtime streaming
Copied on 2026-11-28 from `sarvam-saaras-v4-realtime.md`, which the user supplied. It replaces the earlier user-supplied contract and starter code. The client has not been run against the live API.

How the app uses it (Proposed):
- The Python client below reads the microphone itself. In the app, the browser captures audio and sends it to the speech relay, which adds the `API-SUBSCRIPTION-KEY` header and forwards the messages.
- The browser subprotocol option would put the key in the browser, so the app does not use it.
- Act only on `transcript.final`. Never route an intent or confirm a risk check from `transcript.partial`.
- `error` with `is_fatal: true`, or close codes 1003, 1008, 1011 or 4000: tell the user voice input is unavailable.
- One stream carries many utterances, told apart by `utterance_idx`.

Source: https://docs.sarvam.ai/api-reference/speech-to-text/transcribe/realtime/ws.md
Status: client not run against the live API.

Endpoint: `wss://api.sarvam.ai/speech-to-text-realtime/ws` (GET, 101 Switching Protocols)
Auth: header `API-SUBSCRIPTION-KEY: <key>` (browsers: subprotocol `api-subscription-key.<key>`)

#### 1. Client code (Python)

`pip install websockets sounddevice`, then `export SARVAM_API_KEY=...`

```python
import asyncio, base64, json, os, urllib.parse
import sounddevice as sd
import websockets

PARAMS = dict(
    language_code="auto",        # or en-IN, hi-IN, ...
    model="saaras:v4",
    stream_type="balanced",
    mode="codemix",
    endpointing="vad",           # or "manual"
    sample_rate="16000",         # or "8000"
    encoding="linear16",
    threshold="0.5",             # 0.0-1.0, higher = louder voice needed
    silence_duration_ms="800",   # needed with vad
)
URL = "wss://api.sarvam.ai/speech-to-text-realtime/ws?" + urllib.parse.urlencode(PARAMS)
RATE = int(PARAMS["sample_rate"])
CHUNK = RATE // 10               # 100 ms; 3200 bytes at 16 kHz (fast-mode cap is 16000 bytes)


async def send_mic(ws):
    loop, q = asyncio.get_running_loop(), asyncio.Queue()

    def cb(indata, frames, t, status):
        loop.call_soon_threadsafe(q.put_nowait, bytes(indata))

    with sd.RawInputStream(samplerate=RATE, channels=1, dtype="int16",
                           blocksize=CHUNK, callback=cb):
        while True:
            pcm = await q.get()
            await ws.send(json.dumps(
                {"event": "audio_input", "audio": base64.b64encode(pcm).decode()}))


async def recv(ws):
    async for raw in ws:
        m = json.loads(raw)
        ev = m["event"]
        if ev == "transcript.partial":
            print("...", m["text"], end="\r")
        elif ev == "transcript.final":
            print("FINAL", m.get("language", ""), m["text"])
        elif ev == "error":
            print("ERROR", m)
            if m["is_fatal"]:
                return
        elif ev == "session.end":
            print("session.end", m)
            return
        # session.begin, vad.*, pong, config.updated: ignored


async def main():
    headers = {"API-SUBSCRIPTION-KEY": os.environ["SARVAM_API_KEY"]}
    async with websockets.connect(URL, additional_headers=headers) as ws:
        sender = asyncio.create_task(send_mic(ws))
        try:
            await recv(ws)
        finally:
            sender.cancel()
            try:
                await ws.send(json.dumps({"event": "end"}))
            except Exception:
                pass


asyncio.run(main())
```

Manual endpointing: set `endpointing="manual"`, send `{"event":"speech_start"}` before audio
and `{"event":"speech_end"}` (or `{"event":"flush"}`) after it.

#### 2. Handshake query parameters

| Param | Values / default |
|---|---|
| `language_code` | required: `auto`, `en-IN`, `hi-IN`, `bn-IN`, `kn-IN`, `ml-IN`, `mr-IN`, `or-IN`, `pa-IN`, `ta-IN`, `te-IN`, `gu-IN`, `as-IN`, `ur-IN`, `ne-IN`, `kok-IN`, `ks-IN`, `sd-IN`, `sa-IN`, `sat-IN`, `mni-IN`, `brx-IN`, `mai-IN`, `doi-IN` |
| `model` | `saaras:v4` (default), `saaras:v3-realtime` |
| `stream_type` | `fast`, `balanced` (default), `simulated` |
| `mode` | `transcribe` (default), `translate`, `verbatim`, `translit`, `codemix` (final transcript only) |
| `endpointing` | `vad` (default), `manual` |
| `encoding` | `linear16` (default), `linear32`, `mulaw`, `alaw`; mono only |
| `sample_rate` | `"16000"` (default), `"8000"`; other values close with code 4000 |
| `threshold` | `"0.0"` to `"1.0"`, default `0.3` |
| `silence_duration_ms` | default `1000` (vad) |
| `prefix_padding_ms` | default `300` |
| `min_speech_duration_ms` | default `250` |
| `return_timestamps` | `"true"` / `"false"` (default) |
| `prompt` | string |
| `keyterms` | string (not allowed on `saaras:v3-realtime`) |

#### 3. Input JSON Schema (client to server)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SarvamRealtimeClientMessage",
  "oneOf": [
    {
      "title": "audio_input",
      "type": "object",
      "required": ["event", "audio"],
      "additionalProperties": false,
      "properties": {
        "event": { "const": "audio_input" },
        "audio": { "type": "string", "contentEncoding": "base64",
                   "description": "Mono PCM bytes in the handshake `encoding`, base64. Max 16000 bytes/frame on stream_type=fast." }
      }
    },
    { "title": "speech_start", "type": "object", "required": ["event"],
      "properties": { "event": { "const": "speech_start" } },
      "description": "endpointing=manual only" },
    { "title": "speech_end", "type": "object", "required": ["event"],
      "properties": { "event": { "const": "speech_end" } },
      "description": "endpointing=manual only" },
    { "title": "flush", "type": "object", "required": ["event"],
      "properties": { "event": { "const": "flush" } },
      "description": "endpointing=manual only; force-finalize buffered audio" },
    {
      "title": "config.update",
      "type": "object",
      "required": ["event"],
      "properties": {
        "event": { "const": "config.update" },
        "language_code": { "type": "string" },
        "prompt": { "type": "string", "description": "empty string clears it" },
        "mode": { "enum": ["transcribe", "translate", "verbatim", "translit", "codemix"] },
        "stream_type": { "enum": ["fast", "balanced"], "description": "to/from simulated is rejected (invalid_config)" },
        "endpointing": { "enum": ["vad", "manual"] },
        "threshold": { "type": "string" },
        "silence_duration_ms": { "type": "integer" },
        "min_speech_duration_ms": { "type": "integer" }
      },
      "description": "language_code/prompt/mode/stream_type/endpointing apply at next utterance boundary; threshold/silence/min_speech apply immediately (vad only)"
    },
    { "title": "ping", "type": "object", "required": ["event"],
      "properties": { "event": { "const": "ping" } } },
    { "title": "end", "type": "object", "required": ["event"],
      "properties": { "event": { "const": "end" } },
      "description": "graceful close; server finalizes pending utterance" }
  ]
}
```

#### 4. Output JSON Schema (server to client)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SarvamRealtimeServerMessage",
  "oneOf": [
    {
      "title": "session.begin",
      "type": "object",
      "required": ["event", "request_id"],
      "properties": {
        "event": { "const": "session.begin" },
        "request_id": { "type": "string" },
        "config": {
          "type": "object",
          "properties": {
            "model": { "type": "string" },
            "language_code": { "type": "string" },
            "encoding": { "type": "string" },
            "sample_rate": { "type": "integer" },
            "stream_type": { "type": "string" },
            "mode": { "type": "string" },
            "prompt": { "type": "string" },
            "turn_detection": { "enum": ["vad", "manual"], "description": "echo of endpointing" },
            "threshold": { "type": "string" },
            "prefix_padding_ms": { "type": "integer" },
            "silence_duration_ms": { "type": "integer" },
            "min_speech_duration_ms": { "type": "integer" },
            "return_timestamps": { "type": "boolean" }
          }
        }
      }
    },
    {
      "title": "vad.speech_start / vad.speech_end",
      "type": "object",
      "required": ["event", "utterance_idx"],
      "properties": {
        "event": { "enum": ["vad.speech_start", "vad.speech_end"] },
        "utterance_idx": { "type": "integer", "minimum": 0 },
        "confidence": { "type": "string", "description": "float as string" }
      },
      "description": "endpointing=vad only"
    },
    {
      "title": "transcript.partial",
      "type": "object",
      "required": ["event", "utterance_idx", "text"],
      "properties": {
        "event": { "const": "transcript.partial" },
        "utterance_idx": { "type": "integer" },
        "text": { "type": "string" },
        "language": { "type": "string", "description": "only when language_code=auto" }
      },
      "description": "not sent when stream_type=simulated"
    },
    {
      "title": "transcript.final",
      "type": "object",
      "required": ["event", "utterance_idx", "text"],
      "properties": {
        "event": { "const": "transcript.final" },
        "utterance_idx": { "type": "integer" },
        "text": { "type": "string" },
        "language": { "type": "string", "description": "BCP-47, only when language_code=auto" },
        "language_confidence": { "type": "string", "description": "float as string, only when auto" },
        "start_s": { "type": "string", "description": "seconds since stream start, only with return_timestamps=true" },
        "end_s": { "type": "string", "description": "same as start_s" }
      }
    },
    {
      "title": "config.updated",
      "type": "object",
      "required": ["event", "applied"],
      "properties": {
        "event": { "const": "config.updated" },
        "applied": { "type": "array", "items": { "type": "string" } }
      }
    },
    { "title": "pong", "type": "object", "required": ["event"],
      "properties": { "event": { "const": "pong" } } },
    {
      "title": "session.end",
      "type": "object",
      "required": ["event", "request_id"],
      "properties": {
        "event": { "const": "session.end" },
        "request_id": { "type": "string" },
        "total_duration_s": { "type": "string" },
        "total_utterances": { "type": "integer" },
        "audio_duration_s": { "type": "string", "description": "billed audio quantity" }
      }
    },
    {
      "title": "error",
      "type": "object",
      "required": ["event", "code", "is_fatal", "message"],
      "properties": {
        "event": { "const": "error" },
        "code": { "type": "string",
                  "description": "invalid_request, invalid_model, invalid_subscription_key (401), inactivity_timeout (408), chunk_too_large (non-fatal), invalid_config (non-fatal)" },
        "is_fatal": { "type": "boolean" },
        "message": { "type": "string" },
        "status_code": { "type": "integer" }
      }
    }
  ]
}
```

WebSocket close codes: 1003 (rate limit, quota or bad key), 1008 (no audio for 60 s),
1011 (internal error), 4000 (rejected params; reason capped at 123 bytes).

#### 5. Gaps in the docs

- PCM byte order, recommended chunk size, max session length and ping interval are not stated.
  The client assumes 100 ms little-endian int16 chunks.
- Query numerics are strings, while `config.update` and `session.begin` use integers for some
  of the same fields.
- The client has no reconnect or backoff.

## Tool schemas
```text
models.load(role, lang) -> ModelHandle   (tries manifest order)
stt.open(params: handshake query parameters) -> Stream        (relay adds API-SUBSCRIPTION-KEY)
stt.send(Stream, ClientMessage) -> void                        (audio_input, speech_start, speech_end, flush, config.update, ping, end)
stt.events(Stream) -> stream<ServerMessage>                    (transcript.final -> Utterance)
log.write(LogEntry) -> void
```

## Agent flow
start -> show main screen -> load models -> report ready and offline readiness -> run sessions.

## Open decisions
- Authentication: the `API-SUBSCRIPTION-KEY` header, added by the relay. The team will inject the key at run time; it is optional so Docker still starts without it, and is never committed or sent to the browser.
- stream_type: the starter code used fast; the contract and the doc use balanced, the default. Recommendation: balanced until both are compared on test recordings.
- The relay uses Sarvam's `sarvamai` package (user, 2026-11-28). The client copied below uses the plain `websockets` package and shows the raw messages. Not yet confirmed: that `connect()` accepts model, mode, endpointing, sample_rate, threshold and silence_duration_ms (the starter code passed only language_code and stream_type), and which package version to pin. The FastAPI backend is a second Docker service (decision 6).
- `transcript.final` has no transcript confidence. `language_confidence` is sent only with `language_code=auto`, and measures the language, not the words.
- Not stated by the doc: PCM byte order, recommended chunk size, maximum session length, ping interval and reconnect behaviour. Proposed: 100 ms little-endian int16 chunks, reconnect with backoff, and a ping before the 60-second no-audio close.
- The contract lists Odia as or-IN; Sarvam's REST reference, read on 2026-11-28, listed od-IN. Odia is outside the first four languages; check before adding it.
- endpointing: Sarvam's vad, or manual driven by the on-device Silero VAD. Recommendation: manual, so one detector controls turns and interruption.
- sample_rate (recommendation: 16000), threshold and silence_duration_ms: set from test recordings.
- language_code: auto or the session language, and whether on-device language identification is still needed with auto.
- Whether the user must agree before audio is sent to Sarvam. The cloud-assistance toggle does not cover it.
- R8: which model serves each language.
- R12: which requirements must work in the submission.
- What logs may contain. Recommendation: timings and outcomes only.

## Risks
- Label photos are sent to Google when the Vision key is set; each read uses 2 Cloud Vision units.
- Voice input stops without a network, a key or the Sarvam service.
- Speech audio and reply text, which may include health details, leave the device.
- The models may not run in a browser, or be too large or slow for a basic phone. Prerequisite spike: measure size, memory, latency and coverage; bring failures back to spec review.
- A phone on plain HTTP gets no camera or microphone. Mitigation: HTTPS for phone testing.
