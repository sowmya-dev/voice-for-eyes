// Speakers feed the microphone. Words that are mostly what the app is saying are its own echo.
import { clean } from './intent.js';

export function isEcho(heard, speaking) {
  const words = clean(heard).split(' ').filter(Boolean);
  const own = new Set(clean(speaking).split(' ').filter(Boolean));
  if (!words.length || !own.size) return false;
  return words.filter((w) => own.has(w)).length / words.length >= 0.7;
}
