# Design: platform-and-privacy

## Context
`docker-compose.yml`, `Dockerfile` and `web/index.html` already serve a start screen on 3000:3000. The submitted prompt's Android client is deferred (D1 in `openspec/traceability.md`). See [`proposal.md`](proposal.md) for the motivation.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Static app served by nginx
- **Status:** Proposed
- **Plain English:** Docker only hands the app to the browser; processing happens on the user's device.
- **Pseudo-technical:** `nginx:listen 3000 -> web/; compose "3000:3000"`

### 2. Models in the browser
- **Status:** Proposed
- **Plain English:** Speech and OCR models run inside the browser, not on our server.
- **Pseudo-technical:** `sherpa-onnx WebAssembly; PaddleOCR in the browser; OpenCV.js; run in web workers`

### 3. Cache for offline use
- **Status:** Proposed
- **Plain English:** After the first load the app works without a network.
- **Pseudo-technical:** `service worker caches app and models; offlineReady = all assets cached`

### 4. No browser speech recognition
- **Status:** Proposed
- **Plain English:** Some browsers send its audio to the cloud, which breaks privacy.
- **Pseudo-technical:** `do not use the browser SpeechRecognition API for local recognition`

## High-level architecture flow
```text
docker compose up -> nginx :3000 -> browser loads app and models -> cached
browser: all processing on device        (cloud only through cloud-assistance)
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| nginx container | serves files on port 3000 | later proxies /api/cloud |
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

## Tool schemas
```text
models.load(role, lang) -> ModelHandle   (tries manifest order)
stt.transcribe(audio, lang) -> Utterance
log.write(LogEntry) -> void
```

## Agent flow
start -> show main screen -> load models -> report ready and offline readiness -> run sessions.

## Open decisions
- R8: which model serves each language.
- R12: which requirements must work in the submission.
- What logs may contain. Recommendation: timings and outcomes only.

## Risks
- The models may not run in a browser, or be too large or slow for a basic phone. Prerequisite spike: measure size, memory, latency and coverage; bring failures back to spec review.
- A phone on plain HTTP gets no camera or microphone. Mitigation: HTTPS for phone testing.
