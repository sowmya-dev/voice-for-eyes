# Design: medicine-label-reading

## Context
Turns a trusted LabelReading and an Intent into a spoken answer. Depends on label-image-processing, safety-rules and language-support. See [`proposal.md`](proposal.md) for the motivation.

**As built (2026-11-28):** Intent names stay the eight in the spec; count, expiry and nutrition are an `aspect` of identify. A printed pack quantity is spoken as printed, never as the number left. With no strip model, a count question says it cannot count. Replies were first spoken only by the browser, which was silent for Telugu and Kannada on this laptop; decision 4 replaces that. Food labels read nutrition rows only; identifying a food pack without an "EXP" date goes to the unreadable steps. Two strips are not handled.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Templates, never free text
- **Status:** Proposed
- **Plain English:** Every sentence comes from a prepared template filled with accepted values.
- **Pseudo-technical:** `plan = [segment(templateId, slots)]; a segment is dropped or replaced by "cannot read" when a slot is null`

### 2. Fixed danger-first order
- **Status:** Proposed
- **Plain English:** Warnings come first, then name, purpose, expiry and quantity.
- **Pseudo-technical:** `order = [warning?, name, purpose?, expiry, quantity?]; the rule engine may prepend or remove segments`

### 3. Purpose is a table lookup
- **Status:** Proposed
- **Plain English:** The app states what a medicine is for only if its ingredient is in the bundled table.
- **Pseudo-technical:** `purpose = table[normalise(ingredient)] or null`

### 4. Sarvam voice for replies
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** The Windows laptop has no Telugu or Kannada voice, so replies are spoken by Sarvam through our server. This sends the reply text, including medicine names and any printed dosage, to Sarvam. If Sarvam cannot be used, only a voice already on the device is used. An online browser voice is used only while cloud help is on. If nothing can speak, a warning sound plays and the screen says so.
- **Pseudo-technical:** `say(text, lang): if server voice available: wav = POST /api/tts {text, lang, pace}; play through Web Audio (stop = 150 ms fade) ; else or on failure: voice = browser voices for lang where localService or cloudHelp; if voice: utterance.voice = voice; speak; else tone + notice, result 'unspoken'.  speak() is never called without an explicit voice.`

### 5. How replies are made to sound natural
- **Status:** Proposed (the user asked on 2026-11-28 for smoother voices)
- **Plain English:** The voice read capital names letter by letter ("D O L O six five zero") in all four languages. Names are now said as words, and Sarvam's text clean-up is on. We kept the `bulbul:v3` voice. The newer `bulbul:v4-flash` conversational voices sound like a good fit, but in a round-trip check they gave a wrong or incomplete strength ("Dolo 615" in English; "650" cut short in Kannada), so they are not used. In Kannada the `v3` voice also failed on most strengths unless the digits are read one at a time (2 of 8 correct normally, 8 of 8 digit by digit).
- **Pseudo-technical:** `speech = forSpeech(text, lang): capital words of 4+ letters -> Capitalised; "Name-650" -> "Name 650"; kn: digits after a Latin name spaced (not years). Server: model=bulbul:v3, speaker=shubh, enable_preprocessing=true. Prepared in advance: the 108 sentence and the risk question; the rest of a reply is fetched while they play.`

### 6. Talk like a person, from fixed templates
- **Status:** Agreed (user, 2026-11-28: "let it talk to user like a human rather than a robot")
- **Plain English:** Answers are full sentences, the app says when it is still reading instead of going quiet, and it offers the next useful thing (the expiry, then the count) as a question. It never invents text: every sentence is a template, and the safety sentences are unchanged.
- **Pseudo-technical:** `id.purpose = "This is {name}, {purpose}."; on first extra read with partlyRead(label): say look.still(name); after deliver(plain answer): told += aspects said (identify -> all + expiry); next = first of [all, expiry, count] not told and available; state.offer = {aspect: next}; say confirm.<next>`

### 7. Everything printed is kept, largest letters first
- **Status:** Agreed (user, 2026-11-28: "The text contents will take precedence by their font size ... have everything collected, read, understood, managed in state")
- **Plain English:** A strip's biggest letters matter most: the brand, then strength and ingredient, then smaller print. Every line two copies agree on is kept with its letter size, grouped as largest, larger, large or small, and remembered with the rest of the label. Asked what is written, the app reads it biggest first, a few lines at a time. Dosage lines stay out of that reading so the dosage rules still apply.
- **Pseudo-technical:** `texts = agreed lines -> {text, size: size ?? box.h, tier: size/max >= .8 largest, >= .55 larger, >= .35 large, else small}, sorted by size desc; mergeReading unions texts by normalised text (keep the larger size); intent identify/text -> read texts.filter(not dosage).slice(start, start + 8); more -> offer {aspect: text, start + 8}`

## High-level architecture flow
```text
Intent + LabelReading -> AnswerBuilder -> draft ResponsePlan -> rule engine -> TemplateRenderer -> Speaker
                                   ^
                             ingredient table
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| AnswerBuilder | chooses segments for the intent | reads LabelReading and IngredientTable |
| IngredientTable | bundled static data | returns a purpose key or null |
| TemplateRenderer | fills per-language templates | uses SessionLanguage |
| Speaker (`web/js/io/tts.js`) | Sarvam audio through Web Audio, browser voice as fallback | stopped by the interruption handler |
| `/api/tts` (FastAPI) | calls Sarvam `text_to_speech.convert` with the server key | used by Speaker |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
IngredientEntry = { ingredient: string, purposeKey: string }
Segment         = { templateId: string, slots: Record<string,string> }
ResponsePlan    = { intent: Intent.name, labelId: string|null, lang: BCP47, segments: Segment[], containsDosage: bool }
Template        = { templateId: string, lang: BCP47, text: string }
TtsRequest      = { text: string (1..2500), lang: 'en'|'hi'|'te'|'kn', pace: 0.5..2.0 }
TtsResponse     = { audio: base64 WAV } | { error: 'key_not_set'|'rate_limited'|'unavailable' }
```

## Tool schemas
```text
ingredients.lookup(ingredient) -> purposeKey|null
compose.build(Intent, LabelReading) -> ResponsePlan
compose.render(ResponsePlan) -> string
speech.say(string, lang) -> 'end' | 'cancelled' | 'unspoken'
POST /api/tts TtsRequest -> TtsResponse     (server: model bulbul:v3, speaker shubh, enable_preprocessing, language_code <lang>-IN)
```

## Agent flow
intent -> build draft plan -> safety rules return the allowed plan -> render in the session language -> speak.

## Open decisions
- R2 settled by the user on 2026-11-28: the camera may count visible tablets, for the count only, never for dosage.
- How to count them. PaddleOCR reads text and cannot count tablets, and medicine questions do not go to the cloud. Proposed: count on the device with OpenCV, and accept a number only when two processed copies agree. A printed pack quantity is not the number left. Needs tests with full, part-used, glared and cut strips.
- R4: behaviour of the safety intent. Recommendation: read matching printed warnings only and never say "safe".
- R7 (settled 2026-11-28): decision 4. Open: whether a spoken English notice should accompany the warning sound when no voice exists.
- R9: month-only expiry dates and rounding of "in three months".

## Risks
- A device may lack a voice for the language. Mitigation: detect it and tell the user.
- Food and nutrition layouts differ widely. Mitigation: state only what is readable.
