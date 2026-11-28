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

### 4. One remembered label, gathered across reads
- **Status:** Agreed (user, 2026-11-28: "gather as much contents as it can from the strip ... save the contents in memory and answer back")
- **Plain English:** Every read adds what it found to one remembered label, so the name from the front and the expiry from the back add up. Follow-up questions are answered from it straight away. It is kept until "start over"; asking what a tablet is takes one look, and only a different strip replaces it. A different name means a different strip, so the remembered label is dropped.
- **Pseudo-technical:** `label = read if read.name or read.expiry differs from label's else merge(label, read); complete(label) = name && expiry; ask(q): if label.complete: q.aspect == 'all' ? (look once; differs ? new label : label) : answer(label) else read camera`

### 5. Count in the background
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Once the label is complete, the tablets are counted once without making the user wait, and the count is kept for "How many are left?". Saying a tablet was taken forgets it.
- **Pseudo-technical:** `on complete: if countTablets: countTablets().then(c => label.count = c); on 'took': label.count = null`

### 6. One background count per strip
- **Status:** Agreed (user, 2026-11-29: "kick off dev, will take the 3 decisions later"), after the user reported on 2026-11-28 that the app still asks to show the strip again and again
- **Plain English:** The silent count after a label is read was repeated after every answer for as long as it found nothing. That spent two strip-model calls each time and achieved nothing. It is tried once per strip; a new try needs a reason: the user took a tablet, asks for the count, or shows a different strip.
- **Pseudo-technical:** `entry.countTried = true on the first background count; countInBackground() returns at once when entry.countTried; cleared on 'took', on a count question, and when mergeReading starts a new strip`

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
- A strip swapped for one with the same name and expiry keeps the first strip's count until "start over" or "I took one".
