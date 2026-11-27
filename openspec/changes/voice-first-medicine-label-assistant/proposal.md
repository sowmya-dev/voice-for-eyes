# Proposal: Voice-First Medicine Label Assistant for the Visually Impaired

## Why
India has an estimated 62 million visually impaired people (WHO), most of whom cannot read their own medicine label. Holding a strip, blind users cannot tell the fever tablet from the blood-pressure tablet, cannot check the expiry date, or know how many are left. Braille is not yet mandatory on medicines in India. Voice must be the interface: screens need sight, braille needs training, and speaking needs nothing — everyone already does it, in the language they think in.

## What Changes
A free conversational voice assistant for the four most spoken Indian languages (Kannada, Telugu, Tamil, Hindi). It opens straight into camera and listening. It reads and describes medicine labels aloud, answers danger-first with fixed rules for expiry and quantity (never guessed), and describes the room. It is built on a live multimodal model for camera and speech, with OpenAI Whisper as the speech-recognition model.

## Voice Flow
1. Open: the assistant opens straight into camera view and listens. The user says "What is this tablet?".
2. Label question: the camera reads the strip/box; the assistant speaks briefly, danger first, in the user's language: "Dolo 650, a fever tablet. Expires in three months. Three tablets."
3. Follow-up: "Is this safe with diabetes?" — answered from the label: yes or no.
4. "How many do I take?" — quantity from the label.
5. "And how long does it take to work?" — answered from general knowledge, or "I don't know — check with your doctor."
6. "What's around me?" — the assistant describes the room aloud; follow-ups like "Where is the door?"
7. The user can interrupt at any time and keep talking: any new question is answered on its own.

## When Things Go Wrong
- **Misheard input**: after every answer the assistant reads back what it heard ("You said: Dolo 650"). For anything safety-critical (expiry, dosage) it requires an explicit spoken confirmation before proceeding. On a parse failure it re-asks once, then reads the label from the camera.
- **Noise**: OpenAI Whisper returns a confidence score per utterance; garbage input triggers a "Did I hear X? Say again?" re-prompt. As a noise-proof fallback the assistant reads the printed label from the camera, because text on a strip is immune to acoustic noise.
- **Accents**: OpenAI Whisper is fine-tuned on Indian-accented speech for the four target languages, so regional accents decode well from the start.
- **Mixed languages (Hinglish)**: Whisper is multilingual — OpenAI Whisper auto-detects the language per segment and decodes each segment in its own language, with context biasing from the OCR'd label text and common Hinglish phrases as a lexicon.
- **Expired medicine**: the warning always comes first — "Warning: this has expired. Please do not take it."

## Capabilities
- New capability `voice-first-medicine-label-assistant`: voice-first conversational assistant; medicine and label reading with danger-first expiry warnings; room description via the camera.

## Impact
New product. Dependencies: OpenAI Whisper (speech), a multimodal camera model (label OCR), text-to-speech. No integrations required; everything runs on the phone.

