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

### Requirement: Label gathered across reads
While the user is asking about one strip, the system SHALL combine what each read accepts (name, expiry, ingredient, printed dosage, printed pack count) into one remembered label, keeping the first accepted value of each field, and SHALL treat the label as complete once the combined label has the name and the expiry. If a read accepts a different name from the remembered one, the system SHALL drop the remembered label and start again from that read.

#### Scenario: Name then expiry
- **WHEN** one read gives only the name and a later read, after the strip is turned, gives only the expiry
- **THEN** the label is complete and the question is answered without another request to move the strip

#### Scenario: Different strip
- **WHEN** a later read gives a different medicine name
- **THEN** the earlier fields are dropped and only the new read is used

### Requirement: Answer from the remembered label
After a label is complete, the system SHALL answer medicine questions (expiry, dosage, purpose) from the remembered label without reading the camera, for 5 minutes after the label was last read. The system SHALL read the camera again when the user asks to identify a medicine ("What is this tablet?"), names a different medicine, or says "start over", or when 5 minutes have passed.

#### Scenario: Follow-up question
- **WHEN** the label has been read and the user asks "When does it expire?"
- **THEN** the answer comes from the remembered label and the camera is not read

#### Scenario: New tablet
- **WHEN** the user asks "What is this tablet?"
- **THEN** the camera is read again and the new label replaces the remembered one

#### Scenario: Start over
- **WHEN** the user says "start over"
- **THEN** the remembered label is forgotten

#### Scenario: Label too old
- **WHEN** more than 5 minutes have passed since the label was read
- **THEN** the camera is read again

### Requirement: Count gathered with the label
When a strip model is configured, the system SHALL count the visible tablets once, in the background, after a label becomes complete, keep the count with the remembered label, and answer a count question from it. The system SHALL forget the count when the user says they took a tablet.

#### Scenario: Count remembered
- **WHEN** the label was read, the count was accepted, and the user asks "How many are left?"
- **THEN** the remembered count is given without reading the camera

#### Scenario: Tablet taken
- **WHEN** the user says they took a tablet
- **THEN** the remembered count is forgotten and the next count question reads the camera
