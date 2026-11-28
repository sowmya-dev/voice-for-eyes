# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. label-image-processing

- [x] 1.1 [Requirement: Multi-frame cleanup] Implement sharpness ranking, alignment and averaging. Verify: "Shaky capture".
- [x] 1.2 [Requirement: Image enhancement] Implement denoise, CLAHE, sharpen and 2x upscale. Verify: "Enhanced copy".
- [x] 1.3 [Requirement: Embossed text copy] Generate the binarised copy. Verify: "Embossed expiry".
- [x] 1.4 [Requirement: Two-copy agreement] Run OCR on every copy and implement field agreement with unit tests. Verify: "Agreement", "No agreement".
- [ ] 1.5 [Requirement: Difficult labels] Collect blurred, glared and embossed sample strips with known values and run the accuracy check. Verify: "Sample strips".
- [x] 1.6 [Requirement: Turned label] Read turned copies only when the upright reading is incomplete, pick the turn with the most confident text and map boxes back to camera orientation, with tests. Verify: "Upside-down strip", "Sideways strip", "Upright strip".
- [x] 1.7 [Requirement: Shake with rotation] Align frames with rotation-aware ECC, falling back to shift-only alignment, with tests. Verify: "Tilting hand", "Alignment fails".
- [x] 1.8 [Requirement: Colour frames for counting] Send the two sharpest original colour frames for counting and require agreement, with tests. Verify: "Counted from colour frames", "Frames disagree".
- [x] 1.9 [Requirement: Strip model chain] Try listed models in order with class renaming, with tests. Verify: "First model finds nothing", "Class names mapped", "No model finds a strip".
- [x] 1.10 [Requirement: Count needs a full pocket] Reject counts with no full pocket, with tests. Verify: "Model without a full-pocket class", "Full pockets found".
