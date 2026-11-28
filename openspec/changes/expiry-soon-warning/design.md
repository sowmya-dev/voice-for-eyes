# Design: expiry-soon-warning

## Context
Runs with the safety rules, after `safety.parseExpiry` and before speech. Pure date logic, testable without camera, microphone or models. See [`proposal.md`](proposal.md) for the motivation.

**As built (2026-11-28):** Built in `web/js/core/expiry.js` and `safety.js`, with every date example in the spec as a test.

## Design decisions
All decisions are **Proposed** until reviewed. The user asked for the 7-day and one-month limits.

### 1. Compare calendar dates
- **Status:** Proposed
- **Plain English:** Only the date on the device matters, so the time of day cannot change the result.
- **Pseudo-technical:** `last = expiry.day ? date(expiry) : lastDayOfMonth(expiry); if last < today: 'expired'; else if last <= today + 7d: 'week'; else if last <= addMonthClamped(today, 1): 'month'; else 'later'`

### 2. Month-only dates last the whole month
- **Status:** Proposed
- **Plain English:** "EXP 03/2027" is treated as valid until 31 March 2027. The day is used only to calculate; the app never speaks a day the label does not print. Same recommendation as R9 in `safety-rules`.
- **Pseudo-technical:** `lastDayOfMonth(year, month)`

### 3. Notice on every answer about the strip
- **Status:** Proposed
- **Plain English:** Each answer about that medicine, including a replay, starts with the notice. It is worked out again each time, so a replay on a later day stays correct. The notice alone does not ask "Do you understand the risk?"; a dosage answer still does.
- **Pseudo-technical:** `if window in {week, month}: segments = [notice(window)] + segments`

### 4. Fixed wording
- **Status:** Proposed
- **Plain English:** Two prepared sentences, translated and reviewed for each language: "This medicine expires within 7 days." and "This medicine expires within one month."
- **Pseudo-technical:** `templateId in {expiry.week, expiry.month}`

## High-level architecture flow
```text
label -> accepted EXP date -> parseExpiry -> classify(expiry, today)
                                                 |
                 expired -> expired-medicine rules (safety-rules)
                 week / month -> notice first -> rest of answer -> speech
                 later / unknown -> no notice
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| ExpiryWindow | classifies an Expiry against today | called by RuleEngine |
| RuleEngine (`safety-rules`) | puts the notice first | passes the plan to TemplateRenderer |

## Data contracts
`Expiry` is defined in `safety-rules` and `ResponsePlan` in `medicine-label-reading`.

```text
ExpiryWindow = 'expired' | 'week' | 'month' | 'later' | 'unknown'
```

## Tool schemas
```text
expiry.classify(Expiry|null, today: { year, month, day }) -> ExpiryWindow
```

## Agent flow
draft plan -> parse expiry -> classify -> apply safety rules and notice -> speak.

## Open decisions
- The problem statement's example says "Expires in three months", but this change gives no notice beyond one month. As written, only the notice is limited: the identification answer in `medicine-label-reading` still states the expiry. If identification should leave expiry out too, that requirement and the traceability departures must change.
- Should "When does it expire?" get the printed date however far off it is? Recommendation: yes.

## Risks
- A wrong device date gives the wrong result.
- A misread month or year gives the wrong result. Two-copy agreement reduces this risk but does not remove it.
