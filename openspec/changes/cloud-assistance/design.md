# Design: cloud-assistance

## Context
Docker serves static files today. Cloud use needs a server-side service so the key never reaches the browser. See [`proposal.md`](proposal.md) for the motivation.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Key stays on the server
- **Status:** Proposed
- **Plain English:** The browser talks to our server, and only the server holds the key.
- **Pseudo-technical:** `browser -> nginx /api/cloud -> LiteLLM service (key from env); compose starts with no .env`

### 2. One gate on the client
- **Status:** Proposed
- **Plain English:** Every cloud call passes one check, which makes the limits testable.
- **Pseudo-technical:** `allow if toggle == on and keyConfigured and online and task in {stt, general, scene}`

### 3. Safety never leaves the device
- **Status:** Proposed
- **Plain English:** Dose and safety questions are answered locally from the label.
- **Pseudo-technical:** `if intent in {safety, dose} or confirming: never call general or scene`

## High-level architecture flow
```text
browser: CloudGate -> /api/cloud -> LiteLLM service -> model provider
   toggle off, no key, offline or disallowed task -> no request
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| CloudToggle | spoken and visible setting, off by default | feeds CloudGate |
| CloudGate | allows or refuses each call | only caller of /api/cloud |
| LiteLLM service | compose service holding the key | proxied by nginx |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
CloudState    = { enabled: bool (default false), keyConfigured: bool, online: bool }
CloudRequest  = { task: 'stt'|'general'|'scene', lang: BCP47, text?: string, audio?: bytes, imageJpeg?: bytes }
CloudResponse = { text: string } | { error: 'key_not_set'|'unavailable' }
env           = placeholder values in .env.example; the app starts without them
```

## Tool schemas
```text
GET  /api/cloud/status -> { keyConfigured: bool }
POST /api/cloud        -> CloudResponse   (body: CloudRequest)
```

## Agent flow
local attempt first -> if the task is allowed and the gate passes, call the cloud -> returned text enters the pipeline and rule engine.

## Open decisions
- R5: what is said to a general question when cloud is off. Recommendation: say it cannot answer that offline.
- Which model and provider sit behind LiteLLM.
- Speech recognised in the cloud may turn out to be a dose question. Recommendation: allow transcription only and answer locally.

## Risks
- A public server with a key could be abused. Mitigation: size and rate limits on /api/cloud.
- Audio and images leave the device. Mitigation: off by default and announced when enabled.
