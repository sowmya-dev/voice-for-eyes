# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. safety-rules

- [x] 1.1 [Requirement: Rules apply to every interaction] Route every plan through the rule engine, with a test. Verify: "Replayed or assisted answer".
- [x] 1.2 [Requirement: Label-only expiry and dosage] Allow expiry and dosage values only from accepted label fields, with a test. Verify: "Dosage not printed".
- [x] 1.3 [Requirement: No dose advice] Block dose recommendation and inference, with a test. Verify: "Asked what to take".
- [x] 1.4 [Requirement: Expiry dates need the EXP marker] Implement strict EXP date parsing, with tests. Verify: "Unmarked date", "Manufacturing date".
- [x] 1.5 [Requirement: Expired warning] Prepend the expired warning, with a test of the exact wording. Verify: "Expired medicine".
- [x] 1.6 [Requirement: No dosage for expired medicine] Remove dosage for expired medicine, with a test. Verify: "Dose of expired medicine".
- [x] 1.7 [Requirement: Risk confirmation] Implement the risk question and single repeat, with tests. Verify: "Confirmed", "Yes before the question is heard", "Not confirmed".
- [x] 1.8 [Requirement: No medicine recommendation] Block medicine recommendations, with tests. Verify: "Asked which to take".
- [x] 1.9 [Requirement: Asked about taking more] Answer repeat-dose questions without advice, with tests. Verify: "Count accepted", "Count not accepted".
- [x] 1.10 [Requirement: Expired medicine already taken] Handle an expired medicine already taken, with a test. Verify: "Took an expired tablet".
- [x] 1.11 [Requirement: Feeling unwell after taking a medicine] Give the help instruction before the label is read and add any warning or notice after it, with tests. Verify: "Dizzy after a tablet", "Unwell after an expired tablet", "Label not read yet", "Another strip since the last read", "Instruction fetched in advance".
- [ ] 1.12 [Requirement: Serious symptoms] Give the emergency instruction first and open the dialer with 108, with tests and a check on a real phone. Verify: "Someone nearby", "Voice comes over the network", "Dialer available", "Dialer unavailable", "Expired medicine".
