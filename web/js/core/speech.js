// What is sent to the voice. The screen always keeps the label text; no digit is ever changed.

// Kannada strengths: the voice cut numbers such as 650 short unless each digit is spoken on its own
// (round-trip check on 2026-11-28: 2 of 8 correct normally, 8 of 8 digit by digit). Years are left alone.
const KANNADA_STRENGTH = /\b([A-Za-z]{3,})\s+(?!(?:19|20)\d\d\b)(\d{3,})(?![\d/])/g;

export function forSpeech(text, lang) {
  const words = String(text)
    .replace(/\b([A-Za-z]{3,})-(?=\d)/g, '$1 ') // "DOLO-650" -> "DOLO 650"
    // A word in capitals is read letter by letter. Short markers such as EXP and MRP stay as they are.
    .replace(/\b[A-Z]{4,}\b/g, (word) => word[0] + word.slice(1).toLowerCase());
  return lang === 'kn' ? words.replace(KANNADA_STRENGTH, (_, name, digits) => `${name} ${[...digits].join(' ')}`) : words;
}
