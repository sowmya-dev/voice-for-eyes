# Design: safety-rules

## Context
Gatekeeper between the draft answer and speech. Pure logic, testable without camera, microphone or models. See [`proposal.md`](proposal.md) for the motivation.

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
- R6: confirm words for the other languages, and what happens after the repeat. Recommendation: reviewed words per language; ask once, repeat once, then listen.
- R9: when a month-only expiry counts as expired. Recommendation: after the last day of that month.
- R4: behaviour of the safety intent.

## Risks
- A wrong device date changes the expiry result. Mitigation: none in the prompt; raise in review.
- An OCR digit error in a date. Mitigation: two-copy agreement and sample strip tests.
