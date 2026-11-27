# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. safety-rules

- [ ] 1.1 [Requirement: Rules apply to every interaction] Route every plan through the rule engine, with a test. Verify: "Replayed or assisted answer".
- [ ] 1.2 [Requirement: Label-only expiry and dosage] Allow expiry and dosage values only from accepted label fields, with a test. Verify: "Dosage not printed".
- [ ] 1.3 [Requirement: No dose advice] Block dose recommendation and inference, with a test. Verify: "Asked what to take".
- [ ] 1.4 [Requirement: Expiry dates need the EXP marker] Implement strict EXP date parsing, with tests. Verify: "Unmarked date".
- [ ] 1.5 [Requirement: Expired warning] Prepend the expired warning, with a test of the exact wording. Verify: "Expired medicine".
- [ ] 1.6 [Requirement: No dosage for expired medicine] Remove dosage for expired medicine, with a test. Verify: "Dose of expired medicine".
- [ ] 1.7 [Requirement: Risk confirmation] Implement the risk question and single repeat, with tests. Verify: "Confirmed", "Not confirmed".
