# Proposal: failure-recovery

## Why
Noise, mishearing and blur are normal for these users and need predictable, honest recovery.

## What Changes
- Noisy and misheard speech recovery in fixed steps: ask to repeat or move somewhere quieter, share what the label shows, confirm the likely request.
- Five-second cleaning before any request to move the medicine (17 seconds once part of the label is read), with exact wording and no guessing.
- One exact movement direction, and at most 3 requests of any kind for a question, then the landing screen.
- One request for a count, then an honest answer about what was seen.
- That one request is made once per strip in a session, and more than one strip in view asks for just one.

## Capabilities

### New Capabilities
- `failure-recovery`: see [`specs/failure-recovery/spec.md`](specs/failure-recovery/spec.md).

### Modified Capabilities
None.

## Impact
New behaviour; no archived specs are affected. Source mapping: [`openspec/traceability.md`](../../traceability.md).
