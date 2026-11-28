# Proposal: expiry-soon-warning

## Why
A user who cannot see the label needs to know that a medicine is about to expire, without hearing a notice when expiry is far off.

## What Changes
- Work out how long is left from the expiry date read on the label.
- Tell the user when a medicine expires within 7 days, or within one month.
- Give no notice when more than one month is left.

## Capabilities

### New Capabilities
- `expiry-soon-warning`: see [`specs/expiry-soon-warning/spec.md`](specs/expiry-soon-warning/spec.md).

### Modified Capabilities
None.

## Impact
Builds on `safety-rules`, which already covers the "EXP" marker, no guessed dates and expired medicine. Those requirements are not changed or repeated here. These requirements come from a user decision on 2026-11-28, not from the problem statement. See [`openspec/traceability.md`](../../traceability.md).
