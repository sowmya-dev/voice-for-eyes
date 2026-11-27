# Design

## Context
See proposal.md for why: blind users of India need a voice-first assistant that reads medicine labels and describes the room.

## Goals / Non-Goals
**Goals:**
- Open straight into camera + listening; label questions answered by voice, danger-first (expiry, quantity), in the user's language (Kannada, Telugu, Tamil, Hindi).
- Everything on-device: OpenAI Whisper ASR + camera OCR — no cloud, no latency, no per-call cost.

**Non-Goals:**
- Text/braille readers, phone apps other than this assistant.
- Integrations with existing portals; the product is read-only and standalone.
- Hallucinating answers about doses or quantities; anything not read from the label is not stated.

## Decisions
- **OpenAI Whisper = speech input only.** OpenAI Whisper (on-device) decodes the utterance into text (token-level confidence available). All label reading is done by the camera model (OCR); OpenAI Whisper's output is not trusted to read. OpenAI Whisper supplies words + confidence + (via Whisper-style language detection) per-segment language ID.
- **Safety rules are hardcoded** (never guessed): expiry => warning first; quantity/dose => from the label only, plus explicit spoken confirmation before dosage is stated.
- **Multilingual: per-segment language decode.** OpenAI Whisper auto-detects language per segment; each segment is decoded in its own language; the OCR'd label text and a common Hinglish phrase list bias decoding toward real words.
- **Noise: camera readout as the noise-proof fallback.** Printed text is immune to acoustic noise: when OpenAI Whisper confidence is low or output is unparseable, the assistant reads the label from the camera.
- **Accent: context-seed decoding + Indian-accent fine-tune path (open Q).** OpenAI Whisper decodes with the OCR label text as context prompt; plus fine-tune OpenAI Whisper on Indian-accented data for the 4 core languages (dataset decision deferred).

## Final picks (AC2/AC3, on-device + optional cloud fallback)
- **ASR:** OpenAI Whisper on-device — primary: **sherpa-onnx** (k2-fsa, ONNX runtime) + **IndicWhisper** (AI4Bharat, ONNX) / **Shruti-ONNX** (udgamlabs — all 22 official languages); alternative: **whisper.cpp** (ggml ports of OpenAI Whisper + whisper-tiny-hindi-ggml, fine-tune per Issue #2022). All on-device; spike order: (a) sherpa-onnx + Shruti-ONNX → (b) IndicWhisper → (c) whisper.cpp comparison.
- **Vision/OCR:** **doCAP** (DataVoid, ONNX, mobile-first label OCR) + EasyOCR/PaddleOCR for handwritten labels; room description via a small on-device multimodal model.
- **VAD:** silero VAD, on-device (end-of-utterance + interrupt detection).
- **Platform:** Android (Kotlin), Accessibility-first.
- **Optional cloud fallback (coverage-focused — final):** host LiteLLM (model router) on a backend (diagram's Edge gateway + Auth + gRPC + message queue + response gen). Route client: Whisper on-device decodes first; route to cloud when: (a) utterance language not supported by local ASR (Scheduled Castes — Whisper Flow + IndicWhisper + Shruti-ONNX coverage), (b) decode is low-confidence/ambiguous (accent/noise), or (c) non-safety out-of-label question ("How long does it take?" — cloud LLM answers). Safety answers (expiry, dosage): never cloud — camera + read-back only. Cloud model: **Whisper-Large-V3** (Whisper-1 as fallback alternative). Audio via gRPC + Opus compression. User toggle: **cloud coverage off by default** — user "opens the gate to cloud" (privacy consent required when enabling).
- **AC2 picks:** read-back on every answer (context + memory); safety confirmations are spoken only — accept phrases: Haan / Yes / Howdu / Avunu / Aama (no visual cues — blind users); camera cross-check → read-back re-ask → re-decode; gaps >30 min = new question; < 2–3 min = correction; never display what the camera doesn't show; memory queue of questions+answers, reusable for repeat informational questions.
- **AC3 picks:** on-device for audio (OpenAI Whisper), vision, VAD; hand-guidance = voice ("move the strip up/down/left/right", "turn it over").

## Limitations (OpenAI Whisper with Indian languages and accents)
- **English-heavy training data**: Whisper-class ASR is trained on WebVTT-like captions dominated by English; Indian languages get lower quality than English (higher WER, especially smaller languages).
- **Accents & Indian English**: no Indian-accent-specific fine-tuning in most public Whisper releases; bilingual/Hindi-English and rural accents degrade decoding accuracy. Whisper also struggles with **number and phoneme ambiguity** in Indian languages (similar-sounding words; e.g. expiry dates misread) and with **transliterated/Hinglish words** not in its vocabulary.
- **Hallucinations**: OpenAI Whisper can emit text not in the audio (filler/noise, fast Indian speech) — so decoded text must be validated against the camera-read label; never trust OpenAI Whisper alone for safety answers.
- **One language tag per segment**: Whisper decodes the whole segment as one language — mixed Hinglish segments get the wrong tag; therefore per-segment decode + language context biasing is required.
- **No speaker or multi-person separation**: Whisper is tuned to a single clear speaker; blind users sometimes speak with varied cadence and two people can share a room, so single-speaker behavior is assumed, not guaranteed.
- **No vocabulary adaptation**: local product names, lesser-known brands and medicine names are often out-of-vocabulary for Whisper; mitigate with context biasing and camera-verified reading.
- **OpenAI Whisper context window is short**: short utterances ("open", "what is this", "how many left?") — fine, but long Hinglish compounds break.
- **On-device trade-offs (AC3, all on-device by decision):** whisper.cpp/ggml/IndicWhisper/Shruti-ONNX/doCAP run on the phone; wins: offline + privacy + no latency; loses: coverage (some Scheduled Castes uncovered — resolved by camera + spoken confirmation), lower accuracy than big cloud models, needs Android hardware.

## Risks / Trade-offs
[Risk] OpenAI Whisper misses or garbles Hindi/regional speech → Mitigation: camera readout fallback + explicit confirmation of critical answers.
[Risk] Hallucinated or misheard "safety" answers (expiry, dosage) → Mitigation: hard rules for expiry, spoken confirmation for dosage, read-back on every answer, camera-only display.
[Risk] OpenAI Whisper numbers/phonemes on Indian languages → Mitigation: read-back + camera verify of name/expiry/quantity.
[Risk] Speech in non-Whisper-covered languages (some Scheduled Castes) → Mitigation: camera OCR + fuzzy match + spoken "Is this the medicine you have?" confirmation.
[Risk] Device constraints (old Android, ~1GB RAM) → Mitigation: tiny models (whisper-tiny, ggml; doCAP).

## Cloud fallback — brainstorm (coverage)
1. **Which cloud models via LiteLLM?** STT: OpenAI Whisper-1 / Whisper-Large-V3 (Audio API); Gemini (audio+multilingual); Groq Whisper — LiteLLM routes to any; spike them on Hindi/Kannada/Telugu/Tamil accent audio. Answers: Gemini Flash, Claude — for "How long does it take?" etc.
2. **Route trigger (when is cloud used?):** (a) local decode fails/unsupported language (no Scheduled Castes local models — Whisper Flow on-device + IndicWhisper/Shruti-ONNX coverage), (b) low confidence or accent-heavy input, (c) out-of-label general questions. (d) Never for safety answers (expiry/dosage — camera + read-back always).
3. **Response gen:** cloud LLM answers non-safety questions; also for "Is this safe with diabetes?" — cloud gets the label + decoded question — safe (medicine facts), camera-verified. But let's keep safety facts on-device + camera (never cloud guessing).
4. **Opus encoder:** adopt — audio stream compressed to Opus before cloud gRPC; on-device too (harmless, enables streaming to cloud).
5. **User toggle:** **cloud off by default** — user opens the gate when coverage is needed ("Cloud coverage: on/off"); requires privacy consent when enabling.

## Open Questions
- (Closed by spike — tasks 5.4: sherpa-onnx + Shruti-ONNX vs whisper.cpp comparison.)
- DoCAP vs other OCR for labels — spike.
- IndicWhisper vs Shruti-ONNX coverage/quality on our 4 languages — spike.

