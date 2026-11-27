# Design: voice-interaction

## Context
This change owns the session and the order of the pipeline. Other changes plug stages into it. `web/index.html` today only starts a camera preview from a button. See [`proposal.md`](proposal.md) for the motivation.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. One session state machine
- **Status:** Proposed
- **Plain English:** One place decides what the app is doing, so speaking never switches off the camera or microphone.
- **Pseudo-technical:** `state in {idle, listening, hearing, processing, speaking}; capture stays on in every state except idle; mute drops audio before VAD`

### 2. Interruption cancels the turn
- **Status:** Proposed
- **Plain English:** When the user speaks over an answer, the app fades out and forgets the unfinished work.
- **Pseudo-technical:** `on vad.speechStart: if speaking then fadeOut(); turnId += 1; discard any result whose turnId is old`

### 3. Pipeline as a list of stages
- **Status:** Proposed
- **Plain English:** Every answer goes through the same steps, so none can skip the safety rules.
- **Pseudo-technical:** `for stage in [vad, lid, stt, image, ocr, crossCheck, intent, rules, compose, speak, memory]: ctx = stage(ctx); only the speak stage may produce sound`

### 4. Keyword routing
- **Status:** Proposed
- **Plain English:** Fixed word lists per language decide the intent, so the result is predictable.
- **Pseudo-technical:** `intent = first rule in table[lang] matching normalise(text), else "unknown"; rule order breaks ties`

## High-level architecture flow
```text
Open app -> [capture on] -> mic -> VAD -> LID -> STT -> image -> OCR -> cross-check
                                                                          |
 memory <- speech <- response composer <- rule engine <- intent router <--+
    new speech at any point: fade out, drop the old turn, start a new one
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| SessionController | owns state, turnId and mute | starts CaptureManager; receives VAD events |
| CaptureManager | camera stream, microphone stream, torch | gives frames and audio to the pipeline |
| Pipeline | runs stages in order with a TurnContext | checks turnId between stages |
| IntentRouter | matches keyword tables | reads Utterance, writes Intent |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
SessionState = { state: 'idle'|'listening'|'hearing'|'processing'|'speaking', turnId: int, muted: bool, torch: 'on'|'off'|'unsupported' }
Utterance    = { id: string, turnId: int, text: string, lang: BCP47, confidence: 0..1, source: 'local'|'cloud', startedAt: ms, endedAt: ms }
Intent       = { name: 'identify'|'safety'|'dose'|'general'|'scene'|'yes'|'language'|'unknown', utteranceId: string, matched: string|null }
TurnContext  = { turnId: int, utterance?: Utterance, intent?: Intent, label?: LabelReading, response?: ResponsePlan }
```

## Tool schemas
```text
camera.start() -> { frames: stream<Frame>, torchSupported: bool }
camera.setTorch(on: bool) -> { ok: bool }
vad.listen(audio) -> events: speechStart | speechEnd{ audio }
intent.route(Utterance) -> Intent
```

## Agent flow
The agent is a deterministic orchestrator, not a language model. open -> start capture -> wait for speechStart -> on speechEnd run the pipeline -> speak -> return to listening.

## Open decisions
- R3: there is no count intent among the eight. Recommendation: add `count`.

## Risks
- Browsers may block capture or sound before a user action. Mitigation: one tap anywhere starts both.
- The app may hear its own speech as an interruption. Mitigation: browser echo cancellation, and test on a phone speaker.
