# Design: cloud-assistance

## Context
Docker serves static files today. Cloud use needs a server-side service so the key never reaches the browser. See [`proposal.md`](proposal.md) for the motivation.

**As built (2026-11-28):** Built as FastAPI `/api/cloud` with `httpx`. Only `general` and `scene` are accepted; medicine words are refused in the browser and again on the server, and a reply that mentions medicine or doses is not spoken. Checked with real calls on 2026-11-28: google/gemma-4-31b-it:free returned 429, and the next models answered.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Key stays on the server
- **Status:** Proposed
- **Plain English:** The browser talks to our server, and only the server holds the key.
- **Pseudo-technical:** `browser -> nginx /api/cloud -> FastAPI backend (OPENROUTER_API_KEY from env) -> OpenRouter; compose starts with no .env`

### 2. One gate on the client
- **Status:** Proposed
- **Plain English:** Every cloud call passes one check, which makes the limits testable.
- **Pseudo-technical:** `allow if toggle == on and keyConfigured and online and task in {stt, general, scene}`

### 3. Safety never leaves the device
- **Status:** Proposed
- **Plain English:** Dose and safety questions are answered locally from the label.
- **Pseudo-technical:** `if intent in {safety, dose} or confirming: never call general or scene`

### 4. OpenRouter free models for conversation
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Surroundings descriptions and general questions use free models on OpenRouter, called by our backend over OpenRouter's REST API. Medicine questions never go there.
- **Pseudo-technical:** `POST https://openrouter.ai/api/v1/chat/completions
headers: Content-Type: application/json; Authorization: Bearer $OPENROUTER_API_KEY
body: { model, messages: [{ role: 'user', content: text | [{type:'text', text}, {type:'image_url', image_url:{url:'data:image/jpeg;base64,...'}}] }] }
model = first available of: google/gemma-4-31b-it:free, nvidia/nemotron-3.5-super-vl:free, openrouter/free (all take images)`

### 5. Direct REST instead of LiteLLM
- **Status:** Proposed (the user supplied the REST call on 2026-11-28)
- **Plain English:** The backend calls OpenRouter directly, so no separate LiteLLM service is needed. The prompt names LiteLLM, so this is recorded as a departure.
- **Pseudo-technical:** `FastAPI POST /api/cloud -> httpx.post(OpenRouter) -> { text: choices[0].message.content }`

### 6. One use of a medicine photo: Molmo points for a count
- **Status:** Proposed (user, 2026-11-28: "Next in line is to try Molmo from Openrouter"). Nothing is built, and D11 stands until Molmo is adopted.
- **Plain English:** Counting is the one medicine task where a cloud model may see the strip, and only to point at the tablets. The app counts the points itself and throws away anything else the model writes, so the model never tells the user anything about a medicine. Like every cloud use, it needs cloud assistance to be on.
- **Pseudo-technical:** `browser sends cloudHelp with the count request; if POCKET_DETECTOR includes molmo and cloudHelp: OpenRouter chat/completions {model: allenai/molmo-2-8b:free, user: [text "Point to each pill that is still in the blister pack.", image]} -> points; else no photo leaves for OpenRouter and there is no second opinion`

## High-level architecture flow
```text
browser: CloudGate -> /api/cloud -> FastAPI backend -> OpenRouter (free model)
   toggle off, no key, offline or disallowed task -> no request
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| CloudToggle | spoken and visible setting, off by default | feeds CloudGate |
| CloudGate | allows or refuses each call | only caller of /api/cloud |
| CloudClient (backend) | calls OpenRouter with the key and the model list | behind FastAPI /api/cloud, proxied by nginx |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
CloudState    = { enabled: bool (default false), keyConfigured: bool, online: bool }
CloudRequest  = { task: 'stt'|'general'|'scene', lang: BCP47, text?: string, audio?: bytes, imageJpeg?: bytes }
CloudResponse = { text: string, model: string } | { error: 'key_not_set'|'unavailable'|'rate_limited' }
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
- The free model list changes often; the three IDs above came from third-party lists on 2026-11-28 and are not checked against OpenRouter. Recommendation: read the list from config, not code.
- Free models are limited to about 20 requests a minute and 50 a day (1,000 a day after buying $10 of credits); one source said 200. A demo can run out. Recommendation: answer "I can't describe that right now" on `rate_limited`.
- Whether free-model providers log or train on prompts and images is not checked. Room photos may show private details.
- Speech recognised in the cloud may turn out to be a dose question. Recommendation: allow transcription only and answer locally.
- If Molmo is adopted, D11 becomes "surroundings, general questions, and pointing at tablets for a count". Record that as D17 in traceability then, not before.
- On 2026-11-28 OpenRouter listed no provider serving Molmo, so this cannot be tried yet (label-image-processing, decision 20).

## Risks
- A public server with a key could be abused. Mitigation: size and rate limits on /api/cloud.
- Audio and images leave the device. Mitigation: off by default and announced when enabled.
