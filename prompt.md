So here's the prompt. Users: India has ~62 million visually impaired (8 million blind, WHO); most are elderly. They use a white cane and a basic Android phone, cities and villages alike. Most cannot read medicine labels: holding a strip they can't tell the fever tablet from the blood-pressure tablet, check the expiry date, or count tablets. Waiting for a relative or a shopkeeper's guess is the daily reality — a private health decision shouldn't depend on a stranger. They speak mother tongue with English mixed in — start with Kannada, Telugu, Tamil, Hindi. Blind = voice-first: screens need sight, braille needs training, speaking needs nothing — everyone already does it in the language they think in.

Voice flow, step by step:
1. Open — the camera view starts and the assistant begins listening.
2. The user holds the medicine strip and says: "What is this tablet?" — the camera reads the strip; the assistant replies briefly, danger first, in the user's language: "Dolo 650, a fever tablet. Expires in three months. Three tablets."
3. "Is this safe with diabetes?" — answered from the label: yes or no, plus a short why.
4. "How many do I take?" — the quantity from the label.
5. "And how long does it take to work?" — answered from general knowledge, or "I don't know — check with your doctor."
6. "What's around me?" — the camera describes the room aloud; follow-ups like "Where is the door?"
7. The user interrupts anytime — new questions are answered on their own. The assistant is for every conversation: food labels, other pills, follow-up context.

Deterministic failure rules — always do these, for any agent:
- Accents and languages — answer in the user's language; Hinglish/mixed input understood; decode toward the label's own words when possible.
- Noise — camera cross-check first (printed text is immune to sound); if uncertain: "Did I hear X? Say again?" If still unclear, read the label from the camera.
- Misheard input — read back what it said: "You said: Dolo 650"; after a parse failure: re-ask in the user's language, then read the label from the camera; if still unsolved after two tries, ask the user to re-show the camera.
- Safety answers (expiry, dosage) — from the label only; require explicit spoken confirmation: "Yes, I understand the risk." Accept phrases: Haan, Yes, Howdu, Avunu, Aama — spoken only, no visuals since the user can't see.
- Expiry — warning always first: "Warning: this has expired. Please do not take it." Never guess.
- Unreadable — "I can't read this. Move the medicine up/down/left/right so I can see the expiry date." Never suggest a dose from a guess.

Architecture (PoC): one Android app +
- Client (Kotlin, Accessibility-first): camera view + listening; voice trigger; mute.
- Preprocessor: VAD (silero VAD, on-device) for end-of-utterance; camera cross-check.
- Agent / Intent router: parses "What is this tablet?" / "Is this safe with diabetes?" / "What's around me?"
- Tools: OCR (doCAP / EasyOCR, on-device); Rule engine (deterministic: expiry-first warning, safety from label only, never guess); Local STT: OpenAI Whisper-Large-V3 via sherpa-onnx / IndicWhisper / Shruti-ONNX.
- Response: Composer → Speech output + Barge-in; Session memory: question+answer queue.
- Optional: Cloud fallback via LiteLLM when local decode fails/unsupported — toggle off by default.
- Cross-cutting: Privacy (all local), Observability (logs).

PoC milestones (checks any agent can verify):
1. OCR: strip → text (doCAP; iterate on sample labels).
2. ASR: speech → transcript; measure latency; test on Hindi/Tamil/Kannada/Telugu/English audio.
3. Voice loop: "What is this tablet?" → speaks: "Dolo 650, a fever tablet. Expires in three months. Three tablets." (name, expiry, quantity — danger-first, user's language).
4. Failure rules: garbage → "Did I hear X? Say again?"; expired → warning first; safety → yes/no from label; unreadable → "Move the medicine up/down/left/right"; read back every answer.
5. Memory: re-ask → reuses queued answer.
6. Optional: cloud toggle → routes via LiteLLM.

What makes it different: it converses. It reads only printed text. It never suggests a dose. It admits when it cannot read something.

On-device stack (standard refs): Android client, Kotlin, Accessibility-first; ASR: OpenAI Whisper-Large-V3 on sherpa-onnx (github.com/k2-fsa/sherpa-onnx); Shruti-ONNX (github.com/udgamlabs/Shruti-ONNX, all 22 official languages) + IndicWhisper (ai4bharat.iitm.ac.in/areas/model/ASR/IndicWhisper, Vistaar: github.com/AI4Bharat/vistaar); alternative: whisper.cpp (github.com/ggml-org/whisper.cpp); OCR: doCAP (huggingface.co/DataVoid/DoCAP), EasyOCR (github.com/JaidedAI/EasyOCR); VAD: silero VAD (github.com/k2-fsa/SileroVAD). Dev note: Whisper Flow, OpenAI's streaming model — dev tool, not the product model.
