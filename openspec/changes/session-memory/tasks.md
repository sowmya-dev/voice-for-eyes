# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. session-memory

- [x] 1.1 [Requirement: RAM-only session memory] Implement in-memory session storage and verify nothing is persisted. Verify: "App closed".
- [ ] 1.2 [Requirement: Replay repeated questions] Implement lookup and replay keyed by label and question, with tests. Verify: "Same label", "Different label".
- [x] 1.3 [Requirement: Label gathered across reads] Merge accepted fields across reads, drop them on a different name or expiry, with tests. Verify: "Name then expiry", "Different strip", "Same name, different expiry".
- [x] 1.4 [Requirement: Answer from the remembered label] Answer follow-ups from the remembered label and read again on identify, start over or after 5 minutes, with tests. Verify: "Follow-up question", "New tablet", "Start over", "Label too old".
- [x] 1.5 [Requirement: Count gathered with the label] Count once in the background after a complete label and forget it when a tablet is taken, with tests. Verify: "Count remembered", "Tablet taken".
