# Proposal: ui-screens

## Why
Blind and low-vision users hear every answer, but sighted helpers and low-vision users also need a clear, readable screen that shows the same state. The VoAI design export defines those screens, their look and how voice moves between them.

## What Changes
- Build the web client's screens from the VoAI design export in [`docs/design/voai/`](../../../docs/design/voai/).
- Use its colour, type and component rules, its phone layout and its accessibility rules.
- Let the voice layer, not buttons, decide which screen is shown, with global voice commands, a task gate and pause and resume.
- Show interface text in the session language.

## Capabilities

### New Capabilities
- `ui-screens`: see [`specs/ui-screens/spec.md`](specs/ui-screens/spec.md).

### Modified Capabilities
None.

## Impact
Replaces the start page in `web/index.html`. The screens show what other changes decide; they never decide medicine answers themselves. Where the design export differs from an agreed spec, the agreed spec wins until the difference is settled (see `design.md`, Open decisions). Source: user decision on 2026-11-28, recorded in [`openspec/traceability.md`](../../traceability.md).
