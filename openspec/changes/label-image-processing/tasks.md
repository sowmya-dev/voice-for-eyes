# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. label-image-processing

- [x] 1.1 [Requirement: Multi-frame cleanup] Implement sharpness ranking, alignment and averaging. Verify: "Shaky capture".
- [x] 1.2 [Requirement: Image enhancement] Implement denoise, CLAHE, sharpen and 2x upscale. Verify: "Enhanced copy".
- [x] 1.3 [Requirement: Embossed text copy] Generate the binarised copy. Verify: "Embossed expiry".
- [x] 1.4 [Requirement: Two-copy agreement] Run OCR on every copy and implement field agreement with unit tests. Verify: "Agreement", "No agreement".
- [ ] 1.5 [Requirement: Difficult labels] Collect blurred, glared and embossed sample strips with known values and run the accuracy check. Verify: "Sample strips".
