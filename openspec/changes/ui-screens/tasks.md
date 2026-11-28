# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. ui-screens

- [x] 1.1 [Requirement: Design tokens and type] Load `tokens.css` and the fonts, and check contrast, with tests. Verify: "Token colours", "Script font".
- [x] 1.2 [Requirement: Screen set] Build the screens from the design export, with tests. Verify: "Expired screen", "Identified screen".
- [x] 1.11 [Requirement: Retry screens within 3 attempts] Build screens 5b and 5c with a 3-attempt counter and the final message, with tests. Verify: "Second attempt", "Photo counts", "Third attempt fails".
- [x] 1.3 [Requirement: Voice decides the screen] Implement the screen state machine from the routing table, with tests. Verify: "Spoken question", "Button fallback".
- [x] 1.4 [Requirement: Global voice commands] Handle the global commands in each language, with tests. Verify: "Back", "Start over".
- [x] 1.5 [Requirement: Finish the task first] Gate "next" and "settings", with a test. Verify: "Too early".
- [x] 1.6 [Requirement: Pause and resume] Implement screen 5d and resume, with tests. Verify: "Resume", "Page closed".
- [x] 1.7 [Requirement: Phone layout] Implement the answer and camera views and check widths, with tests. Verify: "Phone answer first", "No overflow".
- [x] 1.8 [Requirement: Accessible screens] Apply the accessibility rules, with tests. Verify: "Answer announced", "Keyboard focus".
- [ ] 1.9 [Requirement: Interface language] Load strings by session language, with a test. Verify: "Language follows speech".
- [x] 1.10 [Requirement: Settings screen] Build screen 6 and its defaults, with tests. Verify: "Defaults", "Hear a sample".
