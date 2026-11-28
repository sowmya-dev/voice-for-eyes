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

#### Scenario: No speech key
- **WHEN** the app runs without a Sarvam key
- **THEN** the main screen states that voice input is unavailable

### Requirement: Secure connection for capture
When the browser blocks the camera or microphone, including on a connection that is neither HTTPS nor localhost, the app SHALL still show its main screen and state why capture is unavailable.

#### Scenario: Insecure address
- **WHEN** the app is opened over plain HTTP on an address other than localhost
- **THEN** the main screen explains that HTTPS or localhost is needed

### Requirement: Local-first and offline-capable
The system SHALL process images and read medicine labels in the user's browser. Speech audio SHALL be sent to Sarvam for transcription, and reply text to be spoken. A camera frame SHALL leave the device only for the Roboflow strip-detection fallback. Once loaded, label reading SHALL NOT need a network; voice input does.

#### Scenario: No network
- **WHEN** the app and its models have loaded and the network is lost
- **THEN** label reading can still run on the device, the system states that voice input is unavailable, and replies use only a voice on the device

#### Scenario: Default processing
- **WHEN** cloud assistance is off
- **THEN** only speech audio and reply text go to Sarvam through the app server, and no image leaves the device unless the strip-detection fallback is used

#### Scenario: Detection fallback
- **WHEN** the in-browser strip model gives no result
- **THEN** only the camera frame needed is sent through the app server to Roboflow, and the medicine name and expiry are still read on the device

### Requirement: On-device speech stack
The system SHALL run voice activity detection (Silero VAD) and language identification (Whisper small, or base if needed for latency) on the device in the browser through sherpa-onnx.

#### Scenario: Offline speech
- **WHEN** the device is offline
- **THEN** speech is detected and its language identified on the device

### Requirement: Speech-to-text through Sarvam
Speech-to-text for English, Hindi, Telugu and Kannada SHALL use Sarvam's realtime streaming service, through Sarvam's Python package `sarvamai` on the app server, with model saaras:v4 and mode codemix, following the contract in the design. The Sarvam key SHALL stay on the app server and SHALL NOT reach the browser.

#### Scenario: Stream accepted
- **WHEN** a speech stream is opened and Sarvam answers with status 101
- **THEN** audio is streamed at the configured sample rate with model saaras:v4 and mode codemix

#### Scenario: Language code
- **WHEN** a stream is opened for these languages
- **THEN** its language_code is en-IN, hi-IN, te-IN, kn-IN or auto

#### Scenario: Key not exposed
- **WHEN** the browser's files and network traffic are inspected
- **THEN** the Sarvam key does not appear

#### Scenario: Stream refused
- **WHEN** the stream cannot be opened
- **THEN** the system states that voice input is unavailable

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
