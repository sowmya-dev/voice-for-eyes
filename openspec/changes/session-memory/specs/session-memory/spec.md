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
While the user is asking about one strip, the system SHALL combine what each read accepts (name, expiry, ingredient, printed dosage, printed pack count) into one remembered label, keeping the first accepted value of each field, and SHALL treat the label as complete once the combined label has the name and the expiry. If a read accepts a different name or a different expiry from the remembered one, the system SHALL treat it as a different strip, drop the remembered label and start again from that read.

#### Scenario: Name then expiry
- **WHEN** one read gives only the name and a later read, after the strip is turned, gives only the expiry
- **THEN** the label is complete and the question is answered without another request to move the strip

#### Scenario: Different strip
- **WHEN** a later read gives a different medicine name
- **THEN** the earlier fields are dropped and only the new read is used

#### Scenario: Same name, different expiry
- **WHEN** a later read gives the same name but a different expiry, such as an expired strip of the same medicine
- **THEN** the earlier fields are dropped and the new expiry, with its warning, is used

### Requirement: Answer from the remembered label
After a label is complete, the system SHALL answer medicine questions (expiry, dosage, purpose, count) from the remembered label without asking the user to hold the strip again, until the user says "start over". When the user asks to identify a medicine ("What is this tablet?") or names a different medicine, the system SHALL take one look: if it finds a different name or expiry, that strip replaces the remembered one; otherwise the answer comes from the remembered label, with no request to move the strip.

#### Scenario: Follow-up question
- **WHEN** the label has been read and the user asks "When does it expire?"
- **THEN** the answer comes from the remembered label and the camera is not read

#### Scenario: New tablet
- **WHEN** the user asks "What is this tablet?" while showing a different strip
- **THEN** the new label replaces the remembered one

#### Scenario: Same tablet asked again
- **WHEN** the user asks "What is this tablet?" and the look finds nothing new
- **THEN** the answer comes from the remembered label and the user is not asked to move the strip

#### Scenario: Start over
- **WHEN** the user says "start over"
- **THEN** the remembered label is forgotten

#### Scenario: Long pause
- **WHEN** the user asks about the expiry 20 minutes after the label was read
- **THEN** the answer comes from the remembered label

### Requirement: Count gathered with the label
When a strip model is configured, the system SHALL count the visible tablets once, in the background, after a label becomes complete, keep the count with the remembered label, and answer a count question from it. The background count SHALL be tried once for a strip and not again after later answers about it; it SHALL be tried again only when the user says they took a tablet, asks for the count, or shows a different strip. The system SHALL forget the count when the user says they took a tablet.

#### Scenario: Count remembered
- **WHEN** the label was read, the count was accepted, and the user asks "How many are left?"
- **THEN** the remembered count is given without reading the camera

#### Scenario: No recount after each answer
- **WHEN** the background count found nothing and the user asks two more questions about the same strip
- **THEN** the strip model is not called again

#### Scenario: Tablet taken
- **WHEN** the user says they took a tablet
- **THEN** the remembered count is forgotten and the next count question reads the camera

### Requirement: Session state kept and shown
The system SHALL keep everything it has learnt and answered in the session (the label fields, the count, and each question with its answer) until the user says "start over", and SHALL show every known label field and the count on the card of each medicine answer.

#### Scenario: Card keeps the count
- **WHEN** the count was answered and the user then asks about the expiry
- **THEN** the expiry answer's card still shows the count

#### Scenario: Start over clears the state
- **WHEN** the user says "start over"
- **THEN** the label, the count and the answers are forgotten

### Requirement: Follow-up general questions
For a general question, the system SHALL send the last 4 general questions and answers of the session as context, so a follow-up such as "and who was his wife?" is understood. Medicine questions and answers SHALL NOT be sent.

#### Scenario: Follow-up on a general answer
- **WHEN** the user asks "Who is Gandhi?" and then "Where was he born?"
- **THEN** the second request carries the first question and answer as context

#### Scenario: No medicine context
- **WHEN** a medicine answer was given before a general question
- **THEN** the medicine question and answer are not in the context sent
