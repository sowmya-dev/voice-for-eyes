# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. platform-and-privacy

- [ ] 1.1 [Requirement: Web client] Deliver the browser app with OpenCV.js and check it on a basic phone. Verify: "Open on a basic phone".
- [x] 1.2 [Requirement: Runs with Docker and no keys] Keep one-command Docker start on port 3000 and test a fresh copy. Verify: "Clean start", "No speech key".
- [x] 1.3 [Requirement: Secure connection for capture] Explain blocked capture on the main screen. Verify: "Insecure address".
- [ ] 1.4 [Requirement: Local-first and offline-capable] Cache app and models and verify offline and no-upload behaviour. Verify: "No network", "Default processing", "Detection fallback".
- [ ] 1.5 [Requirement: On-device speech stack] Integrate Silero VAD, Whisper language ID and sherpa-onnx in the browser. Verify: "Offline speech".
- [x] 1.6 [Requirement: Speech-to-text through Sarvam] Stream speech to Sarvam through the app server, keeping the key there, with tests. Verify: "Stream accepted", "Language code", "Key not exposed", "Stream refused".
- [x] 1.7 [Requirement: Label text reading] Read labels with Cloud Vision on two colour frames from the server, fall back to PaddleOCR in the browser, with tests and one live check. Verify: "Offline label", "Read by Cloud Vision", "Vertical name, horizontal expiry, read by the cloud", "Cloud Vision unavailable", "Vision key stays on the server".
- [ ] 1.8 [Requirement: Speech recognition speed] Measure recognition latency on a basic phone and meet the limit. Verify: "Latency measurement".
- [ ] 1.9 [Requirement: Speech test coverage] Run the language, accent and mixed-speech tests and write the report. Verify: "Test report".
- [x] 1.10 [Requirement: Logging] Add on-device logging and verify nothing is uploaded. Verify: "Interaction logged".
- [ ] 1.11 [Requirement: Swappable vision engines] Put each engine behind an adapter chosen by TEXT_READER and POCKET_DETECTOR, with tests. Verify: "Device reader chosen", "Reader default", "Detector off", "Unknown engine name", "Engines shown, keys hidden".
