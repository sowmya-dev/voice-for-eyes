# Spec Delta

## Purpose
Lets users speak and hear any supported language, including accented and mixed speech.

## ADDED Requirements

### Requirement: Supported languages
The system SHALL support all 22 scheduled Indian languages and English, including regional accents and code-mixed speech.

#### Scenario: Code-mixed question
- **WHEN** the user mixes an Indian language with English in one utterance
- **THEN** the system understands the utterance

### Requirement: Language detection and switching
Until the user names a language, the system SHALL detect the language of every utterance, switching the session language only when detection is confident and otherwise retaining it.

#### Scenario: Confident detection
- **WHEN** a different language is detected with confidence
- **THEN** the session switches to that language

#### Scenario: Uncertain detection
- **WHEN** a different language is detected without confidence
- **THEN** the session language is retained

#### Scenario: Language already named
- **WHEN** the user has named a language and later speech looks like another language
- **THEN** the session language does not change until the user names another one

### Requirement: Explicit language change
When the user says the name of a supported language, the system SHALL change the session language to it and SHALL set speech recognition to that language until the user names another.

#### Scenario: Language named
- **WHEN** the user says the name of a supported language
- **THEN** the session changes to that language

#### Scenario: Recognition follows
- **WHEN** the user has named Telugu
- **THEN** speech recognition is reopened with te-IN, and the next questions are written in Telugu script

#### Scenario: Named while auto-detecting
- **WHEN** auto-detection writes the request in English letters or in the language itself, such as "Telugulo matladu" or "తెలుగులో మాట్లాడు", including a single word with an added ending such as "Kannadaka"
- **THEN** the session changes to Telugu

### Requirement: Reply language
The system SHALL reply in the spoken language, preferring the Indian language for mixed speech, and SHALL use the last spoken language when there is no voice input.

#### Scenario: Mixed speech
- **WHEN** the user mixes Hindi and English
- **THEN** the reply is in Hindi

#### Scenario: No voice input
- **WHEN** the system must speak without a current utterance
- **THEN** it uses the last spoken language

### Requirement: Language drives processing
The identified language SHALL select the speech-to-text model, response templates and voice.

#### Scenario: Kannada utterance
- **WHEN** the session language becomes Kannada
- **THEN** Kannada speech recognition, response templates and voice are used
