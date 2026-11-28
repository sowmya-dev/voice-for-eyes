# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. label-reading-screen

- [x] 1.1 [Requirement: No label reading on the landing screen] Remove the early read and the landing reading and loading notices, with tests and a browser check of which screen is showing when frames are read. Verify: "Waiting for a question", "Still speaking", "Reader still loading".
- [x] 1.2 [Requirement: Label reading screen] Add the reading screen and move to it before each label read that needs it, with tests and browser checks. Verify: "Question needs the label", "Unclear question", "No label needed", "Camera screens keep their own view", "Emergency stays on screen", "Back from the result", "Commands while reading", "Phone shows the camera".
