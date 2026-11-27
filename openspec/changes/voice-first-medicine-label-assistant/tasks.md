# Tasks

## 1. Android app skeleton
- [ ] 1.1 Scaffold the Android (Kotlin) app — camera + microphone access; verify the camera runs on device (adb logcat, screencap).

## 2. OpenAI Whisper on-device ASR (sherpa-onnx or whisper.cpp)
- [ ] 2.1 Integrate sherpa-onnx (k2-fsa, Kotlin/Java APIs + prebuilt AAR) + Whisper multilingual ONNX (sherpa export); or whisper.cpp (CMake/Gradle) + whisper-tiny-hindi-ggml; measure latency on phone hardware.
- [ ] 2.2 Wire silero VAD (on-device) — streaming audio chunks → OpenAI Whisper decode → transcript + confidence.
- [ ] 2.3 Test OpenAI Whisper on Hindi/Tamil/Kannada/Telugu/English audio — note accuracy on India-relevant utterances (Hindi dominant).

## 3. Camera + label OCR
- [ ] 3.1 Integrate doCAP (OCR, ONNX, on-device) — extract label text from a medicine strip; iterate until stable on sample labels.
- [ ] 3.2 Add voice repositioning — if OCR finds no label, the assistant asks the user to move it.

## 4. Voice loop + AC2 logic (specs)
- [ ] 4.1 Read-back on every answer + rephrase loop; safety confirmations (Haan/Yes/Howdu/Avunu/Aama).
- [ ] 4.2 Memory: queue of (question, answer); reuse on repeat questions.
- [ ] 4.3 Room description via on-device small VLM ("What's around me?").

## 5. Language add-ons (on-device)
- [ ] 5.1 IndicWhisper (AI4Bharat, ONNX) — 12 languages; measure on Hindi/Kannada/Telugu/Tamil.
- [ ] 5.2 Shruti-ONNX (udgamlabs, on-device) — all 22 languages; measure.
- [ ] 5.3 OpenFlow-Telugish — Telugish code-switch coverage.
- [ ] 5.4 Spikes: (a) sherpa-onnx + Shruti-ONNX (all 22 official) → (b) IndicWhisper (12) → (c) whisper.cpp comparison (OpenAI Whisper ggml ports) — pick one for Android impl.

## 6. Expiry rule engine
- [ ] 6.1 Hard rules — OCR date → parse → compare to device date; warn if past; admit if unreadable.

## 7. Verification & docs
- [ ] 7.1 End-to-end checks: label reading, expiry warning, safety confirm, misheard reprompt, room describe (spike on-device with android emulator + phone).
- [ ] 7.2 Update proposal.md + design.md with final picks (on-device, OpenAI Whisper via sherpa-onnx/whisper.cpp, doCAP/EasyOCR, silero VAD, Android).

