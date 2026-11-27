# Spec Delta

## Purpose
Prevents harm by enforcing fixed, testable rules on every expiry, dosage and safety answer.

## ADDED Requirements

### Requirement: Rules apply to every interaction
A deterministic rule engine SHALL enforce all safety and failure-handling rules on every interaction.

#### Scenario: Replayed or assisted answer
- **WHEN** an answer is replayed from memory or follows a cloud-assisted step
- **THEN** the same rules apply

### Requirement: Label-only expiry and dosage
Expiry and dosage answers SHALL come exclusively from printed labels.

#### Scenario: Dosage not printed
- **WHEN** the user asks about dosage and no dosage is accepted from the label
- **THEN** the system gives no dosage

### Requirement: No dose advice
The system SHALL NOT recommend or infer a dose.

#### Scenario: Asked what to take
- **WHEN** the user asks how much they should take
- **THEN** the system states only printed dosage text, if accepted, without advice of its own

### Requirement: Expiry dates need the EXP marker
The system SHALL treat a date as an expiry date only when it is printed beside "EXP", and SHALL NOT guess dates.

#### Scenario: Unmarked date
- **WHEN** a date on the label is not beside "EXP"
- **THEN** it is not used as the expiry date

### Requirement: Expired warning
For an expired medicine the response SHALL always begin with "Warning: this has expired. Please do not take it."

#### Scenario: Expired medicine
- **WHEN** the accepted expiry date has passed
- **THEN** the first words of the response are the warning, in the reply language

### Requirement: No dosage for expired medicine
The system SHALL NOT provide dosage information for an expired medicine.

#### Scenario: Dose of expired medicine
- **WHEN** the user asks for the dosage of an expired medicine
- **THEN** the system gives the warning and no dosage

### Requirement: Risk confirmation
After every dosage answer or expired warning, the system SHALL ask "Do you understand the risk?" and, unless the user explicitly confirms, SHALL repeat the answer once.

#### Scenario: Confirmed
- **WHEN** the user says "Yes", "Haan", "Howdu", "Avunu" or "Aama"
- **THEN** the answer is not repeated

#### Scenario: Not confirmed
- **WHEN** the user does not explicitly confirm
- **THEN** the answer is repeated exactly one time
