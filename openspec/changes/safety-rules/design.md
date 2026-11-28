# Design: safety-rules

## Context
Gatekeeper between the draft answer and speech. Pure logic, testable without camera, microphone or models. See [`proposal.md`](proposal.md) for the motivation.

**As built (2026-11-28):** Serious symptoms skip the camera: the 108 instruction is spoken first, then the label is read for the expired warning. The dialer check on a real phone (task 1.12) is not done.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. A pure function checks every answer
- **Status:** Proposed
- **Plain English:** The same inputs always give the same safe answer.
- **Pseudo-technical:** `evaluate(plan, label, today) -> verdict; no network, no model`

### 2. Strict EXP parsing
- **Status:** Proposed
- **Plain English:** Only a date printed next to EXP is an expiry date.
- **Pseudo-technical:** `expiry = parseDateNextTo("EXP", acceptedText) or null; never fill in a missing month or year`

### 3. Expired wins
- **Status:** Proposed
- **Plain English:** An expired medicine gets the warning first and no dosage.
- **Pseudo-technical:** `if expired: segments = [warning] + segments without dosage; requiresConfirmation = true`

### 4. One repeat for confirmation
- **Status:** Proposed
- **Plain English:** The app asks if the risk is understood and repeats once unless the user clearly confirms.
- **Pseudo-technical:** `speak(answer); ask(); if reply not in confirmWords[lang]: speak(answer) once`

### 5. The emergency instruction is fetched before it is needed
- **Status:** Proposed (needed because replies now come from a network voice)
- **Plain English:** When the app starts, and whenever the language or speed changes, it downloads the 108 sentence and keeps it in memory. In an emergency that sentence plays at once, even offline, and the rest of the reply follows.
- **Pseudo-technical:** `tts.prepare(safety.emergency, lang); say(text): if text starts with a prepared sentence: play it from memory, then speak the rest`

### 6. Help first, label after
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Someone who feels unwell hears what to do at once. The app used to read the label first, which took many seconds. Now it says the instruction, then reads the label and adds the expired warning or expiry-soon notice if one applies. It reads again even if it saw a label earlier, because the strip may have changed. The emergency path does the same.
- **Pseudo-technical:** `urgent(instruction): deliver(instruction, lastLabel) ; if lastLabel not expired: label = read() ; if window(label) in {expired, week, month} and not already said: speak(warning|notice); if expired: risk check`

## High-level architecture flow
```text
draft ResponsePlan + LabelReading + today -> RuleEngine -> SafetyVerdict -> speech
                                                             |
                                       requiresConfirmation -> ConfirmationState -> repeat at most once
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| ExpiryParser | finds the EXP date | reads AcceptedField |
| RuleEngine | applies the rules in order | called by the pipeline for every plan, including replays |
| ConfirmationState | tracks the pending risk question | consumes the `yes` intent |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
Expiry            = { year: int, month: int, day: int|null, sourceText: string } | null
SafetyVerdict     = { plan: ResponsePlan, expired: true|false|'unknown', removed: string[], requiresConfirmation: bool }
ConfirmationState = { pending: ResponsePlan|null, repeated: bool }
```

## Tool schemas
```text
safety.parseExpiry(AcceptedField) -> Expiry
safety.evaluate(ResponsePlan, LabelReading, today) -> SafetyVerdict
safety.confirm(ConfirmationState, Utterance) -> 'confirmed'|'repeat'|'done'
```

## Agent flow
draft plan -> evaluate -> speak the verdict plan -> if confirmation is required, ask -> confirmed: continue; otherwise repeat once and continue.

## Open decisions
- Which words in each language count as a serious symptom. They need review, and a doubtful transcript should lean towards giving the emergency instruction.
- A web app cannot place a call by itself: a `tel:108` link opens the dialer and the user or a helper presses call. Browsers may require a tap first; many laptops cannot call. Needs a check on a real phone.
- The user chose on 2026-11-28 to open the dialer with 108 for now. 108 may not reach an ambulance everywhere; revisit adding 112, India's national emergency number.
- R6: confirm words for the other languages, and what happens after the repeat. Recommendation: reviewed words per language; ask once, repeat once, then listen.
- R9 settled by the user on 2026-11-28: "EXP 12/2027" means the medicine expires in December 2027, so it stays valid through 31 December 2027. MFG is the manufacturing date and is never an expiry.
- "Best before" appears on some strips. Not yet decided whether it counts as an expiry marker, or what to do when it is relative, such as "best before 24 months from manufacture".
- R4: behaviour of the safety intent.

## Risks
- A wrong device date changes the expiry result. Mitigation: none in the prompt; raise in review.
- An OCR digit error in a date. Mitigation: two-copy agreement and sample strip tests.
