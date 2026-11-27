**Users**
- India has ~62M blind/visually impaired (8M blind, WHO); many elderly; white cane + basic Android phone, cities and villages.
- Can't read labels: holding a strip, they can't tell the fever tablet from the blood-pressure tablet, check expiry, or count tablets; waiting on relatives/shopkeepers is the daily norm — a private health decision shouldn't depend on a stranger ("always having to ask erodes confidence and leaves people feeling like a burden").
- Speaks mother tongue with English mixed in — start with Kannada, Telugu, Tamil, Hindi.
- Blind = voice-first: speaking needs nothing (screens need sight, braille needs training).

**Voice flow (step by step)**
1. Open — camera view + listening.
2. Hold strip + say "What is this tablet?" — camera reads; assistant: "Dolo 650, a fever tablet. Expires in three months. Three tablets." (danger-first, user's language)
3. "Is this safe with diabetes?" — yes/no from label, plus a short why.
4. "How many do I take?" — from label.
5. "And how long does it take to work?" — general knowledge, or "I don't know — check with your doctor."
6. "What's around me?" — camera describes the room aloud; follow-ups like "Where is the door?"
7. User interrupts — new questions answered on their own. Assistant is for every conversation: food labels, other pills, follow-up context.

**Deterministic failure rules — always do these, for any agent**
- Accents/languages — answer in user's language; Hinglish/mixed understood; decode toward the label's own words when possible.
- Noise — camera cross-check first; if uncertain: "Did I hear X? Say again?" — if still unclear, read the label from the camera.
- Misheard input — read back: "You said: Dolo 650"; parse failure → re-ask, then read label from camera; still unsolved after two tries → ask user to re-show the camera.
- Safety answers (expiry, dosage) — from label only; require spoken confirmation: "Yes, I understand the risk." Accept phrases: Haan, Yes, Howdu, Avunu, Aama (spoken-only, no visuals).
- Expiry — warning always first: "Warning: this has expired. Please do not take it." Never guess.
- Unreadable — "I can't read this. Move the medicine up/down/left/right so I can see the expiry date." Never suggest a dose from a guess.

**Architecture (PoC): one Android app**
- Client (Kotlin, Accessibility-first): camera + listening, voice trigger, mute.
- Preprocessor: VAD (silero VAD, on-device) for end-of-utterance; camera cross-check.
- Agent/Intent router: parses "What is this tablet?" / "Is this safe with diabetes?" / "What's around me?"
- Tool registry: OCR (doCAP/EasyOCR, on-device); Rule engine (expiry-first warning, safety from label only, never guess); Local STT: OpenAI Whisper-Large-V3 via sherpa-onnx/IndicWhisper/Shruti-ONNX.
- Response: Composer → Speech output + Barge-in; Session memory: question+answer queue.
- Optional: LiteLLM cloud fallback when local fails/unsupported — toggle off by default.

**PoC milestones (checks any agent can verify)**
1. OCR: strip → text (doCAP; iterate until stable on sample labels).
2. ASR: speech → Whisper-Large-V3 transcript; measure latency; test Hindi/Tamil/Kannada/Telugu/English audio.
3. Voice loop: open → "What is this tablet?" → speaks "Dolo 650, a fever tablet. Expires in three months. Three tablets."
4. Failure rules: garbage → "Did I hear X? Say again?"; expired → warning first; safety → yes/no; unreadable → "Move the medicine..."; read back every answer.
5. Memory: re-ask → reuses queued answer.
6. Optional: cloud toggle → routes via LiteLLM.

**What makes it different**
- It converses. Reads only printed text. Never suggests a dose. Admits when unreadable.

**On-device stack (standard refs)**
- ASR: OpenAI Whisper-Large-V3 on sherpa-onnx — github.com/k2-fsa/sherpa-onnx.
- Language coverage: Shruti-ONNX — github.com/udgamlabs/Shruti-ONNX (22 official); IndicWhisper — ai4bharat.iitm.ac.in/areas/model/ASR/IndicWhisper, Vistaar: github.com/AI4Bharat/vistaar.
- Alternative: whisper.cpp — github.com/ggml-org/whisper.cpp.
- OCR: doCAP — huggingface.co/DataVoid/DoCAP, EasyOCR — github.com/JaidedAI/EasyOCR.
- VAD: silero VAD — github.com/k2-fsa/SileroVAD. Dev note: Whisper Flow, OpenAI's streaming model — dev tool, not the product model.
