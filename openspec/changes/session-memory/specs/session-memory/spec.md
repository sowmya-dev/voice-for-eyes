# Spec Delta

## Purpose
Keeps the context of the current session for follow-ups without storing it permanently.

## ADDED Requirements

### Requirement: RAM-only session memory
The system SHALL keep the last label and a queue of questions and answers in RAM only.

#### Scenario: App closed
- **WHEN** the app process ends
- **THEN** no label, question or answer from the session remains stored in session memory

### Requirement: Replay repeated questions
The system SHALL replay the previous answer when a question is repeated about the same label.

#### Scenario: Same label
- **WHEN** the user repeats a question about the same label
- **THEN** the previous answer is replayed

#### Scenario: Different label
- **WHEN** the user repeats a question about a different label
- **THEN** a new answer is produced from the new label
