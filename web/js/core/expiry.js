// Expiry parsing and date windows. Dates are { year, month, day|null }.
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Only "EXP" marks an expiry, and the date must follow it directly. "EXPIRY DATE" and "USE BEFORE" are an open decision.
const MARKER = /(?<![A-Z])EXP(?:\s*\.)?(?:\s*(?:DATE|DT))?[\s.:\-]*/g;
const DMY = /^(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4}|\d{2})(?!\d)/;
const MY = /^(\d{1,2})\s*[/.\-]\s*(\d{4}|\d{2})(?!\d|\s*[/.\-]\s*\d)/;
const NAMED = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s.\-/']*(\d{4}|\d{2})(?!\d)/;

const lastDay = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function valid(year, month, day) {
  const y = year < 100 ? 2000 + year : year;
  if (month < 1 || month > 12) return null;
  if (day !== null && (day < 1 || day > lastDay(y, month))) return null;
  return { year: y, month, day };
}

export function parseExpiry(text) {
  const upper = String(text).toUpperCase();
  for (const marker of upper.matchAll(MARKER)) {
    const rest = upper.slice(marker.index + marker[0].length);
    let m;
    if ((m = rest.match(DMY))) return valid(+m[3], +m[2], +m[1]);
    if ((m = rest.match(MY))) return valid(+m[2], +m[1], null);
    if ((m = rest.match(NAMED))) return valid(+m[2], MONTHS.indexOf(m[1]) + 1, null);
  }
  return null;
}

const utc = (d) => Date.UTC(d.year, d.month - 1, d.day);

// A date with no day stays valid through the end of its month.
export const lastValidDay = (e) => ({ year: e.year, month: e.month, day: e.day ?? lastDay(e.year, e.month) });

function addMonthClamped(d) {
  const year = d.month === 12 ? d.year + 1 : d.year;
  const month = (d.month % 12) + 1;
  return { year, month, day: Math.min(d.day, lastDay(year, month)) };
}

export function classify(expiry, today) {
  if (!expiry) return 'unknown';
  const last = utc(lastValidDay(expiry));
  if (last < utc(today)) return 'expired';
  if (last <= utc(today) + 7 * 864e5) return 'week';
  if (last <= utc(addMonthClamped(today))) return 'month';
  return 'later';
}

export function monthsLeft(expiry, today) {
  const last = lastValidDay(expiry);
  const whole = (last.year - today.year) * 12 + (last.month - today.month);
  return Math.max(0, last.day < today.day ? whole - 1 : whole);
}

export const todayFrom = (date) => ({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });
