# Spec Delta

## Purpose
Allows opt-in cloud help for limited tasks while keeping safety decisions local.

## ADDED Requirements

### Requirement: Off by default
Cloud assistance SHALL be optional, disabled by default and controlled by a toggle.

#### Scenario: First launch
- **WHEN** the app is first opened
- **THEN** cloud assistance is off and nothing is sent to a cloud service

#### Scenario: Toggle on
- **WHEN** the user enables the toggle
- **THEN** cloud assistance is used through OpenRouter, called by the app server

### Requirement: Missing cloud key
When no cloud key is configured, the app SHALL show a "key not set" message for cloud assistance and keep all other features working. Keys SHALL NOT be sent to the browser.

#### Scenario: Enable without a key
- **WHEN** the user enables cloud assistance and no key is configured
- **THEN** a "key not set" message is shown and spoken, and cloud assistance stays unavailable

### Requirement: Limited cloud use
When enabled, cloud assistance SHALL be used only for speech that local recognition failed on, general knowledge and scene descriptions.

#### Scenario: Local recognition fails
- **WHEN** local speech-to-text fails and cloud assistance is enabled
- **THEN** cloud speech-to-text may be used

### Requirement: Never safety or dosage
The cloud SHALL NOT handle safety or dosage answers.

#### Scenario: Dosage question with cloud on
- **WHEN** the user asks a dosage question with cloud assistance enabled
- **THEN** the answer is produced on the device from the printed label
