# Design: label-image-processing

## Context
Turns camera frames into trusted label fields. `mvp/VoiceLoop.kt` returns a hard-coded label string and is not reused. See [`proposal.md`](proposal.md) for the motivation.

**As built (2026-11-28):** Built: 7 frames, top 5 by Laplacian variance, shift-only alignment by template match, bilateral filter (OpenCV.js has no non-local-means), CLAHE, unsharp mask, 2x, adaptive threshold, in a web worker; PP-OCRv5 Mobile through `@paddleocr/paddleocr-js` with detection capped at 736 px on 4 WASM threads. On a 12-thread laptop in headless Chrome one read takes about 10 s (about 2.5 s per copy). Not built: the YOLOv8n model (no trained weights). The Roboflow projects checked on 2026-11-28 cannot count tablets: SASTRA blister_pack_28th_aug_2023 v1 has only defect and empty-pocket classes, blister packet identification has 3 images and no model, and blister-pack-9t2sb is labelled by drug name. The fallback endpoint is built but stays off until ROBOFLOW_MODEL_ID names a model with the classes medicine_strip, full_cavity and empty_cavity.

**Fallbacks for turned, shaken and uncounted strips (2026-11-28):** built at the user's request ("Fix things now"); decisions 12-16 below. Causes found on 2026-11-28, from the code (no captured frames were available):
- OCR (PP-OCRv5 mobile det + rec) has no orientation step, so it reads only upright text lines. Taking a photo re-runs the same OCR, so it fails the same way.
- Frames were aligned by shift only (`cleanup.js`, marked as a shortcut), so a tilting hand blurred the averaged copy.
- Counting sent the cleaned black-and-white copies (one upscaled 2x) to a model trained on colour photos.
- The configured model `blister-strips-defect-detection/2` has the classes `strip`, `missing`, `broken`, `cracked`. None matched ours, so every prediction was dropped. It has no full-pocket class, so no renaming can make it count.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Three processed copies
- **Status:** Proposed
- **Plain English:** We read the averaged, enhanced and black-and-white versions of the same capture.
- **Pseudo-technical:** `copies = [average(top5), enhance(average), binarise(enhance(average))]`

### 2. Agreement is per field, after normalising
- **Status:** Proposed
- **Plain English:** A value counts only if two copies read the same thing.
- **Pseudo-technical:** `accepted[f] = v if count(copies where normalise(read[f]) == v) >= 2 else null; normalise changes spacing and case only, never digits`

### 3. Unaccepted means unknown
- **Status:** Proposed
- **Plain English:** A field that fails agreement is never passed on as a guess.
- **Pseudo-technical:** `LabelReading holds null for it; raw OCR text is never spoken as a field value`

### 4. Image work runs off the main thread
- **Status:** Proposed
- **Plain English:** Cleaning must not freeze the camera preview.
- **Pseudo-technical:** `web worker: process(frames) with a 5 second cleaning budget`

### 5. One combined YOLOv8n model
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** One small model, run in the browser, finds the strip, its printed text, its expiry and each full and empty pocket. Medicine images stay on the phone.
- **Pseudo-technical:** `YOLOv8n-seg (detection boxes + masks) -> ONNX -> ONNX Runtime Web (web worker); classes = [medicine_strip, medicine_label, expiry_label, full_cavity, empty_cavity]`

### 6. Classes
- **Status:** Agreed (user, 2026-11-28)

| Class | What it marks | Used for |
|---|---|---|
| `medicine_strip` | The entire outer boundary of the strip | Whole strip visible or not |
| `medicine_label` | Printed text on the strip | Tells the app where to read; PaddleOCR reads it |
| `expiry_label` | The expiry date area, usually on the back | Tells the app where to read the expiry; PaddleOCR reads it |
| `full_cavity` | A pocket that still holds a tablet or capsule | Tablets left = number of full pockets |
| `empty_cavity` | A punctured or empty pocket | Capacity = full + empty; empty = capacity - full, a check on the count |

- YOLO only finds where text is. The medicine name and expiry values still come only from PaddleOCR with two-copy agreement and the "EXP" marker, never from a model's class.

### 7. Training data
- **Status:** Proposed (the user asked to combine the datasets if feasible)
- **Plain English:** Train the one model on the SASTRA blister data together with segmentation data, relabelled to the five classes, plus our own photos of Indian strips.
- **Pseudo-technical:** `SASTRA blister_pack_28th_aug_2023 (YOLO exports) + SASTRA blister packet identification + Blister package identification system detection and segmentation sets -> relabel to 5 classes (expiry_label needs new labels on strip backs) -> fine-tune YOLOv8n-seg`

### 8. Camera first, then the strip
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** The app first checks the camera. If pictures are blurry, hazy or the phone is held badly, it tells the user to fix the camera. Once the camera is steady, it guides the user to move the medicine strip.
- **Pseudo-technical:** `phase = camera until (sharp and clear and steady); then phase = strip
camera cues: "hold the phone still" (motion blur), "please wipe the camera lens" (haze after cleaning and a retry), "point the camera at the medicine" (camera tilted or facing away)`

### 9. VizLens-style strip cues, one direction at a time
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** In the strip phase, the app gives one short spoken cue at a time: sideways first, then up or down, then closer or farther. Near the right place it adds "slowly", for example "Left slowly". Directions are for moving the medicine, as the user sees it.
- **Pseudo-technical:** `order = [horizontal, vertical, distance]; cue = first step not yet in place; slowly = within the near margin; re-check after each cue`

### 10. Frame checks in the strip phase
- **Status:** Proposed (rules and starting values supplied by the user on 2026-11-28)

| Detection | Meaning | Spoken cue |
|---|---|---|
| No `medicine_strip` | Strip out of view | "No medicine strip found. Place the strip in front of the camera." |
| `medicine_strip` or `medicine_label` box within 15 px of an edge | Part of the strip or label is cut off | One direction that brings it back: the medicine moves away from that edge (decision 9; left and right swap for a front camera), or "farther" if it touches opposite edges |
| `medicine_strip` under 20% of the frame | Too far to read or count | "Move closer." |
| No `expiry_label` when the expiry is needed | Expiry is on the back or hidden | "Turn the strip over." |
| Whole strip inside the margins | Strip and label fully visible | Lock the frame, count `full_cavity` ("X tablets left") and read the label |

- **Pseudo-technical:** `edge = box.x <= 15 or box.x + box.w >= width - 15 (same for y); tooSmall = strip.area < 0.20 * frame.area; tuned from test photos`

### 11. Roboflow fallback
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** YOLOv8n in the browser comes first. If it cannot give a result, the backend sends the frame to the SASTRA blister classification and segmentation models on Roboflow. They only find the strip and pockets; the name and expiry are still read by PaddleOCR on the phone.
- **Pseudo-technical:** `result = yolo.detect(copy); if result is unavailable (model failed to load, error, or no medicine_strip while the camera check passes): result = POST /api/vision/fallback -> FastAPI -> inference_sdk.InferenceHTTPClient(api_key=env ROBOFLOW_API_KEY).infer(frame, model_id) -> mapped to StripDetection; two-copy count agreement still applies`

### 12. Turned copies only when the upright read is incomplete
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** If the name or expiry is missing, the app tries the label turned a quarter, half and three-quarters of the way round, keeps the turn that finds the most confident text, and reads every copy at that turn. A label read upright costs nothing extra.
- **Pseudo-technical:** `if !(reading.name && reading.expiry): best = argmax_k sum(score*len) over OCR(rotate(enhanced, k)) for k in {1,2,3}; if best beats upright: re-read all copies at k; boxes mapped back with unrotate(point, k, w, h)`

### 13. Mirror images are not tried
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** "Flipped" means turned over or upside down. Turning over shows the other side, which is a different label, and upside down is the 180 degree turn. The camera never mirrors frames, so mirrored text cannot occur.
- **Pseudo-technical:** `orientations = {0, 90, 180, 270}; no horizontal flip`

### 14. Rotation-aware alignment with a safe fallback
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Frames are lined up for small turns as well as shifts. If that fails, the old shift-only lining up is used.
- **Pseudo-technical:** `warp = translation from matchTemplate; try findTransformECC(MOTION_EUCLIDEAN, init=warp, 50 iterations, 1e-4) on the 320px copy, scale the shift back; catch -> translation only`

### 15. Colour frames for counting
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** The strip model gets the two sharpest camera frames as they were captured, in colour, and both must give the same count.
- **Pseudo-technical:** `frames copied before transfer to the cleanup worker; send frames[used[0]], frames[used[1]] as JPEG; count = c0 if c0 != null and c0 == c1`

### 16. Model chain with class renaming, and no count without a full pocket
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Several strip models can be listed and are tried in order. Their class names can be renamed to ours. A count is only spoken when at least one full pocket is seen, so a model that cannot see tablets can never say "zero".
- **Pseudo-technical:** `for model in ROBOFLOW_MODEL_ID.split(','): r = to_strip_result(rename(predictions, ROBOFLOW_CLASS_MAP)); if r.strip and (r.full or r.empty): return r; reliableCount requires full.length >= 1`

## High-level architecture flow
```text
camera frames -> sharpness ranking -> top 5 -> align + average -> [averaged]
                  [averaged] -> denoise -> CLAHE -> sharpen -> 2x -> [enhanced] -> [binarised]
                  3 copies -> OCR each -> field extraction -> two-copy agreement -> LabelReading
camera frames -> sharpness, haze, motion -> camera cue (until the camera is fixed)
[averaged], [enhanced] -> YOLOv8n-seg -> strip, label, expiry, cavities -> whole-strip check + count agreement
boxes + OCR -> strip cue (one direction at a time) or lock frame
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| FrameSelector | Laplacian variance ranking | feeds ImageCleaner |
| ImageCleaner | OpenCV.js alignment, averaging and enhancement | returns ProcessedCopy list |
| OcrReader | runs OCR on one copy | returns OcrLine list |
| FieldAgreement | extracts fields and applies agreement | returns LabelReading |
| BlisterModel | YOLOv8n-seg in ONNX Runtime Web | returns StripDetection per copy |
| CameraCheck | blur, haze and motion checks | gives camera cues before strip cues |
| RoboflowFallback | FastAPI endpoint calling Roboflow with inference-sdk | used only when BlisterModel gives no result |
| CountAgreement | accepts a count only when two copies match | fills LabelReading.visibleCount |
| GuidanceAdvisor | picks the next cue from boxes and sharpness | gives GuidanceCue to failure-recovery |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
Frame         = { id: int, capturedAt: ms, pixels: ImageData, sharpness?: number }
ProcessedCopy = { kind: 'averaged'|'enhanced'|'binarised', pixels: ImageData }
OcrLine       = { copy: ProcessedCopy.kind, text: string, box: [x,y,w,h], confidence: 0..1 }
AcceptedField = { value: string, agreeingCopies: kind[] (length >= 2) } | null
LabelReading  = { labelId: string|null, name: AcceptedField, ingredient: AcceptedField, expiryText: AcceptedField,
                  dosageText: AcceptedField, countText: AcceptedField, lines: OcrLine[], cleanedForMs: int,
                  visibleCount: int|null, wholeStrip: bool|null }
StripDetection = { copy: ProcessedCopy.kind, strip: Box|null, label: Box|null, expiry: Box|null, full: Mask[], empty: Mask[] }
Mask           = { box: Box, points: [x,y][], score: 0..1 }
Box            = { x, y, w, h, score: 0..1 }   (pixels of the frame)
GuidanceCue    = { phase: 'camera'|'strip',
                   action: 'hold_still'|'wipe_lens'|'point_camera'|'left'|'right'|'up'|'down'|'closer'|'farther'|'turn_over'|'place_strip',
                   slowly: bool, reason: 'blurry'|'hazy'|'not_aimed'|'no_strip'|'strip_cut_off'|'label_cut_off'|'no_expiry'|'too_small'|'too_large' }
```

## Tool schemas
```text
image.selectSharpest(Frame[], n=5) -> Frame[]
image.clean(Frame[]) -> ProcessedCopy[]
ocr.read(ProcessedCopy) -> OcrLine[]
label.agree(OcrLine[]) -> LabelReading
blister.detect(ProcessedCopy) -> StripDetection
vision.fallback(Frame) -> StripDetection   (POST /api/vision/fallback; needs network and ROBOFLOW_API_KEY)
camera.check(Frame[]) -> GuidanceCue|null
strip.count(StripDetection[]) -> { visibleCount: int|null, wholeStrip: bool|null }
guidance.next(StripDetection, OcrLine[]) -> GuidanceCue|null
```

## Agent flow
On a turn that needs the label: collect frames -> select -> clean -> read each copy -> agree -> hand LabelReading to the cross-check and rule engine.

## Open decisions
- Roboflow model IDs and versions for the SASTRA classification and segmentation models, and how their classes map to the five classes. A classification model gives no boxes, so it cannot check the whole strip or count pockets on its own.
- When to fall back: the trigger above is Proposed. A low-confidence trigger needs a value from test photos.
- Labels are usually printed in English (user, 2026-11-28). Recommendation: use PaddleOCR's English model first. The user reports PaddleOCR runs in a browser; speed on a phone is not measured.
- Cut strips: no existing model was found that tells a cut edge from the frame edge. Evaluate adding a `cut_edge` class to the detector.
- The back camera must be tested so "left" means the user's left.
- How to tell a phone held badly (tilted, facing away) from no strip in view. Proposed: device motion and orientation where the browser allows it.
- The SASTRA and Blister package identification system data are not verified: licence, classes, accuracy, and whether the weights can be exported to ONNX. Roboflow's hosted API would send medicine images off the phone, so only exported weights run in the browser.
- The 10-30 ms per frame figure is for native mobile runtimes. Browser speed is not measured; checking every frame may need a lower rate.
- The "slowly" margin, the haze and motion limits, and the 15 px and 20% values: set from test photos.
- `ingredient` is needed for the purpose lookup but is not in the prompt's list of agreed fields. Recommendation: require two-copy agreement for it too.
- The rule for building labelId is shared with session-memory. Recommendation: derive it from the accepted name and expiry.
- Whether a cloud vision model (OpenRouter or Claude) should be a last fallback for counting. That would reverse D11 ("medicine questions never go to the cloud"); the user asked not to use Claude for now.
- Whether counting should also try turned frames. Detection models are usually trained with rotations, and each try uses a rate-limited call.
- A strip model with full and empty pocket classes is still needed; the current model cannot count.

## Risks
- The fallback sends medicine photos off the phone to Roboflow, and needs a network and a key.
- Public blister images may not look like Indian strips, so the detector could miss pockets or the strip edge. Mitigation: add our own photos, and state no count when two copies disagree.
- Foil glare can look like an empty pocket. Mitigation: test glared strips.
- All copies come from the same frames, so they can agree on the same misread. Mitigation: test on strips with known values.
- OpenCV.js and OCR may be too slow in a phone browser. Prerequisite spike: measure time and accuracy on sample strips.
- Reading turned copies adds up to six OCR runs on the failure path, which is slow on low-end phones.
- ECC can converge to a wrong alignment on low-texture frames; the averaged copy may then be blurrier. The sharpest frame still leads the average.
- Each listed model is a separate Roboflow call, so a long list is slower and uses more credits.
