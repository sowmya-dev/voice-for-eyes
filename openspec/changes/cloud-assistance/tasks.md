# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. cloud-assistance

- [x] 1.1 [Requirement: Off by default] Add the toggle and the OpenRouter call on the app server, and test that nothing is sent while off. Verify: "First launch", "Toggle on".
- [x] 1.2 [Requirement: Missing cloud key] Report the missing key, keep it server-side and add .env.example. Verify: "Enable without a key".
- [x] 1.3 [Requirement: Limited cloud use] Restrict cloud calls to the three allowed tasks, with tests. Verify: "Local recognition fails".
- [x] 1.4 [Requirement: Never safety or dosage] Block cloud handling of safety and dosage answers, with a test. Verify: "Dosage question with cloud on".
