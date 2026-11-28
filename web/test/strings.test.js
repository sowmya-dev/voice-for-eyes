import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { route } from '../js/core/intent.js';

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const strings = load('../strings.json');
const design = load('../../docs/design/voai/strings.json');
const tokens = readFileSync(new URL('../../docs/design/voai/tokens.css', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('every language has every interface string, and the design strings are unchanged', () => {
  const keys = Object.keys(strings.en).sort();
  assert.deepEqual(Object.keys(strings), ['en', 'hi', 'te', 'kn']);
  for (const lang of Object.keys(strings)) {
    assert.deepEqual(Object.keys(strings[lang]).sort(), keys, lang);
    for (const [key, value] of Object.entries(design[lang])) assert.equal(strings[lang][key], value, `${lang} ${key}`);
  }
});

test('the button fallback question routes to identify in every language', () => {
  for (const lang of Object.keys(strings)) assert.deepEqual(route(strings[lang].defaultQuestion), { name: 'identify', aspect: 'all' }, lang);
});

test('screens take colours from the design tokens', () => {
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], 'no hex colours outside tokens.css');
  for (const [, name] of css.matchAll(/var\((--[a-z-]+)\)/g)) {
    assert.ok(tokens.includes(`${name}:`) || css.includes(`${name}:`), name);
  }
});

test('script fonts and token contrast', () => {
  for (const font of ['Noto Sans Devanagari', 'Noto Sans Telugu', 'Noto Sans Kannada']) assert.ok(css.includes(font), font);
  const hex = Object.fromEntries([...tokens.matchAll(/(--[a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const pairs = [['--ink', '--bg'], ['--ink', '--surface'], ['--muted', '--bg'], ['--muted', '--surface'], ['--accent', '--surface'], ['--surface', '--accent'], ['--accent', '--accent-soft'], ['--accent', '--bg'], ['--warn', '--warn-bg'], ['--ink', '--warn-bg'], ['--ink', '--accent-soft']];
  for (const [fg, bg] of pairs) {
    const [a, b] = [lum(hex[fg]), lum(hex[bg])].sort((x, y) => y - x);
    assert.ok((a + 0.05) / (b + 0.05) >= 4.5, `${fg} on ${bg}`);
  }
});
