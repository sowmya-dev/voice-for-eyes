# Proposal: cloud-assistance

## Why
Some tasks need help that the device cannot give, but only with the user's consent and never for safety.

## What Changes
- A toggle that is off by default, using OpenRouter from the app server (the prompt named LiteLLM; see D11).
- A "key not set" state, limited cloud tasks and no safety or dosage answers.
- Proposed, not built: one more cloud task, pointing at the tablets in a strip photo for a count, whose reply is counted and never spoken.

## Capabilities

### New Capabilities
- `cloud-assistance`: see [`specs/cloud-assistance/spec.md`](specs/cloud-assistance/spec.md).

### Modified Capabilities
None.

## Impact
New behaviour; no archived specs are affected. Source mapping: [`openspec/traceability.md`](../../traceability.md).
