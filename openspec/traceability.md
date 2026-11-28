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
| Noise | failure-recovery: Noisy speech (see D7) |
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
| Optional LiteLLM cloud and its limits | cloud-assistance: Off by default, Limited cloud use, Never safety or dosage (see D11) |
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
| STT fallback order | platform-and-privacy: Speech-to-text through Sarvam (see D9) |
| OCR choices | platform-and-privacy: On-device OCR (see D3) |
| OpenCV | platform-and-privacy: Web client |

## Departures from the submitted prompt
Decision on 2026-11-27: submit a web app and build Android later (D1-D6). D7-D15 are user decisions on 2026-11-28. `problem-statement.md` is unchanged.

| ID | Prompt says | Specs now say |
|---|---|---|
| D1 | Android client (Kotlin) | Web client in a mobile or desktop browser |
| D2 | Camera and listening start automatically | Same, with one tap anywhere if the browser requires a user action |
| D3 | OCR fallback Google ML Kit, DoCAP as an option | PaddleOCR only. ML Kit is Android-only. DoCAP is unverified in a browser |
| D4 | Torch | Offered where the browser and device support it; otherwise the app says it is unavailable |
| D5 | Android TextToSpeech with Google voices | Best available browser voice |
| D6 | Offline-capable | Offline after the app and models have loaded once |
| D7 | Noise: ask "Did I hear X? Say again?", then read the label | Decided 2026-11-28: ask to repeat or move somewhere quieter, then read the label and confirm the likely request, then ask to repeat the question |
| D8 | Quantities and counts are read from printed labels | Decided 2026-11-28: the camera may also count visible tablets, for the count only, never for dosage |
| D9 | On-device speech-to-text with a fallback order; local-first, offline-capable voice | Decided 2026-11-28: Sarvam realtime transcribes English, Hindi, Telugu and Kannada. Speech audio leaves the device and voice needs a network and key. Docker still starts without keys |
| D10 | Local-first: no image leaves the device | Decided 2026-11-28: if the in-browser YOLOv8n gives no result, a frame goes through the backend to Roboflow's SASTRA blister models. Names and expiry are still read on the device |
| D11 | Optional cloud through LiteLLM | Decided 2026-11-28: the backend calls OpenRouter's REST API directly with free models, for surroundings and general questions only |
| D12 | Android TextToSpeech with Google voices (web: best available browser voice, D5) | Decided 2026-11-28: replies are spoken by Sarvam through the app server, so reply text goes to Sarvam. Fallback is an on-device voice; an online browser voice only with cloud help on |
| D13 | Detect language per utterance; switch only when confident | Decided 2026-11-28: after the user names a language, speech recognition is set to it and automatic switching pauses until another is named |
| D14 | Spend five seconds cleaning the image | Five seconds, or 17 seconds once the name or expiry has been read (user, 2026-11-28) |
| D15 | At most three retries | Three, or five once the name or expiry has been read (user, 2026-11-28) |

On-device voice detection and language identification are unchanged; speech-to-text follows D9. Whether the on-device models run in a browser is unverified until the spike described in the platform-and-privacy design.

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
| R2 | **Strip count.** Settled 2026-11-28. | May the camera count visible tablets? | Yes, for the count only, never for dosage (D8). |
| R3 | **Count intent.** The eight intents have no count intent. | Which intent handles "How many are left?" and how is it kept apart from "How many do I take?" | Add a `count` intent. |
| R4 | **Safety intent.** The new prompt lists it but defines no behaviour (the older "safe with diabetes?" example is gone). | What may it answer? | Read matching printed warnings only; otherwise say it cannot tell and suggest asking a doctor. Never say "safe". |
| R5 | **General knowledge when cloud is off.** | What does the assistant say? | State that it cannot answer that offline. |
| R6 | **Risk confirmation.** Confirm words cover English, Hindi, Kannada, Telugu and Tamil. | What counts in the other languages, and do we ask again after the one repeat? | Add reviewed words per language; ask once, repeat once, then continue listening. |
| R7 | **Voices.** Replies must be in the spoken language, but browsers and devices may have no voice for many of them. Some browser voices also send text to a cloud service. | What happens in a language with no voice? | Say so in a fallback language the user knows; never switch silently. Use only on-device voices while cloud is off. |
| R8 | **Model coverage.** I believe Whisper language ID and some of the speech models do not cover all of the 22 languages and English. Not yet checked. | Which model serves each language? | Check each model's language list and publish a coverage table. |
| R9 | **Expiry format.** Labels often print only month and year. | When is `EXP 03/2027` expired? How is "Expires in three months" rounded? | Expired after the last day of that month; round months down. |
| R10 | **Thresholds.** Transcript doubt settled 2026-11-28 by fixed checks (failure-recovery decision 4); language confidence still has no value. | What threshold for "confident" language detection? | Set it from test recordings and record it in the design. |
| R11 | **Missing expiry in identification.** The unreadable rule requires an exact sentence in English. | Is it translated, like the other fixed lines? | Use reviewed translations; English wording is exact in English. |
| R12 | **Delivery scope.** 23 languages, the full on-device stack and the LLD tests are large for a hackathon. | Which requirements must work in the submission? | Keep the full spec, then split a first change with one working path and all safety rules. |

## Added by user decision
Decision on 2026-11-28, not in the problem statement.

| Decision | Requirement |
|---|---|
| Flag a medicine that expires within 7 days or within one month; no notice beyond that | expiry-soon-warning: Time left before expiry, Expiry-soon notice |
| One exact movement direction; at most 3 retries, then suggest someone checks the label | failure-recovery: Unreadable label response, Retry limit for an unreadable label |
| Two strips: name both and ask to see both expiry dates | medicine-label-reading: Two strips in view |
| Never recommend a medicine; refer to a doctor or pharmacist | safety-rules: No medicine recommendation |
| A stated purpose comes with "confirm before taking" (adds to the prompt's example reply) | medicine-label-reading: Purpose from bundled table |
| Asked about taking more: no advice; count only if accepted (R2 still open) | safety-rules: Asked about taking more |
| Asked about taking more: always ask the user to consult a doctor | safety-rules: Asked about taking more |
| Count not reliable: ask to see the entire strip, at most 3 times, then ask someone to count | failure-recovery: Whole strip for a count |
| Expired medicine already taken: warning first, consult a doctor right away, no dosage | safety-rules: Expired medicine already taken |
| Unwell after taking a medicine (rare; the app is meant to be used before taking one): get help, then contact a doctor | safety-rules: Feeling unwell after taking a medicine |
| Serious symptoms: ask anyone nearby to help, call 108, open the dialer; comes before the expired warning (departs from "always begin with" the warning) | safety-rules: Serious symptoms, Expired warning |
| Check the camera first (hold still, wipe the lens, point at the medicine), then guide the strip | failure-recovery: Camera check first |
| The landing page never reads the label; an understood request that needs it moves to a label-reading screen | label-reading-screen: No label reading on the landing screen, Label reading screen |
| Feeling unwell: help instruction first, without waiting for the label; any expired warning follows (replaces the warning-first order for this case) | safety-rules: Feeling unwell after taking a medicine, Expired warning |
| Reduce the wait after a question | faster-label-reading: Fastest working text reader |
| Screens, tokens, navigation and voice commands from the VoAI design export (docs/design/voai/) | ui-screens: all requirements |
| Flip and photo screens are steps within the 3 attempts (export said no limit) | ui-screens: Retry screens within 3 attempts; failure-recovery: Retry limit for an unreadable label |
| Cut-off expiry: say so and ask someone to check, no retries (replaces the prompt's blur steps for this case) | failure-recovery: Cut strip |

Reading prescriptions is out of scope for now and may be developed later.
