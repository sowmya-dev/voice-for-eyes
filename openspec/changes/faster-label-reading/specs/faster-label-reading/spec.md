# Spec Delta

## Purpose
Answers sooner by reading label text on the fastest part of the device that works.

## ADDED Requirements

### Requirement: Fastest working text reader
The system SHALL read label text on the device's graphics chip when one is available and works, and otherwise on its processor. A graphics reader that does not start, fails or stalls SHALL be replaced by the processor reader without losing the read. The same models and two-copy rules SHALL apply to both.

#### Scenario: Graphics chip works
- **WHEN** the browser offers a working graphics chip
- **THEN** label text is read on it

#### Scenario: No graphics chip
- **WHEN** the browser offers none, or only a software substitute
- **THEN** label text is read on the processor

#### Scenario: Graphics reader does not start
- **WHEN** the graphics reader fails or gives no result while starting
- **THEN** the processor reader is used

#### Scenario: Graphics reader fails during a read
- **WHEN** a read on the graphics chip fails or stalls
- **THEN** the same image is read on the processor, which is used from then on
