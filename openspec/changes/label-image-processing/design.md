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

### 12. Orientation per field
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** One strip can print the name running down its length in bold colour and the expiry across it, so there is no single "right way up". Whatever reads upright is kept. For anything still missing, the app reads the picture turned a quarter, half and three-quarters of the way round, and when a turn shows the missing name or expiry, a second copy at that turn must agree before it is accepted.
- **Pseudo-technical:** `missing = [f in (name, expiry) if !upright[f]]; if missing: probes[k] = OCR(rotate(averaged, k)) for k in {1,2,3}; for f in missing: for k where fields(probes[k])[f] (most text first): confirm = OCR(rotate(enhanced, k)); if agree(probes[k], confirm)[f]: take every still-missing field from that agreement, stop; boxes mapped back with unrotate(point, k, w, h)`

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

### 17. The configured model sees used cells, not full ones
- **Status:** Agreed (user, 2026-11-28: "OCR + blister should work together")
- **Plain English:** Measured on 2026-11-28 on the model's own 105 held-out images (test and valid): `blister-strips-defect-detection/2` labels `missing` (an empty, used cell), `cracked` (a cracked pill still in its pocket) and `broken` (a broken or cut-off pill); it has no full-pocket class, and its `strip` labels were added after version 2 was trained, so it never finds the strip. Its number of empty cells per image was exact on 96/105 at 0.5 confidence and 98/105 at 0.7 (the other 7 one too many, never too few). So it is used for empty cells only: `ROBOFLOW_CLASS_MAP=missing=empty_cavity`, confidence 0.7, and the count is the printed total minus the empty cells.
- **Pseudo-technical:** `to_strip_result(minimum=0.7); chain accepts the first model with full or empty pockets; countFrames -> { count: agreed full count (whole strip), empty: agreed empty count }`

### 18. Find pills by name: SAM 3 measured, Molmo next in line
- **Status:** Proposed (user, 2026-11-28: "Next in line is to try Molmo from Openrouter"). Nothing is built.
- **Plain English:** The trained strip model sees only used pockets, on one kind of strip, and Google Cloud Vision's object detection sees no pills at all (4 "Coin" on a strip of 10). A detector that is told what to look for works on any strip. SAM 3 on Roboflow was measured on 12 hand-counted photos (decision 20). It outlined every one of the 15 strips in the 8 varied photos and never took a box for a strip, which also answers "is the whole strip in view". With pills counted only inside the outline and above 0.7 it was exact on 8 of the 10 strips whose pills show through clear pockets; it left out loose pills, capsules printed on a box and printed foil backs; it missed one strip of flat red tablets completely; and it was confidently wrong once: on a half-used strip it scored the 5 torn-open pockets 0.82-0.88, as high as real tablets, and would have said 10 for 5. So it is good at the outline and usually right on the number, but not safe alone. Molmo is built to point at and count things, so it is the next to try, as the second opinion.
- **Pseudo-technical:** `sam3: POST {ROBOFLOW_API_URL}/sam3/concept_segment {model_id: sam3/sam3_final, prompts: [{type: text, text: "pill"}, {type: text, text: "blister pack"}], output_prob_thresh: 0.5, format: polygon} -> prompt_results[i].predictions[j] = {masks: polygons, confidence}; strip = the one "blister pack" outline; full = pills with confidence >= 0.7 whose centre is inside it; empty = []. molmo: OpenRouter chat/completions {model: allenai/molmo-2-8b:free, user: [text "Point to each pill that is still in the blister pack.", image]} -> its point markup parsed -> one full pocket per point; strip = null`

### 19. A second opinion before a count is spoken
- **Status:** Proposed
- **Plain English:** One model can be confidently wrong, as SAM 3 was on the half-used strip, and the user cannot check the number. Two different models making the same mistake on the same photo is much less likely. With `sam3+molmo`, SAM 3 gives the strip outline and its number of pills, Molmo gives its points, and a count is used only when the two numbers match inside the outline. Otherwise the app says it cannot count, which is the safe answer. Whether this pair is used, or neither, is decided by the trial.
- **Pseudo-technical:** `a = sam3(frame); b = molmo(frame); n = points of b inside a.strip; frame count = len(a.full) if a.strip and n >= 1 and len(a.full) == n else null; the two sharpest frames must still give the same count`

### 20. The trial that gates any new counter
- **Status:** Proposed. Step 1 is blocked: on 2026-11-28 OpenRouter knew `allenai/molmo-2-8b:free` and `allenai/molmo-2-8b` ("AllenAI: Molmo2 8B", image and video in, text out) but listed 0 serving endpoints for both and left them out of its public model list, so a request would fail until a provider serves the model.
- **Plain English:** Before a counter is switched on, it is run once on the same 12 hand-counted photos. It may say "I can't count this", but it must never state a wrong number. SAM 3 has been run (12 calls); Molmo is next, as soon as it is being served.
- **Pseudo-technical:** `1. GET openrouter.ai/api/v1/models/{id}/endpoints has at least one endpoint, else stop (no key is used for this check). 2. One call per photo per detector, replies saved under trial/, so no photo is asked twice: at most 12 calls each. 3. Per strip: exact | no count | wrong against the hand count, pills counted inside the SAM 3 outline. 4. Switched on by default only if: 0 wrong on any strip; exact on at least 8 of the 10 clear-pocket strips in C1-C8; no loose pill or printed picture counted; a count from two frames within 10 seconds. 5. The result is recorded here and D17 is decided.`

The 12 photos, all 1280 px wide. P1-P4 are held-out images of the Roboflow project `blister-strips-defect-detection`, version 2 (one kind of strip: white tablets in a blue blister). C1-C8 are from Wikimedia Commons, named by their file title, under the licence shown.

| Photo | Source | In view (hand count) | SAM 3: pills at 0.7 or more inside each outline |
|---|---|---|---|
| P1 | `valid/img-128-…` | 1 strip touching the frame edge, 10 tablets | 10 (0.93-0.95) |
| P2 | `test/img-316-…` | 1 strip cut by the frame, 7 whole and 2 cut-off tablets, 1 used pocket | 9 at the 0.5 default (the three lowest 0.64-0.75); the used pocket is not counted |
| P3 | `valid/img-286-…` | 1 strip cut by the frame, 8 tablets, 1 used pocket | 8 (0.72-0.84) |
| P4 | `test/IMG_20240324_223146-…` | close-up of 4 pockets, 2 tablets | nothing found and no outline |
| C1 | `File:Ubenimex capsules in China.jpg` (CC0) | 1 strip: 2 capsules, 13 used pockets; 2 capsules printed on a box | 2 (used pockets 0.55-0.68 dropped; printed capsules are off the strip) |
| C2 | `File:Tramadol Capsules.jpg` (CC BY 2.0) | 1 strip: 6 capsules, 4 used pockets; 3 loose capsules | 6 (loose ones are off the strip) |
| C3 | `File:Tamiflu.JPG` (public domain) | 1 strip: 10 capsules | 10 |
| C4 | `File:Zumenon (estradiol hemihydrate) tablets in Australia, with one opened blister pack and one unopened blister pack.jpg` (CC BY-SA 4.0) | 2 strips: 25 tablets with 3 used pockets; 28 tablets | 25 and 28 (used pockets 0.56-0.65 dropped) |
| C5 | `File:Strattera(R) 40mg Capsule.jpg` (CC BY-SA 3.0) | 2 strips: 14 capsules; a printed foil back | 14 and 0 |
| C6 | `File:Blister of tablets.jpg` (CC BY-SA 4.0) | 3 strips: 10 flat red tablets; two foil-dome strips whose pills are hidden | 0, 0 and 0: the red tablets are missed |
| C7 | `File:Diazepam, strips 10 mg (Valium).jpg` (CC BY-SA 4.0) | 2 strips: 5 tablets with 5 torn-open pockets; a printed foil back; 1 loose tablet | **10** and 0: wrong (torn pockets 0.82-0.88, tablets 0.89-0.92) |
| C8 | `File:Anterone (cyproterone acetate) tablets in Australia, with two obverse and one reverse blister packs.jpg` (CC BY-SA 4.0) | 3 strips: 10 tablets; 10 tablets; a printed foil back | 10, 10 and 0 (one tablet at 0.76; 6 false marks on the foil back at 0.50-0.67 dropped) |

SAM 3 so far: all 15 strips in C1-C8 outlined (0.84-0.93) and no box outlined; of the 10 clear-pocket strips, 8 exact, 1 missed (no count) and 1 wrong, so it fails the "0 wrong" bar on its own. Other words: "capsule" (tried on C1-C8) counted the capsule strips as well as "pill" did, with a wider gap on C1 (real capsules 0.84-0.86, used pockets 0.51-0.59), but found nothing on the tablet strips; "tablet" (C1-C8) found nothing on any photo; "empty blister pocket" (P1-P4, two of which show a used pocket) found nothing. So "pill" is the one word that covers tablets and capsules, and used pockets cannot be asked for by name. Its replies for C1-C8 are kept in [`trial/sam3/`](trial/sam3) so that the Molmo run can use the same outlines without asking again.

## High-level architecture flow
```text
camera frames -> sharpness ranking -> top 5 -> align + average -> [averaged]
                  [averaged] -> denoise -> CLAHE -> sharpen -> 2x -> [enhanced] -> [binarised]
                  3 copies -> OCR each -> field extraction -> two-copy agreement -> LabelReading
camera frames -> sharpness, haze, motion -> camera cue (until the camera is fixed)
[averaged], [enhanced] -> YOLOv8n-seg -> strip, label, expiry, cavities -> whole-strip check + count agreement
proposed count: 2 sharpest colour frames -> sam3 (outline + pills by name) [+ molmo (points inside the outline)] -> same number from both, and from both frames -> visible count
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
| Sam3Detector (proposed) | SAM 3 on Roboflow: the strip outline and every pill, by name | pocket-detector adapter `sam3` |
| MolmoDetector (proposed) | Molmo on OpenRouter: one point per pill, parsed from its reply | pocket-detector adapter `molmo`; gives no outline, so it is a second opinion only |
| SecondOpinion (proposed) | accepts a frame's count only when two detectors give the same number inside the outline | used when `POCKET_DETECTOR` joins two detectors with `+` |
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
PocketResult   = { strip: Box|null, full: Box[], empty: Box[] } | { error }   (what every pocket detector returns; unchanged)
Point          = { x, y }   (pixels of the frame; Molmo's reply is turned into these and nothing else is kept)
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
pockets.sam3(Frame) -> PocketResult        (proposed; Roboflow /sam3/concept_segment with the words "pill" and "blister pack")
pockets.molmo(Frame) -> Point[]            (proposed; OpenRouter chat/completions, model allenai/molmo-2-8b:free; only while cloud assistance is on)
pockets.agree(PocketResult, Point[]) -> PocketResult|null   (proposed; the same number inside the outline, or nothing)
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
- A cloud model for counting: the user asked on 2026-11-28 to try Molmo on OpenRouter next (decisions 18-20). It sends strip photos to a language model, which changes D11 (cloud for surroundings and general questions only) for the count alone; record it as D17 if Molmo is adopted, not before. Claude is still not used.
- If no provider serves Molmo on OpenRouter (the case on 2026-11-28): wait and check again, run Molmo somewhere else (its weights are open, so a hosted endpoint or our own GPU), or name another pointing model. The user decides.
- Molmo 2's point markup must be confirmed on the first trial reply before a parser is written; Molmo 1 wrote `<point x y>` and `<points x1 y1 …>` in percent of the image.
- Flat coloured tablets (missed by SAM 3 in C6) and foil-dome strips, where the pills are hidden inside opaque foil and no camera can see them, only their domes. Whether a dome can stand for a tablet is not decided.
- The words each detector is given. Measured for SAM 3: "pill" covers tablets and capsules, "capsule" covers capsules only, "tablet" and "empty blister pocket" find nothing. Whether asking for "capsule" as well as "pill" on capsule strips is worth a second word is not decided.
- Whether counting should also try turned frames. Detection models are usually trained with rotations, and each try uses a rate-limited call.
- A strip model with full and empty pocket classes is still needed, unless decisions 18-20 are adopted; the current model cannot count. The user chose on 2026-11-28 to retrain it with intact pills labelled, and it needs photos of the user's own strips.

## Risks
- The fallback sends medicine photos off the phone to Roboflow, and needs a network and a key.
- Public blister images may not look like Indian strips, so the detector could miss pockets or the strip edge. Mitigation: add our own photos, and state no count when two copies disagree.
- Foil glare can look like an empty pocket. Mitigation: test glared strips.
- All copies come from the same frames, so they can agree on the same misread. Mitigation: test on strips with known values.
- OpenCV.js and OCR may be too slow in a phone browser. Prerequisite spike: measure time and accuracy on sample strips.
- Reading turned copies adds 3 OCR runs of the averaged copy, plus one confirming run per turn that finds a missing field, whenever the name or expiry is missing. That includes strips whose expiry is simply on the back, which is slow on low-end phones.
- Coloured or bold names may lose contrast in the grey copies; not measured without sample strips.
- ECC can converge to a wrong alignment on low-texture frames; the averaged copy may then be blurrier. The sharpest frame still leads the average.
- Each listed model is a separate Roboflow call, so a long list is slower and uses more credits.
- SAM 3 scored torn-open pockets as high as real tablets on one photo of twelve; used alone it can state a wrong count.
- A count with a second opinion is 2 Roboflow calls and 2 OpenRouter calls (two frames). OpenRouter's free models are limited to about 20 requests a minute and 50 a day.
- Molmo is a language model served by others: its reply must be read as points only, and a provider can change or withdraw it, as the empty endpoint list on 2026-11-28 shows.
