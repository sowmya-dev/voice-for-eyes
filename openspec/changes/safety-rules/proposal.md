# Proposal: safety-rules

## Why
A wrong expiry or dosage answer can harm a user who cannot check the label.

## What Changes
- Deterministic rule engine for label-only expiry and dosage answers.
- Expired warning, no dosage for expired medicine and risk confirmation.

## Capabilities

### New Capabilities
- `safety-rules`: see [`specs/safety-rules/spec.md`](specs/safety-rules/spec.md).

### Modified Capabilities
None.

## Impact
New behaviour; no archived specs are affected. Source mapping: [`openspec/traceability.md`](../../traceability.md).
