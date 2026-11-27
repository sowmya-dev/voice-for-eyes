# Traceability: problem statement to specs

Each row maps a statement in [`problem-statement.md`](../problem-statement.md) to a requirement, written as `capability: Requirement name`. Each capability is its own change in `openspec/changes/<capability>/`. Each requirement has one task in that change. The specs are the source of truth. If they differ from the prompt, fix the spec or record the decision here.

## 1. Users
| Prompt statement | Spec |
|---|---|
| 62M visually impaired, elderly, basic phones | each `proposal.md` (Why); platform-and-privacy: Web client, Speech recognition speed |
| Shaky hands, blurry photos | label-image-processing: Multi-frame cleanup |
| All Indian languages, accents, code-mixed English | language-support: Supported languages |

## 2. Voice flow
| Prompt statement | Spec |
|---|---|
| Camera and listening start automatically | voice-interaction: Automatic start |
| Brief, danger-first identification | medicine-label-reading: Identify medicine |
| Count question | medicine-label-reading: Printed information only |
| Room description and follow-ups | surroundings-description: Describe surroundings |
| Offline surroundings line | surroundings-description: Offline surroundings response |
| Interrupt anytime | voice-interaction: Interruption |
| Medicine, food labels, nutrition, follow-ups | medicine-label-reading: Food labels and follow-ups |

## 3. When things go wrong
| Prompt statement | Spec |
|---|---|
| Rules apply to every interaction | safety-rules: Rules apply to every interaction |
| 22 languages and English, accents, mixed | language-support: Supported languages |
| Detect per utterance, switch when confident | language-support: Language detection and switching |
| Saying a language name changes it | language-support: Explicit language change |
| Reply language and no-voice case | language-support: Reply language |
| Noise | failure-recovery: Noisy speech |
| "You said" after clarification | failure-recovery: Repeat after clarification |
| Unknown intent steps | failure-recovery: Unknown intent ladder |
| Expiry and dosage only from labels | safety-rules: Label-only expiry and dosage |
| Never recommend or infer a dose | safety-rules: No dose advice |
| Risk question, confirm words, repeat once | safety-rules: Risk confirmation |
| Expired warning first | safety-rules: Expired warning |
| No dosage for expired medicine, no guessed dates | safety-rules: No dosage for expired medicine, Expiry dates need the EXP marker |
| Five seconds of cleaning first | failure-recovery: Clean before asking again |
| Exact unreadable sentence | failure-recovery: Unreadable label response |
| No guess or dosage from unclear text | failure-recovery: Nothing from unclear text |

## 4. Architecture
| Prompt statement | Spec |
|---|---|
| One pipeline | voice-interaction: Single interaction pipeline |
| Kotlin, accessibility, torch | platform-and-privacy: Web client (see D1); voice-interaction: Accessible camera interface |
| Continuous listening, no wake word, mute, VAD | voice-interaction: Continuous listening and mute |
| Language ID selects STT, templates, voice | language-support: Language drives processing |
| Five sharpest frames, align, average | label-image-processing: Multi-frame cleanup |
| Denoise, CLAHE, sharpen, 2x | label-image-processing: Image enhancement |
| Binarised copy | label-image-processing: Embossed text copy |
| OCR every copy, two must agree | label-image-processing: Two-copy agreement |
| Expiry only beside "EXP" | safety-rules: Expiry dates need the EXP marker |
| Keyword intents, no LLM | voice-interaction: Rule-based intent routing |
| Rule engine | safety-rules: Rules apply to every interaction |
| Templates and TTS voice | medicine-label-reading: Spoken templates and voice |
| Purpose from ingredient table | medicine-label-reading: Purpose from bundled table |
| Printed quantities | medicine-label-reading: Printed information only |
| Google voices cover 10 Indian languages | medicine-label-reading `design.md`, D5, R7 |
| RAM-only memory and replay | session-memory: RAM-only session memory, Replay repeated questions |
| Optional LiteLLM cloud and its limits | cloud-assistance: Off by default, Limited cloud use, Never safety or dosage |
| Local-first privacy and logging | platform-and-privacy: Local-first and offline-capable, Logging |
| Preview and listening uninterrupted | voice-interaction: Uninterrupted capture |
| Fade speech on interruption | voice-interaction: Interruption |

## 5. LLD checks
| Prompt statement | Spec |
|---|---|
| Blurred, glared, embossed strips | label-image-processing: Difficult labels |
| ASR under 3 seconds; language and accent tests | platform-and-privacy: Speech recognition speed, Speech test coverage |
| Voice loop | medicine-label-reading: Identify medicine |
| One test per deterministic rule | The tasks in the `safety-rules` and `failure-recovery` changes |
| Memory reuse | session-memory: Replay repeated questions |
| Cloud toggle | cloud-assistance: Off by default |

## 6. Differentiators
| Prompt statement | Spec |
|---|---|
| Conversational, voice-first | voice-interaction: Automatic start, Interruption |
| Printed information only | medicine-label-reading: Printed information only |
| Never recommends or guesses dosage | safety-rules: No dose advice |
| Admits unreadable | medicine-label-reading: Admit what is unreadable |
| Privacy-first, offline-capable | platform-and-privacy: Local-first and offline-capable |

## 7. On-device stack
| Prompt statement | Spec |
|---|---|
| sherpa-onnx, Silero VAD, Whisper language ID | platform-and-privacy: On-device speech stack |
| STT fallback order | platform-and-privacy: Speech-to-text fallback order |
| OCR choices | platform-and-privacy: On-device OCR (see D3) |
| OpenCV | platform-and-privacy: Web client |

## Departures from the submitted prompt
Decision on 2026-11-27: submit a web app and build Android later. `problem-statement.md` is unchanged.

| ID | Prompt says | Specs now say |
|---|---|---|
| D1 | Android client (Kotlin) | Web client in a mobile or desktop browser |
| D2 | Camera and listening start automatically | Same, with one tap anywhere if the browser requires a user action |
| D3 | OCR fallback Google ML Kit, DoCAP as an option | PaddleOCR only. ML Kit is Android-only. DoCAP is unverified in a browser |
| D4 | Torch | Offered where the browser and device support it; otherwise the app says it is unavailable |
| D5 | Android TextToSpeech with Google voices | Best available browser voice |
| D6 | Offline-capable | Offline after the app and models have loaded once |

The speech models and their order are unchanged in the specs. Whether they run in a browser is unverified until the spike described in the platform-and-privacy design.

These requirements come from the hackathon run rules and the web decision, not the prompt:
- platform-and-privacy: Runs with Docker and no keys
- platform-and-privacy: Secure connection for capture
- cloud-assistance: Missing cloud key

## Wording I added
The prompt does not say these. Accept or reject each in review.
- A disabled or unavailable cloud service gets the same surroundings reply as being offline.
- An unsupported torch is announced as unavailable.
- A medicine whose ingredient is not in the table gets no stated purpose.
- A value without two-copy agreement is not spoken. A count that cannot be accepted is not stated.
- Logs stay on the device and are not uploaded.

## Review items
The prompt is silent, ambiguous or in conflict with itself. The specs do not settle these. R1 (platform) is settled: web first, see D1-D6.

The designs of the affected changes list these under "Open decisions".

| ID | Item | Question to settle | My recommendation |
|---|---|---|---|
| R2 | **Strip count.** The example answers "2" for tablets left, but counts must be read from printed labels. A cut strip does not print how many are left. | May the camera count visible tablets? | If yes, add an explicit exception for counting visible tablets only, never for dosage. If no, the assistant says it cannot read the count. |
| R3 | **Count intent.** The eight intents have no count intent. | Which intent handles "How many are left?" and how is it kept apart from "How many do I take?" | Add a `count` intent. |
| R4 | **Safety intent.** The new prompt lists it but defines no behaviour (the older "safe with diabetes?" example is gone). | What may it answer? | Read matching printed warnings only; otherwise say it cannot tell and suggest asking a doctor. Never say "safe". |
| R5 | **General knowledge when cloud is off.** | What does the assistant say? | State that it cannot answer that offline. |
| R6 | **Risk confirmation.** Confirm words cover English, Hindi, Kannada, Telugu and Tamil. | What counts in the other languages, and do we ask again after the one repeat? | Add reviewed words per language; ask once, repeat once, then continue listening. |
| R7 | **Voices.** Replies must be in the spoken language, but browsers and devices may have no voice for many of them. Some browser voices also send text to a cloud service. | What happens in a language with no voice? | Say so in a fallback language the user knows; never switch silently. Use only on-device voices while cloud is off. |
| R8 | **Model coverage.** I believe Whisper language ID and some of the speech models do not cover all of the 22 languages and English. Not yet checked. | Which model serves each language? | Check each model's language list and publish a coverage table. |
| R9 | **Expiry format.** Labels often print only month and year. | When is `EXP 03/2027` expired? How is "Expires in three months" rounded? | Expired after the last day of that month; round months down. |
| R10 | **Thresholds.** "Confident" language detection and "low-confidence" transcript have no values. | What thresholds? | Set them from test recordings and record them in the design. |
| R11 | **Missing expiry in identification.** The unreadable rule requires an exact sentence in English. | Is it translated, like the other fixed lines? | Use reviewed translations; English wording is exact in English. |
| R12 | **Delivery scope.** 23 languages, the full on-device stack and the LLD tests are large for a hackathon. | Which requirements must work in the submission? | Keep the full spec, then split a first change with one working path and all safety rules. |
