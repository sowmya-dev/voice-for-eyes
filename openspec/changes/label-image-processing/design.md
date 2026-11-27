# Design: label-image-processing

## Context
Turns camera frames into trusted label fields. `mvp/VoiceLoop.kt` returns a hard-coded label string and is not reused. See [`proposal.md`](proposal.md) for the motivation.

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

## High-level architecture flow
```text
camera frames -> sharpness ranking -> top 5 -> align + average -> [averaged]
                  [averaged] -> denoise -> CLAHE -> sharpen -> 2x -> [enhanced] -> [binarised]
                  3 copies -> OCR each -> field extraction -> two-copy agreement -> LabelReading
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| FrameSelector | Laplacian variance ranking | feeds ImageCleaner |
| ImageCleaner | OpenCV.js alignment, averaging and enhancement | returns ProcessedCopy list |
| OcrReader | runs OCR on one copy | returns OcrLine list |
| FieldAgreement | extracts fields and applies agreement | returns LabelReading |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
Frame         = { id: int, capturedAt: ms, pixels: ImageData, sharpness?: number }
ProcessedCopy = { kind: 'averaged'|'enhanced'|'binarised', pixels: ImageData }
OcrLine       = { copy: ProcessedCopy.kind, text: string, box: [x,y,w,h], confidence: 0..1 }
AcceptedField = { value: string, agreeingCopies: kind[] (length >= 2) } | null
LabelReading  = { labelId: string|null, name: AcceptedField, ingredient: AcceptedField, expiryText: AcceptedField,
                  dosageText: AcceptedField, countText: AcceptedField, lines: OcrLine[], cleanedForMs: int }
```

## Tool schemas
```text
image.selectSharpest(Frame[], n=5) -> Frame[]
image.clean(Frame[]) -> ProcessedCopy[]
ocr.read(ProcessedCopy) -> OcrLine[]
label.agree(OcrLine[]) -> LabelReading
```

## Agent flow
On a turn that needs the label: collect frames -> select -> clean -> read each copy -> agree -> hand LabelReading to the cross-check and rule engine.

## Open decisions
- `ingredient` is needed for the purpose lookup but is not in the prompt's list of agreed fields. Recommendation: require two-copy agreement for it too.
- The rule for building labelId is shared with session-memory. Recommendation: derive it from the accepted name and expiry.

## Risks
- All copies come from the same frames, so they can agree on the same misread. Mitigation: test on strips with known values.
- OpenCV.js and OCR may be too slow in a phone browser. Prerequisite spike: measure time and accuracy on sample strips.
