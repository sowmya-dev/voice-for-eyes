// The contract between the assistant and the screens. The screens render only what is in a View,
// so every value on a card comes from the conversation or from the image analysis.

/**
 * @typedef {object} View
 * @property {'1'|'1b'|'reading'|'2'|'3'|'4'|'5'|'5b'|'5c'|'5d'|'6'} screen
 * @property {'en'|'hi'|'te'|'kn'} lang        screen text and voice language
 * @property {string|null} asked               what the user said
 * @property {string} spoken                   exactly what is spoken for this screen
 * @property {'ok'|'warn'|'blur'|'emergency'} tone
 * @property {Tiles|null} tiles                facts read from the label, or null for non-medicine answers
 * @property {boolean} risk                    the risk question is waiting for an answer
 * @property {0|1|2|3} step                    noisy-speech step reached (screen 2)
 * @property {string|null} readable            what could be read while the label is unclear
 * @property {'left'|'right'|'up'|'down'|null} direction  the one move direction (screen 5)
 * @property {string|null} cue                 camera or strip cue id
 * @property {number} attempt                  retry attempt (screens 5, 5b, 5c)
 * @property {3|5} attempts                    attempts allowed: 5 once the name or expiry is read
 * @property {number|null} countdown           photo countdown (screen 5c)
 * @property {boolean} final                   no more attempts
 * @property {string|null} dial                emergency number to offer
 */
/**
 * @typedef {object} Tiles
 * @property {string|null} name           accepted medicine name
 * @property {string|null} expiry         relative expiry, for example "In 3 months"
 * @property {string|null} expiryPrinted  the printed expiry, for example "February 2027"
 * @property {string|null} count          tablets seen, only when counted reliably
 */

export const SCREENS = ['1', '1b', 'reading', '2', '3', '4', '5', '5b', '5c', '5d', '6'];

export const blankView = (lang = 'en') => ({
  screen: '1', lang, asked: null, spoken: '', tone: 'ok', tiles: null, risk: false, step: 0,
  readable: null, direction: null, cue: null, attempt: 0, attempts: 3, countdown: null, final: false, dial: null,
});

const TILE_KEYS = ['count', 'expiry', 'expiryPrinted', 'name'];

// Returns the list of problems with a view. Empty means it meets the contract.
export function checkView(view) {
  const problems = [];
  const expected = Object.keys(blankView()).sort().join();
  if (Object.keys(view).sort().join() !== expected) problems.push(`keys: ${Object.keys(view).sort().join()}`);
  if (!SCREENS.includes(view.screen)) problems.push('screen');
  if (!['en', 'hi', 'te', 'kn'].includes(view.lang)) problems.push('lang');
  if (!['ok', 'warn', 'blur', 'emergency'].includes(view.tone)) problems.push('tone');
  if (view.tiles && Object.keys(view.tiles).sort().join() !== TILE_KEYS.join()) problems.push('tiles');
  if (view.direction && !['left', 'right', 'up', 'down'].includes(view.direction)) problems.push('direction');
  if (![3, 5].includes(view.attempts)) problems.push('attempts');
  if (view.attempt < 0 || view.attempt > view.attempts) problems.push('attempt');
  if (typeof view.spoken !== 'string') problems.push('spoken');
  return problems;
}
