# Proposal: label-reading-screen

## Why
Today the app reads the label while the landing page is still showing, with the camera hidden. In a browser check on 2026-11-28, reading began while the user was still speaking, and the landing page then showed "Reading the label…" for more than 15 seconds. The user, or someone helping, cannot see the camera to line up the strip, and the page looks stuck. The user asked that the app first understand the question, then move to a label-reading screen.

## What Changes
- The landing page waits for a question. It no longer reads the label.
- When an understood request needs the label, the app moves to a label-reading screen that shows the camera and what was asked.
- The label is read only after that move, and the result replaces the screen.
- Reading no longer starts while the user is still speaking, so answers arrive somewhat later than before.

## Capabilities

### New Capabilities
- `label-reading-screen`: see [`specs/label-reading-screen/spec.md`](specs/label-reading-screen/spec.md).

### Modified Capabilities
None.

## Impact
Changes which screen shows while a label is read. The `ui-screens` spec, design and proposal are not edited: its screens keep their content, and this change adds one screen between a question and its result. It comes from a user request on 2026-11-28, not from the problem statement; see [`openspec/traceability.md`](../../traceability.md).
