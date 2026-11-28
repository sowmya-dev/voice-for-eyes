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

### 6. A partly read label gets more time
- **Status:** Agreed (user, 2026-11-28: "EVEN IF one field is read ... increase the retry limit to 5 ... and the time taken for each read too by 10-15 seconds"); the five requests were dropped the same day by decision 8
- **Plain English:** Once the name or the expiry has been read, the strip is clearly in front of the camera, so the app keeps reading for longer before asking (17 seconds, not 5) and shows what it has read on the card while it asks for the rest. The limit is three requests of any kind (decision 8).
- **Pseudo-technical:** `known = label.name || label.expiry; budget = known ? 17s : 5s; retry screens carry tiles = tilesFor(gathered label)`

### 7. One request for a count
- **Status:** Agreed (user, 2026-11-28: "it still keeps asking to show entire strip")
- **Plain English:** The strip model in use sees used pockets only, so asking again and again rarely helps. The app asks once (for the whole strip, or for the side with the pack size), then says honestly what it saw and that it cannot tell how many are left. Checked the same day: Google Cloud Vision's object detection is no substitute: on a whole strip of 10 tablets it found 4 "Coin", and nothing on the others.
- **Pseudo-technical:** `count: result = countOnce(); if !counted: ask once (show_print if empty && !packCount else show_strip); retry once; if still !counted: empty ? count.used_only(empty) : count.give_up`

### 8. Three requests in all, then the landing screen
- **Status:** Agreed (user, 2026-11-28: "stop asking again and again ... have 3 retries and take to landing page")
- **Plain English:** Camera fixes used to come on top of 3 (later 5) move requests, so one question could bring 8 requests. Now every request counts, at most 3, and then the app says the final message and goes back to the landing screen. What was read stays remembered.
- **Pseudo-technical:** `retry: if task.attempt >= 3: giveUp -> say retry.final, show screen 1; task.attempt += 1 for camera and strip cues alike`

### 9. One request per strip, not per question
- **Status:** Agreed (user, 2026-11-29: "kick off dev, will take the 3 decisions later"), after the user reported on 2026-11-28 that the app still asks to show the strip again and again
- **Plain English:** Three things still brought the request back. The app offered to count after almost every answer although it could not (medicine-label-reading, decision 8); a "yes" then asked the user to show the strip; and every repeated count question asked again. The request is now made at most once for a strip in a session. Asked again, the app takes another look without asking and says honestly what it sees. With more than one strip in view it asks, once, to see just one.
- **Pseudo-technical:** `entry.countAsked = true after the first request for this strip; count(): result = countOnce(); if !counted and !entry.countAsked: ask once (show_strip | one_strip | show_print), look again; then answer (count | used_only | give_up) with no further request`

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
