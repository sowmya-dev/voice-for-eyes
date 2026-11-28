# Design: session-memory

## Context
Last stage of the pipeline. See [`proposal.md`](proposal.md) for the motivation.

**As built (2026-11-28):** Only identification, expiry and dosage answers are replayed. Count and safety-event answers are worked out again, because replaying an old count or symptom reply could be wrong; task 1.2 stays open until that is agreed.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Plain in-memory objects
- **Status:** Proposed
- **Plain English:** Nothing about the session is written to storage.
- **Pseudo-technical:** `memory = { lastLabel, queue[] }; no localStorage, IndexedDB or cache`

### 2. Same question means same label, intent and wording
- **Status:** Proposed
- **Plain English:** An answer is reused only for the same question about the same medicine.
- **Pseudo-technical:** `key = labelId + intent + normalise(text); no labelId means no replay`

### 3. Replays are checked again
- **Status:** Proposed
- **Plain English:** A replayed answer still passes the safety rules.
- **Pseudo-technical:** `plan = memory.get(key); verdict = safety.evaluate(plan, lastLabel, today)`

## High-level architecture flow
```text
intent + current label -> memory lookup --hit--> rule engine -> speech
                              --miss-> build answer -> rule engine -> speech -> store
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| SessionMemory | holds the last label and queue | read before the AnswerBuilder, written after speech |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
MemoryEntry   = { labelId: string, questionKey: string, plan: ResponsePlan, askedAt: ms }
SessionMemory = { lastLabel: LabelReading|null, queue: MemoryEntry[] }
```

## Tool schemas
```text
memory.find(labelId, questionKey) -> MemoryEntry|null
memory.store(MemoryEntry) -> void
```

## Agent flow
before composing: confirm the current label -> look up -> replay or build -> store.

## Open decisions
- The queue has no size limit in the prompt. Recommendation: keep the last 20 entries.
- Whether a differently worded question counts as repeated. Recommendation: only the same intent and normalised wording.

## Risks
- A new strip mistaken for the old one would replay the wrong answer. Mitigation: read the current label before replaying.
