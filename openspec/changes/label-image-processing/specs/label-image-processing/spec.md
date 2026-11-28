# Spec Delta

## Purpose
Gets trustworthy text from blurred, glared and embossed labels captured by shaky hands.

## ADDED Requirements

### Requirement: Multi-frame cleanup
The system SHALL select the five sharpest frames by Laplacian variance, then align and average them to reduce noise and glare.

#### Scenario: Shaky capture
- **WHEN** a label is captured with shaky hands
- **THEN** the five sharpest frames are aligned and averaged

### Requirement: Image enhancement
The system SHALL denoise the averaged image, apply CLAHE contrast enhancement, sharpen it and upscale it 2x.

#### Scenario: Enhanced copy
- **WHEN** the frames have been averaged
- **THEN** an image is produced with all four enhancements applied

### Requirement: Embossed text copy
The system SHALL also generate a binarised copy of the image for embossed text.

#### Scenario: Embossed expiry
- **WHEN** a label is processed
- **THEN** a binarised copy is available to OCR

### Requirement: Two-copy agreement
The system SHALL run OCR on every processed image and accept a name, expiry, dosage or count only when two copies agree.

#### Scenario: Agreement
- **WHEN** two processed copies read the same value
- **THEN** the value is accepted

#### Scenario: No agreement
- **WHEN** no two copies read the same value
- **THEN** the value is treated as unreadable and is not spoken

### Requirement: Difficult labels
The system SHALL read medicine names and expiry from blurred, glared and embossed sample strips.

#### Scenario: Sample strips
- **WHEN** the blurred, glared and embossed sample strips are processed
- **THEN** each accepted name and expiry matches the printed text, and anything unaccepted is reported unreadable

### Requirement: Turned label
A strip can print the name and the expiry in different directions, so orientation SHALL be chosen per field. When the upright reading lacks the medicine name or the expiry, the system SHALL read the averaged copy turned by 90, 180 and 270 degrees, and for each missing field SHALL confirm it with a second copy at a turn whose read found it, accepting the field only when the two copies agree. Fields accepted upright SHALL be kept. Text positions SHALL be reported in the camera's own orientation. When the upright reading gives both the name and the expiry, the system SHALL NOT read any turned copy.

#### Scenario: Upside-down strip
- **WHEN** the strip is held upside down
- **THEN** the system reads the name and expiry from the copy turned by 180 degrees

#### Scenario: Sideways strip
- **WHEN** the strip is held sideways
- **THEN** the system reads the label from the copy turned by 90 or 270 degrees, and any movement request uses directions in the camera's orientation

#### Scenario: Upright strip
- **WHEN** the upright reading gives the name and the expiry
- **THEN** no turned copy is read

#### Scenario: Vertical name, horizontal expiry
- **WHEN** the expiry is printed across the strip and the name runs along it, vertically
- **THEN** the expiry is accepted from the upright copies and the name from the turned copies, in the same read

### Requirement: Shake with rotation
The system SHALL align each frame to the sharpest frame for small rotations as well as shifts before averaging. If rotation alignment fails for a frame, the system SHALL use the shift-only alignment for that frame.

#### Scenario: Tilting hand
- **WHEN** the frames differ by a small rotation
- **THEN** the averaged copy stays about as sharp as the sharpest frame

#### Scenario: Alignment fails
- **WHEN** rotation alignment cannot be worked out for a frame
- **THEN** that frame is aligned by shift only and cleaning still finishes

### Requirement: Colour frames for counting
The system SHALL send the two sharpest original colour frames to the strip model, not the cleaned black-and-white copies, and SHALL accept a count only when both frames give the same reliable count.

#### Scenario: Counted from colour frames
- **WHEN** both colour frames show the whole strip with the same number of full pockets
- **THEN** that number is the count

#### Scenario: Frames disagree
- **WHEN** the two frames give different counts
- **THEN** no count is accepted

### Requirement: Strip model chain
The system SHALL try each strip model listed in `ROBOFLOW_MODEL_ID` in order, rename predicted classes through `ROBOFLOW_CLASS_MAP` before using them, and use the first model that finds a strip and at least one pocket.

#### Scenario: First model finds nothing
- **WHEN** the first model finds no strip and the second model finds one with pockets
- **THEN** the second model's result is used

#### Scenario: Class names mapped
- **WHEN** a model's classes are named differently and `ROBOFLOW_CLASS_MAP` maps them to `medicine_strip`, `full_cavity` and `empty_cavity`
- **THEN** its predictions are used as those classes

#### Scenario: No model finds a strip
- **WHEN** no listed model finds a strip with pockets
- **THEN** no count is accepted and the existing whole-strip retries apply

### Requirement: Count needs a full pocket
The system SHALL accept a count only when at least one full pocket is found, so that a model that cannot see tablets never reports zero.

#### Scenario: Model without a full-pocket class
- **WHEN** the strip and empty pockets are found but no full pocket
- **THEN** no count is accepted

#### Scenario: Full pockets found
- **WHEN** the whole strip and at least one full pocket are found
- **THEN** the number of full pockets is the count
