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

### Requirement: Conversational replies
Replies SHALL sound like a person talking while every sentence still comes from a fixed template. Identification SHALL be said as a sentence ("This is Dolo 650, a fever tablet."). When a read takes longer than the first look and part of the label is already read, the system SHALL say once that it is still reading, naming what it has ("I can see Dolo 650. Hold it there, I'm still reading the rest."). After a medicine answer with no warning and no risk question, the system SHALL offer one thing it has not yet told in this session (what the medicine is, then the expiry, then the count, but the count only when a count is already remembered, so that an offer never leads to a request to show the strip; identification tells the name and the expiry) as a yes-or-no question, and a "yes" SHALL be answered from the remembered label. The exact sentences required by the safety and failure-recovery rules SHALL NOT change.

#### Scenario: Identified as a sentence
- **WHEN** the user asks "What is this tablet?" about Dolo 650
- **THEN** the reply begins "This is Dolo 650"

#### Scenario: Still reading
- **WHEN** the name is read but the expiry is not yet, and reading continues
- **THEN** the system says once that it can see the name and is still reading the rest

#### Scenario: Offer what is left
- **WHEN** the user has asked when the tablet expires but not what it is
- **THEN** the reply ends by asking whether they would like to know what this medicine is

#### Scenario: Offer accepted
- **WHEN** the user says "yes" to the offer
- **THEN** the answer comes from the remembered label without reading the camera

#### Scenario: Nothing left to offer
- **WHEN** the name, the expiry and the count have been told, or only the count is left and no count is remembered
- **THEN** no offer is made

#### Scenario: Count offered only when known
- **WHEN** the tablets were counted in the background and the name and the expiry have been told
- **THEN** the count is offered, and a "yes" is answered from memory without the camera

#### Scenario: Count not offered after it failed
- **WHEN** a strip model is configured but no count could be worked out for this strip
- **THEN** the count is not offered

#### Scenario: No offer after a warning
- **WHEN** the answer carries the expired warning or asks "Do you understand the risk?"
- **THEN** no offer is made

### Requirement: Count from the printed total
The label and the strip SHALL be used together. The system SHALL read the printed pack size from the label (such as "10 Tablets", "10 Capsules", "1 x 10", "10x10 Tablets" or "Strip of 10"), keep it with the remembered label, and, when no full-pocket count is available but the strip model reports empty pockets in two agreeing frames, SHALL give the printed total minus the empty pockets, saying how it was worked out ("The strip holds 10. I can see 3 used, so 7 should be left."). If the empty pockets are known but the printed total is not, the system SHALL ask the user to show the side that says how many the strip holds, read it, and then answer. It SHALL NOT give a count when more pockets are empty than the strip holds.

#### Scenario: Worked out from the print
- **WHEN** the label says "10 Tablets" and both frames show 3 empty pockets
- **THEN** the system says the strip holds 10, 3 are used, and 7 should be left

#### Scenario: Printed total not read yet
- **WHEN** 3 empty pockets are seen but the printed total has not been read
- **THEN** the system asks to see the side with the pack size, reads it, and then gives the count

#### Scenario: Pack size written as 1 x 10
- **WHEN** the label says "1 x 10 Tablets" or "Strip of 10 Capsules"
- **THEN** the printed total is 10

#### Scenario: More empty than printed
- **WHEN** the label says 10 and 12 empty pockets are reported
- **THEN** no count is given

### Requirement: Everything printed, by size
The system SHALL keep every line of text that two copies agree on, with its letter size, ranked from the largest letters down in four tiers (largest, larger, large, small, relative to the largest line), and SHALL merge it across reads into the remembered label until the user says "start over". The name SHALL remain the largest line that is not a known non-name. When the user asks what is written ("Read the label", "What else is written?", "What does it say?"), the system SHALL read the kept lines from the largest letters down, at most 8 at a time, then offer to go on. Lines about dosage SHALL be left out of this reading and the user told to ask for the dosage separately, so dosage stays behind its safety rules; an expired label SHALL still begin with the expired warning.

#### Scenario: Ranked by size
- **WHEN** a label has a large name, a medium ingredient line and small manufacturer text
- **THEN** the lines are kept largest first, in that order, with their tiers

#### Scenario: Kept across reads
- **WHEN** the front is read and then the back
- **THEN** the lines of both sides are kept together, each once

#### Scenario: Read everything
- **WHEN** the user asks "What else is written on it?"
- **THEN** the kept lines are read from the largest letters down, from memory

#### Scenario: More text
- **WHEN** more than 8 lines are kept and the user says "yes" to going on
- **THEN** the next 8 lines are read

#### Scenario: Dosage left out
- **WHEN** a kept line reads "Dosage: 1 tablet twice daily"
- **THEN** that line is not read out, and the user is told to ask for the dosage separately

#### Scenario: Expired label read out
- **WHEN** the label has expired and the user asks what is written
- **THEN** the reply begins with the expired warning

### Requirement: Composition and description
The system SHALL read, agree across copies and remember with the label: the composition (the lines after "Composition" or "Each tablet contains", with their strengths), the generic or chemical name line (such as "Paracetamol Tablets IP 650 mg") and the maker. When the user asks what the medicine contains, what it is made of, or its chemical or generic name, the system SHALL answer from the printed composition, else the printed generic name, else the ingredient found on the label, and otherwise say it cannot read it. When the user asks to be told about the medicine, the system SHALL describe it in a few plain sentences: what it is and what it is for, its generic name, what it contains, who makes it, the expiry and the pack size, each only when read. These answers SHALL come from the remembered label when it is there, and SHALL follow the expired-warning rules.

#### Scenario: Composition printed
- **WHEN** the label says "Composition: Each tablet contains Paracetamol IP 650 mg" and the user asks "What does it contain?"
- **THEN** the system says it contains Paracetamol IP 650 mg

#### Scenario: Chemical name
- **WHEN** the label prints "Paracetamol Tablets IP 650 mg" and no composition, and the user asks for the chemical name
- **THEN** the system says the generic name is Paracetamol Tablets IP 650 mg

#### Scenario: Composition not readable
- **WHEN** neither a composition, a generic name nor an ingredient was read
- **THEN** the system says it cannot read what the medicine contains

#### Scenario: Tell me about it
- **WHEN** the user says "Tell me about this medicine"
- **THEN** the reply describes what it is, its generic name, what it contains, its maker, its expiry and its pack size, from memory

#### Scenario: Expired description
- **WHEN** the label has expired and the user asks for a description
- **THEN** the reply begins with the expired warning
