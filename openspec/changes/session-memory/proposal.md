# Proposal: session-memory

## Why
Follow-ups and repeated questions need the current session's context, without keeping it.

## What Changes
- RAM-only memory of the last label and a question-answer queue.
- Replay of answers to repeated questions about the same label.

## Capabilities

### New Capabilities
- `session-memory`: see [`specs/session-memory/spec.md`](specs/session-memory/spec.md).

### Modified Capabilities
None.

## Impact
New behaviour; no archived specs are affected. Source mapping: [`openspec/traceability.md`](../../traceability.md).
