# Spec Delta

## Purpose
Shows the assistant's state on screen, following the VoAI design export, while voice stays the main way to use the app.

## ADDED Requirements

### Requirement: Design tokens and type
Screens SHALL use the colours, radii and font stacks in `docs/design/voai/tokens.css`, Atkinson Hyperlegible for English and the matching Noto Sans font for each Indian script, and SHALL keep every text and background pair at a contrast of at least 4.5:1.

#### Scenario: Token colours
- **WHEN** a screen is rendered
- **THEN** its colours come from the design tokens

#### Scenario: Script font
- **WHEN** the session language is Hindi, Telugu or Kannada
- **THEN** text uses that script's Noto Sans font

### Requirement: Screen set
The client SHALL provide these screens: 1 Ready, listening; 1b Redirected to start; 2 Noisy speech check; 3 Medicine identified; 4 Expired warning; 5 Can't read label; 5d Come back later; and 6 Settings, with the content listed for each in the design spec.

#### Scenario: Expired screen
- **WHEN** the safety rules return an expired verdict
- **THEN** screen 4 is shown, with the warning text, a warning icon and a warning border, and no dosage

#### Scenario: Identified screen
- **WHEN** a medicine answer is ready
- **THEN** screen 3 shows the spoken answer and the risk question when the safety rules require it

### Requirement: Retry screens within 3 attempts
Screens 5b Flip or rotate and 5c Taking a photo SHALL be steps within the 3 attempts allowed for an unreadable label. Each move, flip or photo SHALL count as one attempt. The attempt dots SHALL show 3 attempts, and the screen SHALL say and show "Attempt N of 3" instead of "There is no limit". After the third failed attempt, the system SHALL show and say that it cannot confirm the information and ask the user to have someone check the label.

#### Scenario: Second attempt
- **WHEN** the label is still unreadable after the first attempt
- **THEN** screen 5b says "Attempt 2 of 3" and shows two of three dots filled

#### Scenario: Photo counts
- **WHEN** the user says "take photo" and the photo is still unreadable
- **THEN** that counts as one attempt

#### Scenario: Third attempt fails
- **WHEN** the third attempt fails
- **THEN** no further attempt is offered, and the screen and voice say the information cannot be confirmed and ask the user to have someone check the label

### Requirement: Voice decides the screen
One state machine SHALL choose the screen from what the user said and what the camera could read, following the routing table in the design spec. Buttons SHALL be a fallback that sends the same events.

#### Scenario: Spoken question
- **WHEN** the user asks "What is this tablet?" and the label is readable and in date
- **THEN** screen 3 is shown without any button press

#### Scenario: Button fallback
- **WHEN** the user presses a button instead of speaking
- **THEN** the same screen change happens as for the matching voice command

### Requirement: Global voice commands
The system SHALL accept "back", "start over", "later", "continue", "open settings", a language name and the confirmation words on every screen where the design spec allows them, in the user's language.

#### Scenario: Back
- **WHEN** the user says "back" or its Hindi, Telugu or Kannada word
- **THEN** the previous step of the user's journey is shown

#### Scenario: Start over
- **WHEN** the user says "start over"
- **THEN** screen 1 is shown and a new question is awaited

### Requirement: Finish the task first
"Next" and "settings" SHALL be accepted only when no task is open. Otherwise the system SHALL say "Let's finish this first." and show screen 1b.

#### Scenario: Too early
- **WHEN** the user says "open settings" while a medicine task is open
- **THEN** the system says "Let's finish this first." and shows screen 1b

### Requirement: Pause and resume
On "later" or "I'll come back" from a task screen, the system SHALL show screen 5d, keep listening for "continue", and on "continue" return to the step it left. The medicine SHALL be remembered only in memory while the page is open.

#### Scenario: Resume
- **WHEN** the user says "later" on screen 5 and then "continue"
- **THEN** screen 5d is shown, then screen 5 again with the same medicine

#### Scenario: Page closed
- **WHEN** the page is closed while paused
- **THEN** nothing about the medicine is kept

### Requirement: Phone layout
On widths below about 972 px, answer screens SHALL show the answer first and the camera on a second view, switched by "show camera" and "back to answer". Wider screens SHALL show both panes.

#### Scenario: Phone answer first
- **WHEN** screen 3 is shown 390 px wide
- **THEN** the answer is shown first and the camera is one command away

#### Scenario: No overflow
- **WHEN** any screen is loaded at 320, 390, 768, 1024 or 1280 px wide
- **THEN** nothing extends past the viewport

### Requirement: Accessible screens
Screens SHALL use real links and buttons, label icon-only controls, mark decorative images hidden, announce status and answers through live regions, show a 4 px focus ring, declare the page language, and never show a state by colour alone.

#### Scenario: Answer announced
- **WHEN** a new answer appears
- **THEN** it is in a live region that a screen reader announces

#### Scenario: Keyboard focus
- **WHEN** a control receives keyboard focus
- **THEN** a 4 px focus ring is visible

### Requirement: Interface language
Interface text SHALL come from `strings.json` in the session language and SHALL change only when the session language changes. Translations SHALL be reviewed by native speakers before shipping.

#### Scenario: Language follows speech
- **WHEN** the session language changes to Telugu
- **THEN** screen text and font change to Telugu, and layout stays the same

### Requirement: Settings screen
Screen 6 SHALL offer speaking speed with a sample, cloud help (off by default), always listening (on by default) and torch on at start (off by default), and SHALL have no language setting.

#### Scenario: Defaults
- **WHEN** settings are opened for the first time
- **THEN** cloud help is off, always listening is on and torch on at start is off

#### Scenario: Hear a sample
- **WHEN** the user changes the speaking speed and asks for a sample
- **THEN** a sample is spoken at the new speed
