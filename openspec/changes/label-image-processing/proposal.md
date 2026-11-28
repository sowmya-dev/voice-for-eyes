# Proposal: label-image-processing

## Why
Shaky hands, blur, glare and embossed print make single photos unreliable.

## What Changes
- Five-frame cleanup, enhancement and a binarised copy.
- OCR on every processed copy, with a value accepted only when two copies agree.
- A turned or upside-down label is read, each field at its own direction, and shaky frames are lined up for small turns.
- Tablets are counted from the two sharpest colour frames, through a chain of strip models, and no count is given unless the whole strip and a full pocket are seen.
- Pills and the strip outline can be found by name on any kind of strip, by a detector that is chosen in the settings and is not the default.
- Proposed, not built: Molmo as a second opinion before a count is spoken, switched on only after a trial on hand-counted photos.

## Capabilities

### New Capabilities
- `label-image-processing`: see [`specs/label-image-processing/spec.md`](specs/label-image-processing/spec.md).

### Modified Capabilities
None.

## Impact
New behaviour; no archived specs are affected. Source mapping: [`openspec/traceability.md`](../../traceability.md).
