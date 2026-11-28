// Turns OCR lines from each processed copy into fields, and accepts a field only when two copies agree.
// OcrLine = { text, score, box: { x, y, w, h } }
import { parseExpiry } from './expiry.js';
import { findIngredient } from './ingredients.js';

const MIN_SCORE = 0.6; // shortcut: not tuned; set from real strip photos.
const NOT_A_NAME = /\b(ltd|limited|labs?|laboratories|pharma\w*|mfg|mfd|manufactured|marketed|batch|b\.?\s?no|m\.?r\.?p|rs|price|incl|taxes|store|keep|dosage|dose|warning|caution|schedule|composition|each|contains|physician|directed|children|exp|date|use before|best before|ip \d|tablets ip|capsules ip|lic|net)\b/i;
const NUTRITION = /^(energy|protein|carbohydrate|total sugar|sugar|total fat|saturated fat|fat|sodium|fib(re|er)|calories)\b.*\d/i;

export function toRows(lines) {
  const rows = [];
  for (const line of [...lines].sort((a, b) => a.box.y - b.box.y)) {
    const mid = line.box.y + line.box.h / 2;
    const row = rows.find((r) => Math.abs(r.mid - mid) < Math.min(r.h, line.box.h) * 0.6);
    if (row) row.items.push(line);
    else rows.push({ mid, h: line.box.h, items: [line] });
  }
  return rows.map((r) => {
    const items = r.items.sort((a, b) => a.box.x - b.box.x);
    return { items, text: items.map((i) => i.text).join(' ') };
  });
}

function findName(rows) {
  const candidates = rows.flatMap((row) => row.items
    .filter((i) => /[A-Za-z]{3}/.test(i.text) && !NOT_A_NAME.test(i.text))
    .map((item) => ({ item, row })));
  if (!candidates.length) return null;
  const best = candidates.reduce((a, b) => (b.item.box.h > a.item.box.h ? b : a));
  // Brand and strength are often split into two boxes of similar height.
  return best.row.items
    .filter((i) => i === best.item || (i.box.h >= best.item.box.h * 0.75 && /^\W*\d{2,4}\s*(mg)?\W*$/i.test(i.text)))
    .map((i) => i.text.trim())
    .join(' ');
}

export function extractFields(ocrLines) {
  const lines = ocrLines.filter((l) => l.score >= MIN_SCORE && l.text.trim());
  const rows = toRows(lines);
  const all = rows.map((r) => r.text).join('\n');
  const first = (test) => rows.find((r) => test.test(r.text.trim()))?.text.trim() ?? null;
  const pack = all.match(/(?<![\d.])(\d{1,3})\s*(?:tablets|tabs|capsules|caps)\b(?!\s*ip\b)/i);
  return {
    name: findName(rows),
    ingredient: findIngredient(all),
    expiry: rows.reduce((found, r) => found ?? parseExpiry(r.text), null),
    dosage: first(/^(dosage|dose)\b/i),
    packCount: pack ? Number(pack[1]) : null,
    warnings: rows.filter((r) => /^(warning|caution)\b/i.test(r.text.trim())).map((r) => r.text.trim()),
    nutrition: rows.filter((r) => NUTRITION.test(r.text.trim())).map((r) => r.text.trim()),
  };
}

// Spacing, case and punctuation may differ between copies. Digits never change.
export const normalise = (value) => String(value).toUpperCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');

const keyOf = {
  name: normalise,
  ingredient: normalise,
  expiry: (e) => `${e.year}-${e.month}-${e.day ?? ''}`,
  dosage: normalise,
  packCount: String,
};

function accept(values, key) {
  const seen = new Map();
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const k = key(value);
    if (seen.has(k)) return seen.get(k);
    seen.set(k, value);
  }
  return null;
}

export function labelIdOf(name, expiry) {
  if (!name) return null;
  return expiry ? `${normalise(name)}|${expiry.year}-${expiry.month}${expiry.day ? `-${expiry.day}` : ''}` : normalise(name);
}

export function agree(copies) {
  const reading = {};
  for (const [field, key] of Object.entries(keyOf)) reading[field] = accept(copies.map((c) => c[field]), key);
  for (const field of ['warnings', 'nutrition']) {
    const flat = copies.flatMap((c) => [...new Map(c[field].map((t) => [normalise(t), t])).values()]);
    const counts = new Map();
    for (const text of flat) counts.set(normalise(text), [...(counts.get(normalise(text)) ?? []), text]);
    reading[field] = [...counts.values()].filter((v) => v.length >= 2).map((v) => v[0]);
  }
  reading.labelId = labelIdOf(reading.name, reading.expiry);
  return reading;
}

export const emptyReading = () => agree([]);

// Adds a new read to what is already known about the same strip, keeping the first accepted value of
// each field. A different name or expiry means a different strip (an expired strip may share the name),
// so the new read starts again.
export function mergeReading(known, read) {
  const differs = (field) => read[field] && known[field] && keyOf[field](read[field]) !== keyOf[field](known[field]);
  if (!known || differs('name') || differs('expiry')) return read;
  const merged = { ...read };
  for (const field of Object.keys(keyOf)) merged[field] = known[field] ?? read[field];
  for (const field of ['warnings', 'nutrition']) merged[field] = read[field]?.length ? read[field] : (known[field] ?? []);
  merged.labelId = labelIdOf(merged.name, merged.expiry);
  return merged;
}
