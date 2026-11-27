# Spec Delta: voice-first-medicine-label-assistant

## Purpose
A voice-first Android assistant for visually impaired people in India that reads medicine labels by voice and describes the room — all on-device, in the user's language.

## ADDED Requirements

### Requirement: Voice-first entry point
The assistant opens straight into camera view and starts listening.

#### Scenario: Open the app
- WHEN the user opens the app, THEN the camera view starts and the assistant starts listening.

### Requirement: Label reading
WHEN the user asks "What is this tablet?" and holds the strip, the assistant reads the label from the camera.

#### Scenario: Read the label
- WHEN the user asks to read the label, THEN the assistant speaks the name, expiry, quantity — danger first, in the user's language.

### Requirement: Expiry warning
Rule-based, never guessed.

#### Scenario: Expired medicine
- WHEN the label reads as expired (OCR date past), THEN the assistant warns first: "Warning: this has expired. Please do not take it."

### Requirement: Safety answers
Danger-critical answers are never assumed.

#### Scenario: Safety question
- WHEN the user asks "Is this safe with diabetes?", THEN the answer comes from the label (yes/no + brief why).

### Requirement: Questions from the label

#### Scenario: Quantity question
- WHEN the user asks "How many do I take?", THEN the answer comes from the label.

### Requirement: Admit when unreadable

#### Scenario: Can't read
- WHEN the label can't be read or the medicine can't be found, THEN the assistant admits it and asks the user to move the medicine (left/right/up/down).

### Requirement: Read-back + misheard handling
Every answer is read back; safety answers require spoken confirmation.

#### Scenario: Read-back
- WHEN the assistant speaks an answer, THEN it reads back what it said ("You said: Dolo 650") and asks "Yes or rephrase?"

#### Scenario: Safety confirmation
- WHEN the answer is expiry/dosage (safety-critical), THEN the assistant requires an explicit spoken "Yes, I understand the risk."

### Requirement: Camera cross-check + re-ask
No assumption — only visible info.

#### Scenario: Noise/hallucination
- WHEN the decode is uncertain or looks hallucinated, THEN the assistant cross-checks against the camera label and asks the user to move the medicine if needed.

#### Scenario: Empty decode
- WHEN nothing decodes after 2 tries, THEN the assistant affirms it's still here and asks the user to re-show the camera.

### Requirement: Room description

#### Scenario: Around me
- WHEN the user asks "What's around me?", THEN the camera describes the room aloud; follow-ups like "Where is the door?"

### Requirement: Conversation memory

#### Scenario: Same question again
- WHEN a previous question is informational (no image input) and asked again, THEN the assistant reuses the queued answer.
