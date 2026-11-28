# Proposal: faster-label-reading

## Why
The user reported a lot of lag after asking a question. In a measurement on 2026-11-28 on the user's laptop, reading the text of one strip took 10 to 18 seconds, far longer than every other step.

## What Changes
- Read label text on the graphics chip when the device has one that works.
- Fall back to the current way of reading when it does not.
- Spend less time collecting camera frames.

## Capabilities

### New Capabilities
- `faster-label-reading`: see [`specs/faster-label-reading/spec.md`](specs/faster-label-reading/spec.md).

### Modified Capabilities
None.

## Impact
The same models run on the user's device, and the two-copy and safety rules do not change. See [`openspec/traceability.md`](../../traceability.md).
