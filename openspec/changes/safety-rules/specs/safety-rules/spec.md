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

#### Scenario: Manufacturing date
- **WHEN** the label shows "MFG 01/2025" and "EXP 12/2027"
- **THEN** the expiry is December 2027 and the MFG date is never used as the expiry date

### Requirement: Expired warning
For an expired medicine the response SHALL always begin with "Warning: this has expired. Please do not take it." Only the emergency instruction or the feeling-unwell instruction may come before it.

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

#### Scenario: Yes before the question is heard
- **WHEN** the user says a confirm word after an answer but before the risk question has started to play
- **THEN** it does not confirm, and the question is asked

#### Scenario: Not confirmed
- **WHEN** the user does not explicitly confirm
- **THEN** the answer is repeated exactly one time

### Requirement: No medicine recommendation
The system SHALL NOT recommend or choose a medicine for the user, and SHALL ask the user to consult a doctor or pharmacist when asked to.

#### Scenario: Asked which to take
- **WHEN** the user asks which medicine they should take
- **THEN** the system recommends none and asks them to consult a doctor or pharmacist

### Requirement: Asked about taking more
When the user says they have taken a medicine and asks about taking more, the system SHALL repeat what the user said they took, state how many are left only if that count is accepted under the label-reading rules, say that it cannot advise how many to take, and ask them to consult a doctor. It SHALL NOT say whether they may take more.

#### Scenario: Count accepted
- **WHEN** the user says they took one and asks to take another, and the count left is accepted
- **THEN** the system says that they said they took one, states the count left, says it cannot advise how many to take, and asks them to consult a doctor

#### Scenario: Count not accepted
- **WHEN** no count left is accepted
- **THEN** the system states no number, says it cannot tell how many are left or advise how many to take, and asks them to consult a doctor

### Requirement: Expired medicine already taken
When the user says they have taken a medicine that has expired, the response SHALL begin with the expired warning, then ask the user to consult a doctor right away. It SHALL give no dosage, and the risk confirmation SHALL still apply.

#### Scenario: Took an expired tablet
- **WHEN** the user says "I just took one" and the accepted expiry date has passed
- **THEN** the system gives the expired warning first, asks the user to consult a doctor right away, gives no dosage, and asks "Do you understand the risk?"

### Requirement: Feeling unwell after taking a medicine
When the user says they feel unwell after taking a medicine, the system SHALL first tell them to get help from someone nearby and then contact a doctor, without waiting for the label to be read. An expired warning or expiry-soon notice that applies SHALL follow that instruction. It SHALL give no medical judgement and no dosage.

#### Scenario: Dizzy after a tablet
- **WHEN** the user says "I took this tablet and now I feel dizzy"
- **THEN** the first words tell them to get help from someone nearby and then contact a doctor, without judging the cause

#### Scenario: Unwell after an expired tablet
- **WHEN** the user feels unwell and the medicine has expired
- **THEN** the help instruction comes first and the expired warning follows it

#### Scenario: Label not read yet
- **WHEN** no label has been read in this session
- **THEN** the instruction is spoken before any camera frame is read, and the label is read afterwards for a warning or notice

#### Scenario: Another strip since the last read
- **WHEN** the last label read was in date and the strip now in view has expired
- **THEN** the instruction is spoken at once and the expired warning follows after the new read

#### Scenario: Instruction fetched in advance
- **WHEN** replies are spoken by a network voice
- **THEN** the help instruction, prepared in advance for the session language, plays without waiting

### Requirement: Serious symptoms
When the user reports a serious symptom after taking a medicine, such as trouble breathing or feeling about to faint, the system SHALL first tell them to get anyone with them to help call for emergency help, and to call 108. It SHALL try to open the phone dialer with 108 entered, and SHALL NOT say a call has been made when it cannot know that. Nothing, including the expired warning or the risk question, SHALL delay this instruction.

#### Scenario: Someone nearby
- **WHEN** the user says they cannot breathe properly
- **THEN** the first words tell them to ask anyone with them to help call 108

#### Scenario: Voice comes over the network
- **WHEN** replies are spoken by a network voice that is slow or cannot be reached
- **THEN** the emergency instruction, prepared in advance for the session language, plays without waiting

#### Scenario: Dialer available
- **WHEN** the device can place phone calls and the browser allows it
- **THEN** the dialer opens with 108 entered, or one tap anywhere opens it, and the user is told what to do to place the call

#### Scenario: Dialer unavailable
- **WHEN** the dialer cannot be opened
- **THEN** the system tells the user to dial 108 from a phone or ask someone to, and repeats the number

#### Scenario: Expired medicine
- **WHEN** the medicine is also expired
- **THEN** the emergency instruction comes first and the expired warning follows it
