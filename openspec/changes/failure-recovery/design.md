# Design: failure-recovery

## Context
Decides what happens when speech or the label cannot be understood. Works with voice-interaction, label-image-processing and safety-rules. See [`proposal.md`](proposal.md) for the motivation.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Recovery is a small state machine
- **Status:** Proposed
- **Plain English:** The app remembers which step it is on, so it never loops on the same question.
- **Pseudo-technical:** `speechStep: crossCheck -> askRepeat -> readLabel; intentStep: reask -> readLabel -> clearerView; reset after any understood turn`

### 2. Cross-check before asking
- **Status:** Proposed
- **Plain English:** If words on the label explain the unclear speech, the app does not ask again.
- **Pseudo-technical:** `if confidence < T and match(transcript, label.lines): accept the label word`

### 3. Cleaning has a time budget
- **Status:** Proposed
- **Plain English:** The app tries for five seconds to clean the picture before asking the user to move it.
- **Pseudo-technical:** `process new frames until name and expiry are accepted or 5s have elapsed`

## High-level architecture flow
```text
low confidence -> cross-check with camera text -> "Did I hear X? Say again?" -> read label
unknown intent -> ask again -> read label -> request clearer view
unreadable label -> clean for 5s -> say what is readable -> exact "I can't read this..." sentence
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| CrossChecker | compares the transcript with OCR text | runs before the router |
| RecoveryController | holds the recovery steps | produces a ResponsePlan for the rule engine |
| CleaningTimer | enforces the five seconds | drives ImageCleaner |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
RecoveryState = { speechStep: 0|1|2, intentStep: 0|1|2, heard: string|null, cleaningStartedAt: ms|null }
CrossCheck    = { transcript: string, matchedLabelText: string|null, resolved: bool }
```

## Tool schemas
```text
recovery.crossCheck(Utterance, LabelReading) -> CrossCheck
recovery.next(RecoveryState, event) -> { state: RecoveryState, plan: ResponsePlan|null }
```

## Agent flow
unclear turn -> cross-check -> if unresolved take the next step -> after a clarification begin with "You said: X" -> reset on success.

## Open decisions
- R10: the "low-confidence" threshold has no value. Recommendation: set it from test recordings.
- R11: whether the exact unreadable sentence is translated. Recommendation: use reviewed translations.

## Risks
- Cross-checking could force unclear speech onto a label word. Mitigation: require a close match and never apply it to risk confirmation.
