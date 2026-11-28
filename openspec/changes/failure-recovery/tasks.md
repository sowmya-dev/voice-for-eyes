# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. failure-recovery

- [x] 1.1 [Requirement: Noisy speech] Implement cross-check, repeat-or-quieter, label reading, request confirmation and repeat-question steps, with tests. Verify: "Treated as unclear", "Resolved by camera text", "Unresolved", "Still not fully understood", "Likely request", "Still unclear".
- [x] 1.2 [Requirement: Repeat after clarification] Begin the clarified reply with what was heard, with a test. Verify: "Clarified".
- [x] 1.3 [Requirement: Unknown intent ladder] Implement the three unknown-intent steps, with a test. Verify: "Escalation".
- [x] 1.4 [Requirement: Clean before asking again] Enforce five seconds of cleaning, or 17 once a field is read, before any movement request, with tests. Verify: "Blurry label", "Partly read label".
- [ ] 1.5 [Requirement: Unreadable label response] State readable information, then the exact sentence, with a test. Verify: "Expiry unreadable", "One exact direction".
- [x] 1.6 [Requirement: Nothing from unclear text] Block guesses and dosage from unclear text, with a test. Verify: "Unclear dosage".
- [x] 1.7 [Requirement: Retry limit for an unreadable label] Limit movement requests to 3, or 5 once a field is read, and give the final message, with tests. Verify: "Readable on a retry", "Partly read gets five tries", "Third retry fails".
- [ ] 1.8 [Requirement: Cut strip] Detect a cut-off expiry and skip movement retries, with tests. Verify: "Expiry cut off", "Not sure it is cut".
- [x] 1.9 [Requirement: Whole strip for a count] Ask once for the entire strip or the printed side, then answer honestly with what was seen, with tests. Verify: "Strip not fully visible", "Counted on a retry", "One request, then an honest answer", "Used pockets seen, nothing left to work out".
- [x] 1.10 [Requirement: Camera check first] Check the camera before asking to move the medicine, with tests. Verify: "Shaky phone", "Moving but sharp", "Hazy camera", "Camera fixed".
