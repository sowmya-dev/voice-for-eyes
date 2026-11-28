# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. cloud-assistance

- [x] 1.1 [Requirement: Off by default] Add the toggle and the OpenRouter call on the app server, and test that nothing is sent while off. Verify: "First launch", "Toggle on".
- [x] 1.2 [Requirement: Missing cloud key] Report the missing key, keep it server-side and add .env.example. Verify: "Enable without a key".
- [ ] 1.3 [Requirement: Limited cloud use] Restrict cloud calls to the allowed tasks, and send a strip photo to Molmo only while cloud assistance is on, using its points alone, with tests. Verify: "Local recognition fails", "Strip photo with cloud off", "Points only".
- [x] 1.4 [Requirement: Never safety or dosage] Block cloud handling of safety and dosage answers, with a test. Verify: "Dosage question with cloud on".
