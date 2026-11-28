# Design: faster-label-reading

## Context
Measured on 2026-11-28 in Chrome on the user's laptop (12 threads, NVIDIA RTX 2060): camera frames about 1.0 s, image cleanup about 2.3 s, text reading of three copies 10 to 18 s on the processor. Three readers side by side took about 9 to 13 s. On the graphics chip (WebGPU) on the main thread, three copies took about 2.3 to 2.6 s after a first run of 5.8 s, and every copy read the name and expiry. WebGPU inside the OCR package's background worker gave no result in more than 5 minutes. See [`proposal.md`](proposal.md) for the motivation.

## Design decisions
All decisions are **Proposed**. They were built on the user's request to reduce lag, and are open to review.

### 1. Graphics chip first, processor as fallback
- **Status:** Proposed
- **Plain English:** If the browser has a real graphics chip, labels are read on it. It is warmed up while the page loads. If it does not start in time, fails, or stalls on a read, the app switches to the processor and reads the same image again.
- **Pseudo-technical:** `adapter = navigator.gpu.requestAdapter(); if adapter and not fallback: engine = PaddleOCR(backend: webgpu, worker: false) + warm-up read (limit 30 s); on error or read > 20 s: engine = PaddleOCR(backend: wasm, worker: true), retry the read`

### 2. Shorter frame collection
- **Status:** Proposed
- **Plain English:** The seven camera frames are collected 60 ms apart instead of 110 ms, which saves about a third of a second.
- **Pseudo-technical:** `FRAME_GAP_MS = 60`

### 3. The app's own bundles update after a deploy
- **Status:** Proposed
- **Plain English:** The offline copy always won for everything under `/vendor/`, including the app's own reader, so a returning user kept the old reader with the new app. Now only the models and runtime files come from the saved copy first. A returning user gets the new reader on the second reload.
- **Pseudo-technical:** `cache_first if path matches /vendor/(models|ort)/ else network_first; CACHE = voai-v2`

## High-level architecture flow
```text
camera frames -> cleanup worker -> 3 copies -> text reader (graphics chip, else processor) -> two-copy agreement
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| `web/js/io/reader.js` | picks the text reader and falls back | used by `ocr-entry.js` |

## Data contracts
None.

## Tool schemas
```text
createReader({ hasGpu, make(kind), startMs, readMs, warmImage }) -> { predict(image, params), kind() }
```

## Agent flow
None.

## Open decisions
- The graphics reader runs on the page's main thread, so the screen may stutter while it reads. The camera preview and microphone run on their own threads.
- Measured in the built app on the same laptop, transcript to reply: processor 13.5 to 17.2 s, graphics chip 5.3 to 9.0 s (the first read is the slowest).
- The graphics reader is ready about 31 to 37 s after the page opens, against about 22 to 26 s for the processor. It starts close to the 30 s limit, so a slower chip would fall back to the processor.
- A warm-up image shaped like a camera frame did not shorten the first read, so it was not kept.
- Not measured on a phone or on a laptop without a graphics chip.

## Risks
- A graphics chip could read a character differently from the processor. Mitigation: two copies must still agree, and the full spoken sessions are re-checked.
