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
