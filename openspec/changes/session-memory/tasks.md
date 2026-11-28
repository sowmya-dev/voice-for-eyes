# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. session-memory

- [x] 1.1 [Requirement: RAM-only session memory] Implement in-memory session storage and verify nothing is persisted. Verify: "App closed".
- [ ] 1.2 [Requirement: Replay repeated questions] Implement lookup and replay keyed by label and question, with tests. Verify: "Same label", "Different label".
- [x] 1.3 [Requirement: Label gathered across reads] Merge accepted fields across reads, drop them on a different name or expiry, with tests. Verify: "Name then expiry", "Different strip", "Same name, different expiry".
- [x] 1.4 [Requirement: Answer from the remembered label] Answer from the remembered label until start over; identify takes one look and keeps memory unless the strip differs, with tests. Verify: "Follow-up question", "New tablet", "Same tablet asked again", "Start over", "Long pause".
- [x] 1.5 [Requirement: Count gathered with the label] Count once in the background after a complete label and forget it when a tablet is taken, with tests. Verify: "Count remembered", "Tablet taken".
- [x] 1.6 [Requirement: Session state kept and shown] Keep label, count and answers until start over and show them on every medicine card, with tests. Verify: "Card keeps the count", "Start over clears the state".
- [x] 1.7 [Requirement: Follow-up general questions] Send the last 4 general questions and answers as context, never medicine ones, with tests. Verify: "Follow-up on a general answer", "No medicine context".
