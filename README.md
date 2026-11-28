# Voice for Eyes (VoAI)

A voice-first medicine label reader for blind and low-vision people. Ask "What is this tablet?", show the strip, and hear a short, danger-first answer. Expiry and dosage come only from the printed label, checked by fixed rules, never by a language model.

## Run

    docker compose up --build

Open http://localhost:3000 and allow the camera and microphone. No keys or `.env` file are needed to start. The first build takes several minutes: it downloads the OCR models and Python packages.

The camera and microphone work only on `localhost` or HTTPS. To try it on a phone, serve it over HTTPS (for example through a tunnel).

## Keys (all optional)

Copy `.env.example` to `.env` and fill in what you have, then run `docker compose up -d`. Keys stay in the backend container and never reach the browser. Never commit `.env`.

| Key | What it turns on | Without it |
|---|---|---|
| `SARVAM_API_KEY` | Voice input and spoken replies in English, Hindi, Telugu, Kannada | Tap the microphone button to read a label; replies use a voice installed on the device |
| `OPENROUTER_API_KEY` | Cloud help (also switch it on in Settings): surroundings and general questions | "I can't describe surroundings offline." |
| `ROBOFLOW_PRIVATE_API_KEY` and `ROBOFLOW_MODEL_ID` | Tablet counting. `ROBOFLOW_MODEL_ID` may list several models, comma-separated, tried in order. Each needs classes for the strip, full pockets and empty pockets: named `medicine_strip`, `full_cavity`, `empty_cavity`, or renamed with `ROBOFLOW_CLASS_MAP` (e.g. `strip=medicine_strip,pill=full_cavity,missing=empty_cavity`). A model with no full-pocket class never gives a count | The app says it cannot count the tablets |

**What goes to Sarvam:** while the microphone is on, audio streams all the time, and the text of every spoken reply (including a medicine name and any printed dosage) is sent to be turned into speech. Both use credits. **Mute mic** stops the audio stream. The server listens on all network interfaces on port 3000 and has no sign-in, so run it only on a network you trust.

## What to say

"What is this tablet?" · "When does it expire?" · "What is the dosage?" · "How many are left?" · "Is this safe for me?" · "What's around me?" · "back" · "start over" · "later" / "continue" · "take photo" · "open settings" · a language name such as "speak in Telugu".

**Telugu and Kannada:** start by saying "Speak in Telugu" (or "Telugu"). Speech recognition then stays in that language until you name another; until you name one, spoken Telugu may be written in English letters and answered in English. Reloading the page goes back to auto-detect.

## How it works

```text
mic -> /ws/stt (FastAPI) -> Sarvam saaras:v4 -> transcript -> fixed intent rules
camera -> 5 sharpest frames -> OpenCV cleanup (3 copies) -> PaddleOCR -> two copies must agree
                                -> safety rules -> screen + /api/tts (Sarvam voice)
                                                   fallback: a voice on the device; otherwise a warning sound
```

Camera frames are processed in the browser. A frame leaves the device only for cloud help (surroundings, when you turn it on) or the strip-counting fallback (only when a model is configured). After one visit, label reading also works offline.

- `web/js/core/`: conversation, safety, expiry, label and template logic (plain functions, fully tested)
- `web/js/core/contract.js`: the data contract between the assistant and the screens
- `web/js/io/`, `web/js/ui/`: camera, speech, OCR and screens (design in `docs/design/voai/`)
- `backend/app/main.py`: speech relay, cloud help, strip fallback
- `openspec/`: specs, designs, tasks; `LEDGER.md`: build status and how to continue

## Tests

    cd web && npm ci && npm test
    cd backend && pip install -r requirements-dev.txt && python -m pytest -q
    node openspec/check-rules.js && openspec validate --all --strict

## Known limits

- **Not a medical device.** Tested only on computer-drawn labels in desktop Chrome: no real strips, no real phone, no blind users.
- Reading a label takes about 10 to 20 seconds in headless Chrome on a laptop, and each spoken reply then waits 1 to 4 seconds for its audio. The 108 sentence and the risk question are fetched in advance.
- Offline, or without a Sarvam key, a language with no voice on the device (Telugu or Kannada on a typical Windows laptop) is shown on screen with a warning sound, not spoken.
- Tablet strengths in the Sarvam voice were checked only by machine transcription, not by native listeners. One Telugu "500" out of about 28 Telugu checks came back garbled. The screen always shows the label text.
- Tablet counting needs a trained strip model, which does not exist yet.
- Not built: cut-strip detection, two strips at once, on-device speech detection and language identification, languages beyond four.
- Hindi, Telugu and Kannada wording is not reviewed by native speakers. The ingredient table needs a pharmacist's review.
- The phone dialer for 108 has not been tried on a real phone, and a web page cannot place a call by itself.
