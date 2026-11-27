# VoiceForEyes MVP — skeleton

Basic product: camera view + listen → (stub) transcribe → camera OCR readout → voice answer.

Build as an Android project (Android Studio). Files:
- `mvp/AndroidManifest.xml` — camera + mic permissions
- `mvp/build.gradle` — minSdk 26, CameraX
- `mvp/MainActivity.kt` — camera preview + listen button; camera readout route
- `mvp/VoiceLoop.kt` — deterministic voice loop + stubs (`NativeBridge.transcribe`, `NativeBridge.readLabel`)

Pending (not in this skeleton):
- whisper.cpp forked in + JNI transcribe (openai/whisper, ggml), whisper-tiny-hindi-ggml/Shruti-ONNX/IndicWhisper as language add-ons.
- doCAP integration for label OCR.
- on-device verification on a device.
