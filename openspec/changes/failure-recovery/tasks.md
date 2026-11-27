# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. failure-recovery

- [ ] 1.1 [Requirement: Noisy speech] Implement cross-check, repeat question and label reading steps, with tests. Verify: "Resolved by camera text", "Unresolved", "Still unclear".
- [ ] 1.2 [Requirement: Repeat after clarification] Begin the clarified reply with what was heard, with a test. Verify: "Clarified".
- [ ] 1.3 [Requirement: Unknown intent ladder] Implement the three unknown-intent steps, with a test. Verify: "Escalation".
- [ ] 1.4 [Requirement: Clean before asking again] Enforce five seconds of cleaning before any movement request, with a test. Verify: "Blurry label".
- [ ] 1.5 [Requirement: Unreadable label response] State readable information, then the exact sentence, with a test. Verify: "Expiry unreadable".
- [ ] 1.6 [Requirement: Nothing from unclear text] Block guesses and dosage from unclear text, with a test. Verify: "Unclear dosage".
