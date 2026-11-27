Voice-First Medicine & Accessibility Assistant

1. Users
India has approximately 62M visually impaired people, including 8M blind people (WHO). Many are elderly, use basic phones, and struggle with shaky hands and blurry photos. The assistant must support all Indian languages, regional accents, and code-mixed English.

 2. Voice Flow
1. **Identify medicine:** Open the app; camera and listening start automatically. User asks, "What is this tablet?" Assistant responds briefly, danger first, in the user's language: "Dolo 650, a fever tablet. Expires in three months. Three tablets."
2.  Count: "How many are left in this strip?" → "2."
3. **Surroundings:** "What's around me?" With cloud enabled, describe the room and answer follow-ups like "Where is the door?" Offline, say: "I can't describe surroundings offline."
4. **Interruptions:** Allow interruption anytime. Support medicine identification, food labels, nutritional information, and follow-up questions.

3. When things go wrong

These rules apply to every interaction:

- Language: Support all 22 scheduled Indian languages and English, including accents and mixed speech. Detect language per utterance; switch only when confident, otherwise retain the session language. Saying a language name explicitly changes it. Reply in the spoken language; for mixed speech, prefer the Indian language. Without voice, use the last spoken language.
- **Noise:** Cross-check low-confidence transcripts against camera text. If unresolved, ask "Did I hear X? Say again?" If still unclear, read the label.
- **Mishearing:** After clarification, first repeat: "You said: Dolo 650." If intent remains unknown, re-ask, then read the label, then request a clearer medicine view.
- **Safety:** Expiry and dosage answers must come exclusively from printed labels. Never recommend or infer a dose. After every dosage answer or expired warning, ask "Do you understand the risk?" Unless the user explicitly confirms (Yes, Haan, Howdu, Avunu, Aama), repeat the answer once.
- **Expiry:** Always begin with "Warning: this has expired. Please do not take it." Never provide dosage information for expired medicine or guess dates.
- **Blur:** Never immediately request another photo. Spend five seconds cleaning the image. If name or expiry remains unreadable, state what is readable, then say exactly: "I can't read this. Move the medicine up/down/left/right so I can see the expiry date." Never guess or provide dosage information from unclear text.

4. Architecture
**One interaction pipeline:** VAD → Language ID → STT → Image processing → OCR → Cross-check → Intent router → Rule engine → Response composer → Speech → Session memory.

- **Android client (Kotlin):** Accessibility-first camera interface, torch, continuous listening without a wake word, and mute.
- **Audio:** VAD detects utterance boundaries. Language identification selects the STT model, response templates, and voice.
- **Image processing (OpenCV):** Select five sharpest frames using Laplacian variance, align and average them to reduce noise and glare, then denoise, apply CLAHE, sharpen, and upscale 2×. Generate a binarised copy for embossed text.
- **OCR:** Read every processed image. Accept name, expiry, dosage, or count only when two copies agree. Treat dates as expiry only when printed beside "EXP".
- **Intent routing:** Language-specific keyword rules, without an LLM. Supported intents: identify, safety, dose, general, scene, yes, language, unknown.
- **Rule engine:** Enforces all deterministic safety and failure-handling rules.
- **Response:** Language-specific templates. Medicine purpose comes from a bundled ingredient table; quantities are read from printed labels. Use the best available Android TextToSpeech voice, with Google voices covering 10 Indian languages.
- **Memory:** RAM-only session memory stores the last label and question-answer queue. Repeated questions about the same label replay the previous answer.
- **Optional cloud (LiteLLM):** Disabled by default. When enabled, supports failed local STT, general knowledge, and scene descriptions. Never handles safety or dosage answers.
- Cross-cutting:  Local-first privacy, logging, and uninterrupted camera preview/listening. Speech fades out immediately on interruption.

5. LLD
1. **Image/OCR:** Read medicine names and expiry from blurred, glared, and embossed sample strips.
2. **ASR:** Language identification and transcription in under 3 seconds on a basic phone; test 10+ Indian languages, two accents each, and code-mixed speech.
3. **Voice loop:** Complete the "What is this tablet?" interaction with spoken output.
4. **Failure handling:** One passing test per deterministic rule.
5. **Memory:** Repeated questions reuse queued answers.
6. **Cloud:** Verify optional LiteLLM activation through a toggle.

6. Differentiator:
- Conversational, voice-first accessibility.
- Reads printed information only.
- Never recommends or guesses dosage.
- Transparently admits when information is unreadable.
- Privacy-first, offline-capable design.

 7. On-Device Technology Stack
- **Runtime:** sherpa-onnx for VAD, language identification, and speech recognition (STT).
- **Speech-to-Text (STT):** AI4Bharat IndicConformer (22 Indian languages); fallback to Shruti-ONNX, followed by Meta Omnilingual ASR 300M.
- **Language Identification:** Whisper small; fall back to Whisper base if latency permits.
- **OCR:** PaddleOCR PP-OCRv5 Mobile; fallback to Google ML Kit Text Recognition v2, with DoCAP as an additional option.
- **Voice Activity Detection (VAD):** Silero VAD, integrated through sherpa-onnx.
