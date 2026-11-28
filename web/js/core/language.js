// The four MVP languages. Broader coverage is a later version.
export const LANGUAGES = {
  en: { bcp47: 'en-IN', names: ['english', 'अंग्रेज़ी', 'अंग्रेजी', 'इंग्लिश', 'ఇంగ్లీష్', 'ఇంగ్లీషు', 'ಇಂಗ್ಲಿಷ್', 'ಇಂಗ್ಲೀಷ್'] },
  hi: { bcp47: 'hi-IN', names: ['hindi', 'हिंदी', 'हिन्दी', 'హిందీ', 'ಹಿಂದಿ'], script: /\p{Script=Devanagari}/u },
  te: { bcp47: 'te-IN', names: ['telugu', 'telugulo', 'తెలుగు', 'తెలుగులో', 'तेलुगु', 'ತೆಲುಗು'], script: /\p{Script=Telugu}/u },
  kn: { bcp47: 'kn-IN', names: ['kannada', 'kannadadalli', 'ಕನ್ನಡ', 'ಕನ್ನಡದಲ್ಲಿ', 'कन्नड़', 'కన్నడ'], script: /\p{Script=Kannada}/u },
};

export const CONFIDENT = 0.7; // shortcut: the "confident" threshold is open (R10); set it from test recordings.

// Mixed speech prefers the Indian language: any Indian script in the words decides.
export function detectLanguage(text, sttLang, probability) {
  const byScript = Object.keys(LANGUAGES).find((code) => LANGUAGES[code].script?.test(text));
  if (byScript) return { lang: byScript, confident: true };
  const base = String(sttLang ?? '').slice(0, 2);
  if (!LANGUAGES[base]) return { lang: null, confident: false };
  return { lang: base, confident: Number(probability) >= CONFIDENT };
}

export function nextLanguage(current, detected, named) {
  if (named) return named;
  return detected.lang && detected.confident ? detected.lang : current;
}
