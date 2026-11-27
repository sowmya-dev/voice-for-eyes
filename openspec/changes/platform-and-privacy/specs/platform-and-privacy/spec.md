# Spec Delta

## Purpose
Fixes the client platform, on-device processing, privacy and performance limits of the product.

## ADDED Requirements

### Requirement: Web client
The client SHALL be a web app that runs in a mobile or desktop browser, with no installation needed, and SHALL use OpenCV for image processing.

#### Scenario: Open on a basic phone
- **WHEN** a user opens the app's address in a supported browser on a basic phone
- **THEN** the app runs there

### Requirement: Runs with Docker and no keys
The app SHALL start with one `docker compose` command and show its main screen on port 3000, without secret keys or a `.env` file.

#### Scenario: Clean start
- **WHEN** the app is started from a fresh copy of the project with no keys and no `.env` file
- **THEN** the main screen is shown on port 3000

### Requirement: Secure connection for capture
When the browser blocks the camera or microphone, including on a connection that is neither HTTPS nor localhost, the app SHALL still show its main screen and state why capture is unavailable.

#### Scenario: Insecure address
- **WHEN** the app is opened over plain HTTP on an address other than localhost
- **THEN** the main screen explains that HTTPS or localhost is needed

### Requirement: Local-first and offline-capable
The system SHALL process data in the user's browser by default, not on the app server, and SHALL be able to read medicine labels offline once the app and its models have loaded.

#### Scenario: No network
- **WHEN** the app and its models have loaded, the network is lost, and the user asks to identify a medicine
- **THEN** the question is answered on the device

#### Scenario: Default processing
- **WHEN** cloud assistance is off
- **THEN** no audio, image or transcript leaves the device

### Requirement: On-device speech stack
The system SHALL run voice activity detection (Silero VAD), language identification (Whisper small, or base if needed for latency) and speech-to-text on the device in the browser through sherpa-onnx.

#### Scenario: Offline speech
- **WHEN** the device is offline
- **THEN** speech is detected, identified and transcribed on the device

### Requirement: Speech-to-text fallback order
Speech-to-text SHALL use AI4Bharat IndicConformer, falling back to Shruti-ONNX and then Meta Omnilingual ASR 300M.

#### Scenario: Primary model cannot be used
- **WHEN** the primary model cannot serve a language
- **THEN** the next model in the order is used

### Requirement: On-device OCR
OCR SHALL run in the browser on the user's device with PaddleOCR PP-OCRv5 Mobile.

#### Scenario: Offline label
- **WHEN** a label is read with no network
- **THEN** OCR runs on the device

### Requirement: Speech recognition speed
Language identification and transcription of an utterance SHALL finish in under 3 seconds on a basic phone.

#### Scenario: Latency measurement
- **WHEN** the speech test set is run on a basic phone
- **THEN** language identification plus transcription takes under 3 seconds per utterance

### Requirement: Speech test coverage
Speech recognition SHALL be tested on at least 10 Indian languages, with two accents each, and on code-mixed speech.

#### Scenario: Test report
- **WHEN** speech testing is complete
- **THEN** results are recorded for 10 or more languages, two accents each, and code-mixed samples

### Requirement: Logging
The system SHALL log its operation while preserving local-first privacy.

#### Scenario: Interaction logged
- **WHEN** an interaction completes
- **THEN** a log entry exists on the device and is not uploaded
