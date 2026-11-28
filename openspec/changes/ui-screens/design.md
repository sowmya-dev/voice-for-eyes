# Design: ui-screens

## Context
The VoAI design export, supplied by the user on 2026-11-28, is in [`docs/design/voai/`](../../../docs/design/voai/): [`voai-spec.md`](../../../docs/design/voai/voai-spec.md) (layout, tokens, components, screens, navigation, accessibility, React port), `tokens.css`, `strings.json` and one `*.dc.html` file per screen in `project/`. Those files are the visual source of truth. This change owns the screens and screen routing only; medicine answers, safety rules, recovery steps and language choice come from the other changes. `web/index.html` today is a black and yellow start page with a camera button, and is replaced. See [`proposal.md`](proposal.md) for the motivation.

## Design decisions
All decisions are **Proposed** until reviewed, except where marked.

### 1. The export is the visual source
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Screens copy the export's layout, tokens and wording. The design-canvas wrappers are dropped.
- **Pseudo-technical:** `strip <x-dc>, <helmet>, support.js; replace hex values with var(--token); keep the CSS-only responsive rules`

### 2. Plain HTML, no framework for now
- **Status:** Proposed
- **Plain English:** The export is plain markup, so the screens stay plain HTML, CSS and JavaScript served by nginx. The export's React mapping is kept for later.
- **Pseudo-technical:** `web/index.html + web/screens/*.html templates or one page that swaps <main> per screen; components per voai-spec.md section 12 as plain functions`

### 3. One screen state machine
- **Status:** Proposed
- **Plain English:** The voice layer sends events; one place picks the screen. Buttons send the same events.
- **Pseudo-technical:** `screen = route(UiState, UiEvent); buttons dispatch UiEvent like voice; screen changes never change medicine answers`

### 4. Screens follow the agreed specs
- **Status:** Proposed
- **Plain English:** Where a screen's text or flow differs from an agreed spec, the agreed spec wins until the difference is settled.
- **Pseudo-technical:** `screen text = template from the owning change; export text used only as layout example`

### 5. Answer first on phones
- **Status:** Agreed (from the export)
- **Plain English:** On a phone the spoken answer comes first and the camera is a second view.
- **Pseudo-technical:** `view = width > 972 ? 'both' : ('answer' | 'camera'); "show camera" / "back to answer" switch it`

## High-level architecture flow
```text
mic -> Sarvam -> transcript -> intent router ──┐
camera -> image pipeline -> LabelReading ──────┼─> rule engine -> ResponsePlan ─┬─> speech
                                               │                               └─> UiEvent
                   voice commands (back, later, ...) ──────────────> UiEvent ──> ScreenRouter -> screen
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| ScreenRouter | picks the screen from UiState and UiEvent | receives events from the pipeline and buttons |
| ScreenRenderer | renders the chosen screen with tokens and strings | reads ResponsePlan and SessionLanguage |
| VoiceCommands | matches global commands per language | sends UiEvent; uses LanguageRegistry |
| Strings | loads `strings.json` | keyed by session language |
| Header, CameraPane, AnswerCard, RiskCard, VoiceNav, Toggle, AttemptDots, Countdown | components from the export | used by ScreenRenderer |

## Data contracts
Proposed. `ResponsePlan` is defined in `medicine-label-reading`, `SessionLanguage` in `language-support`.

```text
ScreenId = '1'|'1b'|'2'|'3'|'4'|'5'|'5b'|'5c'|'5d'|'6'
UiState  = { screen: ScreenId, view: 'both'|'answer'|'camera', lang: BCP47, taskOpen: bool,
             pausedFrom: ScreenId|null, history: ScreenId[], attempt: 0..3 }
UiEvent  = { kind: 'answer', plan: ResponsePlan } | { kind: 'unclear_speech' } | { kind: 'unreadable' }
         | { kind: 'command', name: 'back'|'start_over'|'later'|'continue'|'open_settings'|'next'
                                    |'show_camera'|'back_to_answer'|'language', lang?: BCP47 }
Settings = { speechRate: number, cloudHelp: false, alwaysListening: true, torchAtStart: false }   (defaults)
```

## Tool schemas
```text
ui.route(UiState, UiEvent) -> UiState
ui.render(UiState, ResponsePlan|null) -> void
ui.strings(lang) -> Record<string, string>
```

## Agent flow
pipeline result or voice command -> UiEvent -> route -> render the screen and speak the plan at the same time -> wait for the next event.

### 6. Three attempts, flip and photo included
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** Moving, flipping and taking a photo all count towards the same 3 attempts. After the third, the app says it cannot confirm the label and asks the user to have someone check it.
- **Pseudo-technical:** `attempt in 1..3; 5 -> 5b -> 5c each add 1; attempt > 3 -> final message; AttemptDots(total = 3)`

## Open decisions
Differences between the export and the agreed specs. Until settled, the agreed spec wins.
- **Move guidance.** Screen 5 shows four arrows and says "up, down, left or right". The agreed specs say: check the camera first, then one exact direction at a time, VizLens style.
- **Languages.** The export includes Tamil screens; the agreed languages are English, Hindi, Telugu and Kannada.
- **Name.** The export calls the app "VoAI"; the project and README say "Voice for Eyes".
- **Expiry in the answer.** Screen 3 says "Expires in three months", as in the prompt. The expiry-soon spec gives a notice only within one month; whether identification still states a later expiry is open there.
- **Fonts.** The export loads fonts from Google Fonts. Offline label reading and privacy need the fonts bundled with the app. Recommendation: self-host them.
- **Silence.** The routing page sends "silence after a request" to 5d. Recommendation: treat only "later" or "I'll come back" as pause, so silence does not move screens.
- **Missing screens.** The export has no screens for: expiry-soon notice, two strips, cut strip, counting and whole strip, camera check, feeling unwell, serious symptoms and the 108 dialer, voice input unavailable, and missing keys. Recommendation: reuse screen 3, 4 or 5 layouts with the owning change's text.
- **Translations.** The Hindi, Telugu, Kannada and Tamil strings have not been checked by native speakers.

## Risks
- Showing both panes and speaking at once may overload some users. Mitigation: test with blind and low-vision users.
- The export's sample text could be shipped by mistake as real answers. Mitigation: every answer string comes from the owning change's templates.
