# Tasks

One task per requirement. Spikes and review gates are in `design.md`, not here.

## 1. platform-and-privacy

- [ ] 1.1 [Requirement: Web client] Deliver the browser app with OpenCV.js and check it on a basic phone. Verify: "Open on a basic phone".
- [ ] 1.2 [Requirement: Runs with Docker and no keys] Keep one-command Docker start on port 3000 and test a fresh copy. Verify: "Clean start".
- [ ] 1.3 [Requirement: Secure connection for capture] Explain blocked capture on the main screen. Verify: "Insecure address".
- [ ] 1.4 [Requirement: Local-first and offline-capable] Cache app and models and verify offline and no-upload behaviour. Verify: "No network", "Default processing".
- [ ] 1.5 [Requirement: On-device speech stack] Integrate Silero VAD, Whisper language ID and sherpa-onnx in the browser. Verify: "Offline speech".
- [ ] 1.6 [Requirement: Speech-to-text fallback order] Implement the three-model fallback order. Verify: "Primary model cannot be used".
- [ ] 1.7 [Requirement: On-device OCR] Integrate PaddleOCR in the browser. Verify: "Offline label".
- [ ] 1.8 [Requirement: Speech recognition speed] Measure recognition latency on a basic phone and meet the limit. Verify: "Latency measurement".
- [ ] 1.9 [Requirement: Speech test coverage] Run the language, accent and mixed-speech tests and write the report. Verify: "Test report".
- [ ] 1.10 [Requirement: Logging] Add on-device logging and verify nothing is uploaded. Verify: "Interaction logged".
