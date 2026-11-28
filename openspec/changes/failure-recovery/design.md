# Design: failure-recovery

## Context
Decides what happens when speech or the label cannot be understood. Works with voice-interaction, label-image-processing and safety-rules. See [`proposal.md`](proposal.md) for the motivation.

**As built (2026-11-28):** When no single direction can be worked out (nothing is cut off), the app says what it cannot read and asks to flip or turn the strip; it does not invent a direction, so the exact sentence is not used and task 1.5 stays open. Cut strips are not detected. Counting retries run only when a strip model is configured. Camera limits in `web/js/core/guidance.js` are untuned.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Recovery is a small state machine
- **Status:** Proposed
- **Plain English:** The app remembers which step it is on, so it never loops on the same question.
- **Pseudo-technical:** `speechStep: crossCheck -> repeatOrQuieter -> readLabel + confirmRequest -> repeatQuestion; intentStep: reask -> readLabel -> clearerView; reset after any understood turn`

### 2. Cross-check before asking
- **Status:** Proposed
- **Plain English:** If words on the label explain the unclear speech, the app does not ask again.
- **Pseudo-technical:** `if unclear(final) and match(transcript, label.lines): accept the label word`

### 4. Unclear speech without a confidence score
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Sarvam gives no confidence score for the words, so the app treats a transcript as unclear when it is empty, matches no request, or names a different medicine from the label.
- **Pseudo-technical:** `unclear(final) = final.text.trim() == '' or intent == 'unknown' or (spokenName and spokenName != label.name)`

### 3. Cleaning has a time budget
- **Status:** Proposed
- **Plain English:** The app tries for five seconds to clean the picture before asking the user to move it.
- **Pseudo-technical:** `process new frames until name and expiry are accepted or 5s have elapsed`

### 5. Hold still only when no frame is sharp
- **Status:** Agreed (user, 2026-11-28: "It keeps asking again and again")
- **Plain English:** Movement between frames is only a problem if it blurred every frame. Cleaning keeps the sharpest frames and lines them up, so a moving hand with one sharp frame is not asked to hold still.
- **Pseudo-technical:** `hold_still if quality.motion > LIMITS.motion and quality.sharpness < LIMITS.sharpness`

### 6. A partly read label gets more time and more tries
- **Status:** Agreed (user, 2026-11-28: "EVEN IF one field is read ... increase the retry limit to 5 ... and the time taken for each read too by 10-15 seconds")
- **Plain English:** Once the name or the expiry has been read, the strip is clearly in front of the camera, so the app keeps reading for longer before asking, allows five requests instead of three, and shows what it has read on the card while it asks for the rest.
- **Pseudo-technical:** `known = label.name || label.expiry; budget = known ? 17s : 5s; maxAttempts = known ? 5 : 3; retry screens carry tiles = tilesFor(gathered label)`

## High-level architecture flow
```text
doubtful speech -> cross-check with camera text -> repeat or move somewhere quieter -> read label + confirm likely request -> repeat the question
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
RecoveryState = { speechStep: 0|1|2|3, likelyIntent: Intent.name|null, intentStep: 0|1|2, heard: string|null, cleaningStartedAt: ms|null }
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
- How the one direction is worked out. Proposed: from where text is cut off at a frame edge or covered by glare, converted to the user's view for the camera in use. Needs tests with real strips.
- What to say when no direction can be worked out. Recommendation: do not invent one; ask the user to hold the strip flat in the middle of the view, and count it as a retry. This departs from the exact sentence, so it needs agreement.
- What happens if the repeated question is also unclear. Recommendation: wait for speech without replaying the label.
- R10: no transcript confidence threshold is needed; decision 4 replaces it.
- R11: whether the exact unreadable sentence is translated. Recommendation: use reviewed translations.

## Risks
- Cross-checking could force unclear speech onto a label word. Mitigation: require a close match and never apply it to risk confirmation.
