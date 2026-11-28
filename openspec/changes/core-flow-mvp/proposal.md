# Proposal: core-flow-mvp

Status: build order only (option B), settled on 2026-11-28 when the user asked to build the core flow and allowed individual tasks to be executed from each change.

Build go-ahead: on 2026-11-28 the user asked for the core flow to be built and was away during the build. The code follows the Proposed design decisions as written. Their statuses stay Proposed until a person reviews them, which is a recorded exception to the apply guidance.

## Why
The core experience must work before the other features: a blind user asks by voice, the camera reads the strip, and the assistant tells them about the medicine or says honestly that it cannot.

## What Changes
- Invoke the assistant by voice.
- Read the medicine strip with the camera and analyse it.
- Speak the medicine details.
- Handle the failures of this flow.
- Keep a conversational loop for the next question.

## Capabilities

### New Capabilities
- `core-flow-mvp`: the first working end-to-end voice and camera loop.

### Modified Capabilities
None.

## Impact
This change is built first. It depends on requirements now held by other changes. Ground rules G2 and G3 allow each requirement only one owner and one task, so those requirements must not be copied here.

## Ownership decision (settled: B)
- **A. Move (recommended):** move each requirement the MVP builds out of its feature change into this change. The feature changes keep what comes after the MVP. Any change left with no requirements is removed.
- **B. Order only:** this change holds no requirements of its own and the MVP is a build order across the feature changes. OpenSpec rejects a change without specs unless it is marked as having none, and the MVP would not be a feature change of its own.
- **C. Integration only:** this change adds only new end-to-end requirements that connect the others. The MVP then cannot ship until parts of several changes are built.

## Candidate requirements for option A
- voice-interaction: Automatic start, Continuous listening and mute, Interruption, Uninterrupted capture, Rule-based intent routing, Single interaction pipeline
- label-image-processing: Multi-frame cleanup, Image enhancement, Embossed text copy, Two-copy agreement
- medicine-label-reading: Identify medicine, Purpose from bundled table, Printed information only, Spoken templates and voice, Admit what is unreadable
- safety-rules: all requirements, because identification reads out expiry
- failure-recovery: all requirements

Under option A, failure-recovery and safety-rules would have nothing left. Languages in the MVP also need to be chosen.
