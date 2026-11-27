# Spec Delta

## Purpose
Lets a blind user run the whole assistant by voice, from opening the app to interrupting an answer.

## ADDED Requirements

### Requirement: Automatic start
The system SHALL start the camera and listening automatically when the app is opened. If the browser requires a user action first, a single tap anywhere on the screen SHALL start both. Browser permission prompts are allowed.

#### Scenario: App opens
- **WHEN** the user opens the app and the browser allows capture and sound without a user action
- **THEN** the camera and listening start with no further action

#### Scenario: Browser needs a user action
- **WHEN** the browser blocks capture or sound until the user acts
- **THEN** one tap anywhere on the screen starts the camera and listening

### Requirement: Continuous listening and mute
The system SHALL listen continuously without a wake word, detect where each utterance starts and ends, and provide a mute control.

#### Scenario: Question without a wake word
- **WHEN** the user asks a question without saying a wake word
- **THEN** the system processes the utterance once it ends

#### Scenario: Muted
- **WHEN** the user has muted the system
- **THEN** speech from the user is not processed

### Requirement: Interruption
The system SHALL allow the user to interrupt at any time, fading out its own speech immediately.

#### Scenario: Interrupt an answer
- **WHEN** the user starts speaking while an answer is being spoken
- **THEN** the speech fades out immediately and the new utterance is processed

### Requirement: Uninterrupted capture
The system SHALL keep the camera preview and listening running while it processes and speaks.

#### Scenario: While speaking
- **WHEN** the system is processing or speaking
- **THEN** the camera preview and listening remain active

### Requirement: Accessible camera interface
The system SHALL provide an accessibility-first camera interface with a torch control where the browser and device support it.

#### Scenario: Torch
- **WHEN** the user turns on the torch and the browser and device support it
- **THEN** the torch lights while the camera preview continues

#### Scenario: Torch not supported
- **WHEN** the browser or device does not support the torch
- **THEN** the app says the torch is unavailable and the camera preview continues

### Requirement: Rule-based intent routing
The system SHALL classify each utterance with language-specific keyword rules, without a language model, into one of: identify, safety, dose, general, scene, yes, language, unknown.

#### Scenario: Recognised intent
- **WHEN** the user asks "What is this tablet?" in a supported language
- **THEN** the utterance is routed to the identify intent

#### Scenario: No rule matches
- **WHEN** no keyword rule matches the utterance
- **THEN** it is routed to the unknown intent

### Requirement: Single interaction pipeline
Every spoken interaction SHALL pass through one pipeline in this order: voice activity detection, language identification, speech-to-text, image processing, OCR, cross-check, intent router, rule engine, response composer, speech, session memory.

#### Scenario: No bypass
- **WHEN** any answer is produced, including one assisted by the cloud
- **THEN** it passes through the rule engine before it is spoken
