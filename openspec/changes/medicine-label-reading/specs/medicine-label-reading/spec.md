# Spec Delta

## Purpose
Answers questions about medicines and food from printed labels in short spoken replies.

## ADDED Requirements

### Requirement: Identify medicine
The system SHALL answer an identification question briefly, danger first, in the user's language, with the medicine name, purpose, expiry and quantity that are available.

#### Scenario: What is this tablet
- **WHEN** the user shows a readable, unexpired strip and asks "What is this tablet?"
- **THEN** the system speaks a reply like "Dolo 650, a fever tablet. Expires in three months. Three tablets."

### Requirement: Purpose from bundled table
The system SHALL take a medicine's purpose only from an ingredient table bundled with the app.

#### Scenario: Ingredient not listed
- **WHEN** the ingredient is not in the table
- **THEN** no purpose is stated

### Requirement: Printed information only
The system SHALL read quantities and counts from printed label text and SHALL NOT guess any label value.

#### Scenario: Count question
- **WHEN** the user asks "How many are left in this strip?" and the count is accepted from printed text
- **THEN** the system replies with the number, for example "2."

#### Scenario: Count not available
- **WHEN** no count can be accepted from printed text
- **THEN** the system does not state a number

### Requirement: Food labels and follow-ups
The system SHALL support food label reading, nutritional information and follow-up questions.

#### Scenario: Nutrition follow-up
- **WHEN** the user asks about nutrition while showing a food label
- **THEN** the system answers from the readable printed information

### Requirement: Spoken templates and voice
The system SHALL compose replies from language-specific templates and speak them with the best available text-to-speech voice for the language in the user's browser.

#### Scenario: Spoken reply
- **WHEN** an answer is ready
- **THEN** it is spoken from that language's template with the best available voice

### Requirement: Admit what is unreadable
The system SHALL openly say when information cannot be read.

#### Scenario: Partly readable
- **WHEN** only some requested information is readable
- **THEN** the system states that information and says the rest cannot be read
