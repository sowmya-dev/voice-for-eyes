# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. label-image-processing

- [x] 1.1 [Requirement: Multi-frame cleanup] Implement sharpness ranking, alignment and averaging. Verify: "Shaky capture".
- [x] 1.2 [Requirement: Image enhancement] Implement denoise, CLAHE, sharpen and 2x upscale. Verify: "Enhanced copy".
- [x] 1.3 [Requirement: Embossed text copy] Generate the binarised copy. Verify: "Embossed expiry".
- [x] 1.4 [Requirement: Two-copy agreement] Run OCR on every copy and implement field agreement with unit tests. Verify: "Agreement", "No agreement".
- [ ] 1.5 [Requirement: Difficult labels] Collect blurred, glared and embossed sample strips with known values and run the accuracy check. Verify: "Sample strips".
- [x] 1.6 [Requirement: Turned label] Find each missing field at its own turn, confirmed by a second copy, keep upright fields and map boxes back to camera orientation, with tests. Verify: "Upside-down strip", "Sideways strip", "Upright strip", "Vertical name, horizontal expiry".
- [x] 1.7 [Requirement: Shake with rotation] Align frames with rotation-aware ECC, falling back to shift-only alignment, with tests. Verify: "Tilting hand", "Alignment fails".
- [x] 1.8 [Requirement: Colour frames for counting] Send the two sharpest original colour frames for counting and require agreement, with tests. Verify: "Counted from colour frames", "Frames disagree", "Empty pockets agree".
- [x] 1.9 [Requirement: Strip model chain] Try listed models in order with class renaming, with tests. Verify: "First model finds nothing", "Class names mapped", "No model finds a strip".
- [ ] 1.10 [Requirement: Count needs a full pocket] Reject counts with no full pocket or no strip outline, with tests. Verify: "Model without a full-pocket class", "Full pockets found", "No outline, no count".
- [ ] 1.11 [Requirement: Pills found by name] Add the `sam3` detector adapter, chosen and never the default: the strip outline, pills counted only inside it and at 0.7 or more, no result for more than one strip, with tests on the saved SAM 3 replies. Verify: "Pills on the strip", "Picture on the box", "Used pockets below the bar", "More than one strip", "Chosen, not the default".
- [ ] 1.12 [Requirement: Second opinion on a count] Accept a frame's count only when two detectors joined by `+` give the same number inside the outline, with tests. Verify: "Both agree", "They disagree", "One has no answer".
- [ ] 1.13 [Requirement: Molmo points at the pills] Blocked until a provider serves Molmo and its reply format has been seen (design decision 20): add the `molmo` adapter, reading points only, with tests. Verify: "Molmo points", "Reply that is not points".
