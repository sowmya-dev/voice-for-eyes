# Proposal: session-memory

## Why
Follow-ups and repeated questions need the current session's context, without keeping it.

## What Changes
- RAM-only memory of the last label and a question-answer queue.
- Replay of answers to repeated questions about the same label.
- One remembered label, gathered across reads and kept until "start over", from which every later question about the strip is answered.
- A count taken once in the background and kept with the label; general follow-up questions carry the recent general answers.
- Proposed, not built: that background count is tried once per strip, not after every answer.

## Capabilities

### New Capabilities
- `session-memory`: see [`specs/session-memory/spec.md`](specs/session-memory/spec.md).

### Modified Capabilities
None.

## Impact
New behaviour; no archived specs are affected. Source mapping: [`openspec/traceability.md`](../../traceability.md).
