# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. voice-interaction

- [x] 1.1 [Requirement: Automatic start] Start capture on load, with the one-tap start when the browser requires it. Verify: "App opens", "Browser needs a user action".
- [x] 1.2 [Requirement: Continuous listening and mute] Detect utterances without a wake word and add the mute control. Verify: "Question without a wake word", "Muted".
- [ ] 1.3 [Requirement: Interruption] Fade out speech and cancel the old turn when the user speaks. Verify: "Interrupt an answer".
- [x] 1.4 [Requirement: Uninterrupted capture] Keep preview and listening active in every session state. Verify: "While speaking".
- [ ] 1.5 [Requirement: Accessible camera interface] Build the accessible camera screen with torch control and test with a screen reader. Verify: "Torch", "Torch not supported".
- [x] 1.6 [Requirement: Rule-based intent routing] Build per-language keyword tables and the router. Verify: "Recognised intent", "No rule matches".
- [x] 1.7 [Requirement: Single interaction pipeline] Build the pipeline runner that sends every answer through the rule engine. Verify: "No bypass".
