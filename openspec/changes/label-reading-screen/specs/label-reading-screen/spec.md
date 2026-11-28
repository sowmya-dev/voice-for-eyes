# Spec Delta

## Purpose
Keeps the landing page for asking, and shows the camera whenever the app is reading a label.

## ADDED Requirements

### Requirement: No label reading on the landing screen
The system SHALL NOT read a label while the landing screen is shown, and SHALL NOT start reading while the user is still speaking.

#### Scenario: Waiting for a question
- **WHEN** the landing screen is shown and the user has not asked anything
- **THEN** no camera frames are read for a label, and the screen shows no reading status

#### Scenario: Still speaking
- **WHEN** the user is speaking a question
- **THEN** no camera frames are read until the whole question has been transcribed

#### Scenario: Reader still loading
- **WHEN** the label reader is still loading in the background
- **THEN** the landing screen does not say so, and a loading failure is still shown

### Requirement: Label reading screen
When an understood request needs the label, the system SHALL first show a label-reading screen with the live camera, what the user asked and a reading status, then read the label, and replace that screen with the result. A request whose current screen already shows the camera and its own progress SHALL stay on it.

#### Scenario: Question needs the label
- **WHEN** the user asks "What is this tablet?" on the landing screen, by voice or by tapping the microphone
- **THEN** the label-reading screen appears before any frame is read, and the result screen follows

#### Scenario: Unclear question
- **WHEN** words that are not understood have to be checked against the label
- **THEN** that check also happens on the label-reading screen, and the noisy-speech screen follows if the doubt remains

#### Scenario: No label needed
- **WHEN** the request needs no label, such as surroundings or a language change
- **THEN** the label-reading screen is not shown

#### Scenario: Camera screens keep their own view
- **WHEN** the label is read again during a retry, a photo or the noisy-speech steps
- **THEN** the current screen stays

#### Scenario: Emergency stays on screen
- **WHEN** an emergency or feeling-unwell instruction is showing and the label is read afterwards
- **THEN** the instruction stays on screen

#### Scenario: Back from the result
- **WHEN** the user says "back" on the result screen
- **THEN** the screen before the question is shown, not the label-reading screen

#### Scenario: Commands while reading
- **WHEN** the user says "later" while reading, then "continue"
- **THEN** the pause screen is shown, then the label is read again and the same question is answered, and "open settings" while reading gets "Let's finish this first."

#### Scenario: Phone shows the camera
- **WHEN** the label-reading screen is shown on a phone-width screen
- **THEN** the camera view is shown first
