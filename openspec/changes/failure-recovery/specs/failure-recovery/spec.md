# Spec Delta

## Purpose
Gives predictable, honest recovery when speech or labels cannot be understood.

## ADDED Requirements

### Requirement: Noisy speech
The system SHALL cross-check a low-confidence transcript against camera text, ask "Did I hear X? Say again?" if that does not resolve it, and read the label if it is still unclear.

#### Scenario: Resolved by camera text
- **WHEN** camera text resolves a low-confidence transcript
- **THEN** the system continues without asking the user to repeat

#### Scenario: Unresolved
- **WHEN** camera text does not resolve the transcript
- **THEN** the system asks "Did I hear X? Say again?", where X is what it heard

#### Scenario: Still unclear
- **WHEN** the repeated utterance is still unclear
- **THEN** the system reads the label

### Requirement: Repeat after clarification
After a clarification, the system SHALL first repeat what it heard, in the form "You said: Dolo 650."

#### Scenario: Clarified
- **WHEN** the user answers a clarification request
- **THEN** the reply begins by repeating what was heard

### Requirement: Unknown intent ladder
While the intent stays unknown, the system SHALL escalate in this order: ask again, then read the label, then request a clearer view of the medicine.

#### Scenario: Escalation
- **WHEN** the intent is still unknown after a step
- **THEN** the system takes the next step in that order

### Requirement: Clean before asking again
The system SHALL NOT immediately ask for another photo, and SHALL first spend five seconds cleaning the image.

#### Scenario: Blurry label
- **WHEN** the label is blurry
- **THEN** the system spends five seconds cleaning the image before asking the user to move anything

### Requirement: Unreadable label response
If the name or expiry is still unreadable after cleaning, the system SHALL state what is readable and then say exactly: "I can't read this. Move the medicine up/down/left/right so I can see the expiry date."

#### Scenario: Expiry unreadable
- **WHEN** the name is readable and the expiry is not
- **THEN** the system states the name, then says the exact sentence

### Requirement: Nothing from unclear text
The system SHALL NOT guess, or provide dosage information, from unclear text.

#### Scenario: Unclear dosage
- **WHEN** the dosage text is unclear
- **THEN** no dosage information is given
