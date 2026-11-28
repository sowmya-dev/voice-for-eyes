# Design: label-reading-screen

## Context
`web/js/app.js` starts a read on Sarvam's first partial transcript, which can arrive empty, before any words. `web/js/core/assistant.js` then reads the label without changing screens, so the landing screen stays up with a "Reading the label…" notice and the camera moved off-screen. The VoAI design export has no screen for reading; its closest parts are the two-pane camera layout with a chip, and screen 5c, which shows the camera first on phones. See [`proposal.md`](proposal.md) for the motivation.

## Design decisions
The user approved this plan on 2026-11-28.

### 1. One new screen, built from the export's parts
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** A new screen shows the live camera with a "Reading the label…" chip. Beside it are what you asked, the same heading, and a line telling you to hold the strip still with the label facing the camera. Back and Start over stay at the bottom.
- **Pseudo-technical:** `View.screen = 'reading'; layout = panes; chip = strings.reading; assistant = [asked, h1, hint, frame note]; phone panel = 'camera'`

### 2. Move after understanding, before reading
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** The app waits for the whole question, works out what it means, and only then moves. Questions that need no label never visit this screen. If you are already on a screen that shows the camera (noisy speech, retry, photo), it stays. An emergency instruction is never replaced.
- **Pseudo-technical:** `before a label read: if screen not in {2, 5, 5b, 5c}: show('reading', asked). emergency reads without moving`

### 3. No early read
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** We remove the shortcut that started reading while you were still talking. It read on the landing page, and often while the strip was still being moved. The cost is speed: in the reproduction it had started about 7 seconds before the question was understood, so answers will arrive later by about as long as the question takes, possibly a few seconds more.
- **Pseudo-technical:** `delete startEarlyRead and its hand-over; every read starts inside the turn that needs it`

### 4. The reading screen is a passing step
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** "Back" never returns to it. "Later" pauses it, and "continue" reads again and answers the same question. "Settings" and "next" are refused until the answer is done.
- **Pseudo-technical:** `history never stores 'reading'; state.reading = { intent, ctx } while on it; later -> paused = { ask: state.reading }; continue -> answer(ask); taskOpen includes 'reading'`

### 5. Quiet landing page
- **Status:** Agreed (user, 2026-11-28)
- **Plain English:** The label reader still loads in the background, but the landing page no longer says so. If you ask before it is ready, the reading screen says it is getting ready. A loading failure is shown anywhere.
- **Pseudo-technical:** `notice 'loading' only when screen == 'reading'; notice 'reading' never on 'reading' (the screen says it) or '1'`

## High-level architecture flow
```text
landing -> question -> transcript -> understood
   needs no label ----------------------------> answer screen
   needs the label -> label-reading screen -> read -> safety rules -> 3 / 4 / 5
   words unclear   -> label-reading screen -> read -> answer, or 2 Noisy speech check
```

## Low-level component design
| Component | Responsibility | Interaction |
|---|---|---|
| assistant (`look`) | moves to the reading screen before a read that needs it | used by medicine, count, safety, food-label and cross-check paths |
| ScreenRenderer | draws the reading screen | reads View and `strings.json` |
| app | reads only when the assistant asks; shows the camera view on phones | no read starts from a partial transcript |

## Data contracts
`View` is defined in `web/js/core/contract.js`.

```text
View.screen: ... | 'reading'      (asked = what the user said, spoken = '')
strings: reading, readingHint     (en, hi, te, kn; not reviewed by native speakers)
```

## Tool schemas
None.

## Agent flow
transcript -> intent -> if it needs the label: show the reading screen -> capture -> safety rules -> result screen and speech.

## Open decisions
- Should the app also say "Reading the label" aloud? Recommendation: no, keep the short tone, because speaking would add a few seconds.
- The "feel unwell" delay found while planning is fixed in `safety-rules` decision 6.

## Risks
- Answers arrive later without the early read. Mitigation: measure after building; revisit only with the user.
- Noise heard while reading can cancel the read and start the noisy-speech steps. This happens today on the landing page too.
