# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. expiry-soon-warning

- [x] 1.1 [Requirement: Time left before expiry] Implement the date classification, with tests. Verify: "Last valid day", "Day after expiry", "Seven days left", "Eight days left", "One month boundary", "Past one month", "Shorter next month", "Month and year only".
- [x] 1.2 [Requirement: Expiry-soon notice] Add the notice to medicine answers, with tests. Verify: "Within 7 days", "Within one month", "More than one month", "Already expired", "Expiry not accepted".
