# Spec Delta

## Purpose
Gives predictable, honest recovery when speech or labels cannot be understood.

## ADDED Requirements

### Requirement: Noisy speech
When speech is not fully understood because of noise or doubt, the system SHALL recover in this order until it is resolved: cross-check camera text; ask the user to repeat or move somewhere quieter; read the label and confirm any likely request; ask the user to repeat the question. It SHALL NOT volunteer dosage, and safety rules SHALL apply to anything read out.

#### Scenario: Treated as unclear
- **WHEN** the final transcript is empty, matches no request, or names a medicine different from the accepted label name
- **THEN** the speech is treated as not fully understood and the recovery steps start

#### Scenario: Resolved by camera text
- **WHEN** camera text resolves a doubtful transcript
- **THEN** the system continues without asking the user to repeat

#### Scenario: Unresolved
- **WHEN** camera text does not resolve the transcript
- **THEN** the system asks the user to repeat or move to a place with less noise

#### Scenario: Still not fully understood
- **WHEN** the next attempt is still not fully understood
- **THEN** the system states the accepted label details, such as the name and expiry date, with any expired warning first and no unasked dosage

#### Scenario: Likely request
- **WHEN** the system has a likely request, such as the expiry date
- **THEN** it asks "Do you want to know the expiry date?" in words that match that request, and does not act on it before the user clearly confirms

#### Scenario: Still unclear
- **WHEN** there is no likely request, or the user does not clearly confirm it
- **THEN** the system asks the user to repeat the question

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
The system SHALL NOT immediately ask for another photo, and SHALL first spend five seconds cleaning the image, or 17 seconds once at least one field of the label (name or expiry) has been read.

#### Scenario: Blurry label
- **WHEN** the label is blurry
- **THEN** the system spends five seconds cleaning the image before asking the user to move anything

#### Scenario: Partly read label
- **WHEN** the name has been read but the expiry has not
- **THEN** the system keeps reading for 17 seconds before asking the user to move anything

### Requirement: Unreadable label response
If the name or expiry is still unreadable after cleaning, the system SHALL keep what was read, show it on the screen card, state what is readable and then say exactly: "I can't read this. Move the medicine up/down/left/right so I can see the expiry date."

#### Scenario: Expiry unreadable
- **WHEN** the name is readable and the expiry is not
- **THEN** the system shows the name on the card, states the name, then says the exact sentence

#### Scenario: One exact direction
- **WHEN** the system asks the user to move the medicine
- **THEN** "up/down/left/right" is replaced by the single direction, as the user sees it while holding the medicine, that will bring the unreadable text into better view

### Requirement: Retry limit for an unreadable label
The system SHALL make at most 3 attempts for the same unreadable label, or at most 5 once at least one field of the label has been read, where each request to move, flip or turn the medicine, or to take a photo, counts as one attempt, cleaning the image again after each. If it is still unreadable after the last attempt, the system SHALL stop asking, say that it cannot confirm the unreadable information, and suggest that someone check the label before the medicine is taken.

#### Scenario: Readable on a retry
- **WHEN** the information becomes readable after any of the 3 moves
- **THEN** the system answers from it and asks for no more moves

#### Scenario: Partly read gets five tries
- **WHEN** the name was read but the expiry is still unreadable after the third move
- **THEN** the system asks for up to two more moves before it stops

#### Scenario: Third retry fails
- **WHEN** nothing on the label was read and it is still unreadable after the third move
- **THEN** the system stops asking, says it cannot confirm it, and suggests that someone check the label before the medicine is taken

### Requirement: Nothing from unclear text
The system SHALL NOT guess, or provide dosage information, from unclear text.

#### Scenario: Unclear dosage
- **WHEN** the dosage text is unclear
- **THEN** no dosage information is given

### Requirement: Cut strip
When the system can tell that the part of a strip with the expiry has been cut off, it SHALL say that the strip is cut and it cannot see the expiry, and ask the user to have someone check it. It SHALL NOT ask the user to move the medicine for that expiry. This replaces the unreadable-label steps.

#### Scenario: Expiry cut off
- **WHEN** the system can tell that the expiry has been cut off
- **THEN** it says the strip is cut and the expiry cannot be seen, asks the user to have someone check, and asks for no moves

#### Scenario: Not sure it is cut
- **WHEN** the system cannot tell whether the strip is cut
- **THEN** the unreadable-label steps apply

### Requirement: Whole strip for a count
When the user asks how many tablets are in a strip and no count can be accepted, the system SHALL ask the user to show the entire strip, at most 3 times. If the count is still not reliable after that, the system SHALL stop asking, say that it cannot count the tablets, and ask the user to have someone count them.

#### Scenario: Strip not fully visible
- **WHEN** part of the strip is hidden or unclear and no count can be accepted
- **THEN** the system asks the user to show the entire strip and states no number

#### Scenario: Counted on a retry
- **WHEN** the count becomes reliable after any of the 3 requests
- **THEN** the system states it and asks no more

#### Scenario: Third count retry fails
- **WHEN** the count is still not reliable after the third request
- **THEN** the system says it cannot count the tablets and asks the user to have someone count them

### Requirement: Camera check first
Before asking the user to move the medicine, the system SHALL check the camera. If pictures are blurry from movement, stay hazy after cleaning and a retry, or the camera is not pointed at the medicine, it SHALL tell the user how to fix the camera first. Only once the camera is fixed SHALL it ask the user to move the medicine.

#### Scenario: Shaky phone
- **WHEN** pictures are blurred by movement
- **THEN** the system asks the user to hold the phone still, before any request to move the medicine

#### Scenario: Moving but sharp
- **WHEN** the frames moved but the sharpest frame is clear
- **THEN** the system does not ask the user to hold still, because the cleaned image is used

#### Scenario: Hazy camera
- **WHEN** every frame stays hazy after cleaning and a retry
- **THEN** the system suggests wiping the camera lens

#### Scenario: Camera fixed
- **WHEN** the camera is steady and clear but the strip is not fully in view
- **THEN** the system asks the user to move the medicine, one direction at a time
