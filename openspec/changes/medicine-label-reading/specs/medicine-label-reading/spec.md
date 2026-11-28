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
The system SHALL take a medicine's purpose only from an ingredient table bundled with the app, and whenever it states a purpose, SHALL ask the user to confirm with a doctor or pharmacist before taking it.

#### Scenario: Purpose stated
- **WHEN** the system states what a medicine is used for
- **THEN** it also asks the user to confirm with a doctor or pharmacist before taking it

#### Scenario: Ingredient not listed
- **WHEN** the ingredient is not in the table
- **THEN** no purpose is stated

### Requirement: Printed information only
The system SHALL read quantities from printed label text and SHALL NOT guess any label value. The one exception is a count question: the camera MAY count the tablets visible in a strip. A visible count SHALL be stated as what the system can see, and SHALL NOT be used for dosage or dose advice.

#### Scenario: Count question
- **WHEN** the user asks "How many are left in this strip?" and the count is accepted from printed text
- **THEN** the system replies with the number, for example "2."

#### Scenario: Visible tablets counted
- **WHEN** the user asks how many are left, no printed count says so, and the visible tablets can be counted reliably
- **THEN** the system says how many it can see, for example "I can see 4 tablets.", and gives no dose advice

#### Scenario: Count not available
- **WHEN** no count can be accepted from printed text or reliably from the visible tablets
- **THEN** the system does not state a number

### Requirement: Food labels and follow-ups
The system SHALL support food label reading, nutritional information and follow-up questions.

#### Scenario: Nutrition follow-up
- **WHEN** the user asks about nutrition while showing a food label
- **THEN** the system answers from the readable printed information

### Requirement: Spoken templates and voice
The system SHALL compose replies from language-specific templates and speak them with Sarvam text-to-speech through the app server. When Sarvam cannot be used, it SHALL use only a browser voice for that language: an on-device voice, or an online voice only while cloud help is on. With no such voice, it SHALL keep the answer on screen, play a warning sound and show that the answer could not be spoken.

#### Scenario: Spoken reply
- **WHEN** an answer is ready and Sarvam can be used
- **THEN** it is composed from that language's template and spoken with Sarvam's voice for that language

#### Scenario: Sarvam unavailable
- **WHEN** Sarvam cannot be used and the device has its own voice for the language
- **THEN** the answer is spoken with that on-device voice

#### Scenario: No online browser voice while cloud help is off
- **WHEN** Sarvam cannot be used, cloud help is off and the only browser voice for the language is online
- **THEN** no browser voice is used, so the reply text does not reach an online voice service

#### Scenario: No voice at all
- **WHEN** no permitted voice can speak the language
- **THEN** a warning sound plays and the screen shows that the answer could not be spoken

#### Scenario: Speech key stays on the server
- **WHEN** a reply is spoken
- **THEN** the browser sends the reply text to the app server only, and never receives the Sarvam key

#### Scenario: Stopped by the user
- **WHEN** the user interrupts while a reply is being fetched or played
- **THEN** it stops, fading out if it is playing Sarvam audio, and is not played later

#### Scenario: Name spoken as a word
- **WHEN** a reply names a medicine printed in capitals, such as "DOLO-650"
- **THEN** the name is spoken as a word with the same strength, and the screen keeps the label text

#### Scenario: Strength in Kannada
- **WHEN** a Kannada reply gives a medicine strength of three or more digits
- **THEN** its digits are spoken one at a time

#### Scenario: No wait between parts
- **WHEN** a reply starts with a sentence fetched in advance, or the risk question follows an answer
- **THEN** that sentence plays at once, and anything after it is fetched while it plays

### Requirement: Admit what is unreadable
The system SHALL openly say when information cannot be read.

#### Scenario: Partly readable
- **WHEN** only some requested information is readable
- **THEN** the system states that information and says the rest cannot be read

### Requirement: Two strips in view
When two medicine strips are in view, the system SHALL name each medicine that has a readable name, without mixing their details, and ask the user to show the expiry of both.

#### Scenario: Two readable strips
- **WHEN** the user shows two strips with readable names
- **THEN** the system names both and asks the user to show the expiry of both

#### Scenario: One name unreadable
- **WHEN** only one of the two names is readable
- **THEN** the system names that one, says it cannot read the other, and gives the other no name or purpose
