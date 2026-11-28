# Design: language-support

## Context
Supplies the language of each utterance and of the session to the other changes. No language handling exists in the code yet. See [`proposal.md`](proposal.md) for the motivation.

**As built (2026-11-28):** English, Hindi, Telugu and Kannada only. Sarvam auto-detects the language of each utterance; an Indian script in the words decides the reply language. "Confident" is a probability of 0.7 (R10 still open). Keyword lists and templates are not reviewed by native speakers.

## Design decisions
All decisions are **Proposed**. None is agreed until we brainstorm this change.

### 1. Session language is separate from detected language
- **Status:** Proposed
- **Plain English:** A single doubtful detection cannot flip the conversation to another language.
- **Pseudo-technical:** `if namedLanguage then current = named; else if detected.confident then current = detected.lang; else keep current`

### 2. Mixed speech prefers the Indian language
- **Status:** Proposed
- **Plain English:** If Hindi and English are mixed, the reply is in Hindi.
- **Pseudo-technical:** `reply = first non-English lang in detected.langs, else detected.langs[0]; applied only when confident`

### 3. One registry per language
- **Status:** Proposed
- **Plain English:** Everything a language needs is listed in one table, so gaps are visible.
- **Pseudo-technical:** `registry[lang] = { sttModel[], templates, voice, intentKeywords, confirmWords, names[] }`

### 4. Pin recognition when a language is named
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Left to detect by itself, Sarvam wrote two spoken Telugu questions in English letters and called them English. Once the user names a language, we tell Sarvam that language. Automatic switching pauses until the user names another one. Reloading the page goes back to auto-detect.
- **Pseudo-technical:** `on named(lang): session = lang; pinned = true; stt reconnects with language_code=<lang>-IN; while pinned, ignore detection`

### 9. Base language from the words, on the server
- **Status:** Agreed (user, 2026-11-28: "if a base language is detected, switch the interface")
- **Plain English:** Tested on 2026-11-28: with automatic language, Sarvam's live speech recognition writes Telugu, Hindi and Kannada speech in English letters and labels it English, with no confidence ("Ee maatra enti?", en-IN). Sarvam's text language identification named all 10 test sentences correctly, including mixed ones, and its transliteration turns them back into Telugu, Hindi or Kannada script, which the request rules understand. Both calls take about 0.6-0.8 s, so they run only while recognition is automatic: once a language is found, recognition is set to it and later questions come back in their own script with no extra calls.
- **Pseudo-technical:** `stream language_code=auto: on transcript.final -> lang, script = text.identify_language(text) (timeout 2 s); if lang in {hi-IN, te-IN, kn-IN} and script == Latn: text = text.transliterate(text, en-IN -> lang); forward {..., text, base_language: lang}. Browser: detectLanguage prefers base_language; on a switch to a non-English language while recognition is automatic: setSpeechLanguage(lang)`

## High-level architecture flow
```text
audio -> LID -> LanguageDetection -> LanguagePolicy <- "language named" intent
                                          |
                                   SessionLanguage -> STT model, keywords, templates, voice
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| LanguageIdentifier | wraps the language ID model | returns LanguageDetection |
| LanguagePolicy | pure function applying the switching rules | updates SessionLanguage |
| LanguageRegistry | static data per language | read by STT, router, composer and speech |

## Data contracts
Proposed. A type used by several changes is defined once, in the change that owns it.

```text
LanguageDetection = { langs: BCP47[], scores: number[], confident: bool }
SessionLanguage   = { current: BCP47, lastSpoken: BCP47 }
LanguageEntry     = { lang: BCP47, names: string[], sttModels: string[], voice: string|null, templatesReady: bool }
```

## Tool schemas
```text
lid.identify(audio) -> LanguageDetection
language.apply(SessionLanguage, LanguageDetection, namedLang|null) -> SessionLanguage
```

## Agent flow
transcript -> if it names a language: set it, pin it, reopen speech recognition with it -> else, unless pinned, apply the detection policy -> reply in SessionLanguage.

## Open decisions
- R8: model coverage of all 23 languages is unchecked. Recommendation: publish a coverage table.
- R10: the "confident" threshold has no value. Recommendation: set it from test recordings.

- Each utterance in automatic mode waits for one or two Sarvam text calls (about 0.6-1.5 s) until a language is found; English speakers keep paying about 0.6 s per question.
- After a switch, recognition is fixed to that language; changing to another Indian language needs the language named.

## Risks
- A language may be unsupported by one of the models. Mitigation: coverage table, and bring gaps to spec review.
