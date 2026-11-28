// Fixed keyword rules, no language model. The spec's eight intent names, with an `aspect` for detail.
// The Hindi, Telugu, Kannada and romanised words have not been reviewed by native speakers.
import { LANGUAGES } from './language.js';
import { INGREDIENTS } from './ingredients.js';

export const clean = (text) => String(text ?? '')
  .toLowerCase()
  .replace(/[‌‍'’]/g, '')
  .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
  .trim();

const rx = (...parts) => new RegExp(parts.join('|'), 'u');

const EMERGENCY = rx('can ?not breathe', 'cant breathe', 'trouble breathing', 'breathing (problem|difficulty|trouble)',
  'difficulty (in )?breathing', 'going to faint', 'feel(ing)? faint', 'fainting', 'fainted', 'passing out', 'unconscious', 'chest pain',
  'saans (nahi|lene)', 'behosh', 'सांस (नहीं|लेने)', 'साँस (नहीं|लेने)', 'बेहोश', 'ఊపిరి (ఆడ|తీసుకోలే)', 'స్పృహ', 'ఊపిరి ఆడటం లేదు', 'ಉಸಿರಾ(ಡ|ಟ)', 'ಪ್ರಜ್ಞೆ ತಪ್ಪ', 'ಮೂರ್ಛೆ', 'మూర్ఛ');
const UNWELL = rx('dizzy', 'dizziness', 'vomit', 'nausea', '\\brash\\b', 'itching', 'feel(ing)? (sick|unwell|bad|weird|ill)', 'stomach (pain|ache)', 'headache after',
  'chakkar', '\\bulti\\b', 'tabiyat', 'चक्कर', 'उल्टी', 'तबीयत', 'తల తిరుగు', 'కళ్లు తిరుగు', 'వాంతి', 'ತಲೆ ಸುತ್ತು', 'ವಾಂತಿ');
const TOOK = rx('\\b(i )?(just )?(took|have taken|ive taken|had taken)\\b', 'le li', 'kha li', 'ले ली', 'खा ली', 'ले लिया', 'వేసుకున్నా', 'తీసుకున్నా', 'ತಗೊಂಡೆ', 'ತೆಗೆದುಕೊಂಡೆ');
const MORE = rx('another', 'one more', 'ek aur', 'एक और', 'दोबारा', 'ఇంకో', 'మరొక', 'మరో', 'ಇನ್ನೊಂದು', 'ಮತ್ತೊಂದು');
const CAN_I = rx('\\bcan i\\b', 'sakti', 'sakta', 'सकती', 'सकता', 'వచ్చా', 'ಬಹುದಾ');
const WHICH_TAKE = rx('(which|what) (medicine|tablet|pill|one)s? (should|can|do) i (take|have)', 'recommend', 'suggest (a|some|me)',
  '(kaunsi|konsi|kaun si) (dawa|goli|medicine|tablet) (loon|lu|leni|khaun|khani)', 'कौन सी (दवा|गोली) (लूँ|लूं|लेनी|खाऊं|खानी)', 'ఏ (మందు|మాత్ర) (వేసుకోవాలి|తీసుకోవాలి|వాడాలి)', 'ಯಾವ (ಮಾತ್ರೆ|ಔಷಧಿ) (ತಗೊಳ್ಳ|ತೆಗೆದುಕೊಳ್ಳ)');
const DOSE = rx('\\bdos(e|age)\\b', 'how (many|much)( \\w+)? (should|do|can|must) i (take|have)', 'how often', 'when (should|do) i take',
  'kitni( goli| goliyan| tablets?)? (leni|khani|loon|lu)', 'kab (leni|khani)', 'कितनी( गोली| गोलियां| गोलियाँ)? (लेनी|खानी|लूँ|लूं)', 'कब (लेनी|खानी)', 'खुराक', 'डोज', 'ఎన్ని( మాత్ర(లు)?)? (వేసుకోవాలి|తీసుకోవాలి)', 'మోతాదు', 'డోస్', 'ಎಷ್ಟು( ಮಾತ್ರೆ(ಗಳು|ಗಳನ್ನು)?)? (ತಗೊಳ್ಳ|ತೆಗೆದುಕೊಳ್ಳ)', 'ಡೋಸ್');
const COUNT = rx('how many .*(left|remaining|there|in (this|the))', 'how many (tablets|pills|capsules)', '\\bcount\\b',
  'kitni( goli| goliyan| tablets?)? (bachi|baki|bacha|hain)', 'कितन(ी|े)( \\S+)? (बची|बाकी|बचीं|बचे|हैं)', 'ఎన్ని( \\S+)? (మిగిలా|ఉన్నా)', 'ಎಷ್ಟು( \\S+)? (ಉಳಿದಿ|ಇವೆ)');
const WARNINGS = rx('\\bsafe\\b', 'side effects?', '\\bwarnings?\\b', 'pregnan', 'diabet', 'सुरक्षित', 'సురక్షిత', 'ಸುರಕ್ಷಿತ');
const NUTRITION = rx('nutrition', 'calorie', 'protein', '\\bsugar\\b', 'carbohydrate', '\\bfat\\b', 'sodium', '\\benergy\\b', 'पोषण', 'प्रोटीन', 'पोषक', 'పోషక', 'ప్రోటీన్', 'ಪೌಷ್ಟಿಕ', 'ಪ್ರೋಟೀನ್');
const EXPIRY = rx('expir', '\\bexp\\b', 'best before', 'एक्सपायर', 'एक्स्पायर', 'समाप्ति', 'खराब', 'kab tak', 'గడువు', 'ఎక్స్పైర', 'ఎక్స్పైరీ', 'ಅವಧಿ', 'ಎಕ್ಸ್ಪೈರ');
const COMPOSITION_Q = rx('composition', 'what (is|does) (it|this)( tablet| medicine)? (made (of|from)|contain)', 'what does it contain', "what'?s in (it|this)",
  'ingredients?', 'chemical( name)?', 'generic( name)?', '\\bsalt\\b', 'contents', 'इसमें क्या (है|हैं)', 'रासायनिक', 'साल्ट', 'संरचना',
  'ఏముంది', 'ఏమి ఉంది', 'రసాయన', 'ಏನಿದೆ', 'ರಾಸಾಯನಿಕ');
const DESCRIBE = rx('describe (it|this|the (tablet|medicine|strip|pill|capsule))', 'tell me (more |everything )?about (it|this|the (tablet|medicine|strip|pill|capsule))',
  'more about (it|this)', '(more|full) details', 'बारे में बता', 'గురించి చెప్ప', 'ಬಗ್ಗೆ ಹೇಳ');
const READ_ALL = rx('read (the |this |it |out )?(label|strip|packet|medicine|everything|all)', 'read (it )?(out|aloud)',
  'what (else )?(is written|is printed|does it say|does the (label|strip|packet) say)', 'what else (is|does)',
  'क्या लिखा', 'లేబుల్ చదువు', 'ఏం రాసి', 'ಏನು ಬರೆದಿ', 'ಲೇಬಲ್ ಓದಿ');
const SCENE = rx('around me', 'surrounding', 'describe (the |this )?(room|scene|place)', 'in front of me', 'where is (the |my |a )?', 'wheres (the |my |a )?',
  'aas ?paas', 'mere saamne', 'आसपास', 'आस पास', 'मेरे सामने', '(दरवाज़ा|दरवाजा) (कहाँ|कहां)', 'చుట్టూ', 'తలుపు ఎక్కడ', 'ಸುತ್ತ(ಮುತ್ತ)? ', 'ಬಾಗಿಲು ಎಲ್ಲಿ');
const IDENTIFY = rx('what(s| is| are)? (this|that|these)\\b', 'what (tablet|medicine|pill|capsule|food|strip)', 'what am i holding', 'which (tablet|medicine|pill|one is this)', 'identify', 
  '\\b(yeh|ye) (kya|kaunsi|konsi|kaun)', '(kaunsi|konsi|kaun si) (tablet|goli|dawa|medicine)', '(यह|ये) .*(क्या|कौन)', '(यह|ये) (क्या|कौन)', 'कौन सी (गोली|दवा|टैबलेट)', 'लेबल पढ',
  '(ఇది|ఈ) (.* )?(ఏ|ఏమిటి|ఎంటి|ఏంటి)', 'ఏ (మాత్ర|మందు|టాబ్లెట్)', '\\bidi (emi|enti|ey|ye)\\b', '(ಇದು|ಈ) (.* )?(ಯಾವ|ಏನು)', 'ಯಾವ (ಮಾತ್ರೆ|ಔಷಧಿ)', '\\bidu (yaava|yava|enu)\\b');
const GENERAL = /^(tell me about|who is|who was|what time|what day|what is the (capital|weather|time|date)|hows the weather|how is the weather)/;
const MEDICAL = rx('tablet', 'medicine', 'medication', '\\bpill', 'capsule', 'dos(e|age)', 'drug', '\\bmg\\b', 'dolo', 'syrup', 'injection', 'antibiotic', 'goli', 'dawa', 'दवा', 'गोली', 'మందు', 'మాత్ర', 'ಔಷಧ', 'ಮಾತ್ರೆ', ...Object.keys(INGREDIENTS));

const make = (name, aspect = null) => ({ name, aspect });

export function route(text) {
  const t = clean(text);
  if (!t) return make('unknown');
  if (EMERGENCY.test(t)) return make('safety', 'emergency');
  if (UNWELL.test(t)) return make('safety', 'unwell');
  if (MORE.test(t) && (TOOK.test(t) || CAN_I.test(t))) return make('safety', 'took_more');
  if (TOOK.test(t)) return make('safety', 'took');
  if (WHICH_TAKE.test(t)) return make('safety', 'which_take');
  if (DOSE.test(t)) return make('dose');
  if (COUNT.test(t)) return make('identify', 'count');
  if (WARNINGS.test(t)) return make('safety', 'warnings');
  if (NUTRITION.test(t)) return make('identify', 'nutrition');
  if (EXPIRY.test(t)) return make('identify', 'expiry');
  if (COMPOSITION_Q.test(t)) return make('identify', 'composition');
  if (DESCRIBE.test(t)) return make('identify', 'describe');
  if (READ_ALL.test(t)) return make('identify', 'text');
  if (SCENE.test(t)) return make('scene');
  if (IDENTIFY.test(t)) return make('identify', 'all');
  if (GENERAL.test(t) && !MEDICAL.test(t)) return make('general');
  if (namedLanguage(t)) return make('language');
  if (isConfirm(t)) return make('yes');
  return make('unknown');
}

// A language name counts only in a short sentence or with a word like "speak".
export function namedLanguage(text) {
  const t = ` ${clean(text)} `;
  const words = t.trim().split(' ');
  const found = Object.keys(LANGUAGES).find((code) => LANGUAGES[code].names.some((n) => t.includes(` ${clean(n)} `)))
    // Auto-detection may add an ending to a name said on its own, such as "Kannadaka".
    ?? (words.length === 1 ? Object.keys(LANGUAGES).find((code) => words[0].startsWith(LANGUAGES[code].names[0]) && words[0].length <= LANGUAGES[code].names[0].length + 4) : undefined);
  if (!found) return null;
  const short = t.trim().split(' ').length <= 2;
  return short || /speak|talk|language|switch|bolo|matlad|maatlad|matanad|maatanaad|maatad|बोल|మాట్లాడ|ಮಾತ|भाषा/u.test(t) ? found : null;
}

const YES = ['yes', 'yeah', 'haan', 'han', 'howdu', 'haudu', 'avunu', 'aama', 'हाँ', 'हां', 'ಹೌದು', 'అవును', 'ஆம்'].map(clean);
const NO = ['no', 'not', 'nope', 'nahi', 'nahin', 'illa', 'ledu', 'kaadu', 'नहीं', 'ನಹೀ', 'ಇಲ್ಲ', 'కాదు', 'లేదు'].map(clean);

// Only a short, clear confirmation counts.
export function isConfirm(text) {
  const words = clean(text).split(' ');
  return words.length <= 3 && words.some((w) => YES.includes(w)) && !words.some((w) => NO.includes(w));
}

export const isNo = (text) => clean(text).split(' ').some((w) => NO.includes(w));

const COMMANDS = {
  back: ['back', 'go back', 'पीछे', 'वापस', 'peeche', 'piche', 'వెనుకకు', 'ಹಿಂದೆ'],
  start_over: ['start over', 'restart', 'start again', 'फिर से शुरू करें', 'फिर से शुरू', 'మళ్ళీ మొదలు', 'ಮತ್ತೆ ಆರಂಭಿಸಿ'],
  later: ['later', 'ill come back', 'i will come back', 'come back later', 'baad mein', 'बाद में', 'తర్వాత', 'ಆಮೇಲೆ'],
  continue: ['continue', 'resume', 'जारी रखें', 'जारी रखो', 'కొనసాగించు', 'ಮುಂದುವರಿಸಿ'],
  open_settings: ['open settings', 'settings', 'सेटिंग्स', 'सेटिंग्स खोलो', 'సెట్టింగ్‌లు', 'ಸೆಟ್ಟಿಂಗ್ಸ್'],
  next: ['next', 'आगे', 'తదుపరి', 'ಮುಂದೆ'],
  show_camera: ['show camera', 'कैमरा दिखाओ', 'కెమెరా చూపించు', 'ಕ್ಯಾಮೆರಾ ತೋರಿಸಿ'],
  back_to_answer: ['back to answer', 'जवाब पर वापस', 'సమాధానానికి వెనుకకు', 'ಉತ್ತರಕ್ಕೆ ಹಿಂದೆ'],
  take_photo: ['take photo', 'take a photo', 'take picture', 'take a picture', 'फोटो लो', 'ఫోటో తీయి', 'ಫೋಟೋ ತೆಗೆಯಿರಿ'],
};

// A command must be the whole utterance.
export function parseCommand(text) {
  const t = clean(text);
  return Object.keys(COMMANDS).find((name) => COMMANDS[name].some((phrase) => clean(phrase) === t)) ?? null;
}

// A looser guess, used only to ask "Do you want to know ...?".
export function likelyAspect(text) {
  const t = clean(text);
  if (/exp|date|तारीख|గడువు|ಅವಧಿ/u.test(t)) return 'expiry';
  if (/how many|kitni|\bleft\b|कितनी|ఎన్ని|ಎಷ್ಟು/u.test(t)) return 'count';
  if (/\bdos|\btake\b|लेनी/u.test(t)) return 'dose';
  if (/what|which|\bkya\b|क्या|ఏమి|ಏನು|tablet|medicine/u.test(t)) return 'all';
  return null;
}
