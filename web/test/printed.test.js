// Everything printed is kept, ranked by letter size, and read back largest first. Varied local data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFields, agree, mergeReading, rankTexts } from '../js/core/label.js';
import { route } from '../js/core/intent.js';
import { setup, reading, expired } from './helpers.js';

const line = (text, size, y) => ({ text, score: 0.95, size, box: { x: 100, y, w: text.length * size * 0.5, h: size } });
const FRONT = [line('DOLO 650', 64, 40), line('Paracetamol Tablets IP 650 mg', 40, 130), line('Micro Labs Ltd, Bengaluru', 18, 200)];
const texts = (...pairs) => rankTexts(pairs.map(([text, size]) => ({ text, size })));

test('Ranked by size: largest first, each in its tier', () => {
  const fields = extractFields(FRONT);
  assert.deepEqual(fields.texts.map((t) => [t.text, t.tier]), [
    ['DOLO 650', 'largest'], ['Paracetamol Tablets IP 650 mg', 'larger'], ['Micro Labs Ltd, Bengaluru', 'small'],
  ]);
  assert.equal(fields.name, 'DOLO 650');
});

test('tiers are relative to the largest line on that label', () => {
  const ranked = texts(['A big name', 100], ['eighty', 80], ['sixty', 60], ['forty', 40], ['tiny', 10]);
  assert.deepEqual(ranked.map((t) => t.tier), ['largest', 'largest', 'larger', 'large', 'small']);
});

test('a line is kept only when two copies read it the same', () => {
  const a = extractFields(FRONT);
  const b = extractFields([FRONT[0], FRONT[1], line('Micr0 Lab5 Ltd', 18, 200)]);
  const kept = agree([a, b]).texts.map((t) => t.text);
  assert.deepEqual(kept, ['DOLO 650', 'Paracetamol Tablets IP 650 mg']);
});

test('Kept across reads: front and back together, each line once', () => {
  const front = { ...reading(), texts: texts(['DOLO 650', 64], ['Paracetamol Tablets IP 650 mg', 34]) };
  const back = { ...reading({ name: null }), texts: texts(['EXP 02/2027', 30], ['DOLO 650', 40], ['1 x 15 Tablets', 28]) };
  const merged = mergeReading(front, back);
  assert.deepEqual(merged.texts.map((t) => t.text), ['DOLO 650', 'Paracetamol Tablets IP 650 mg', 'EXP 02/2027', '1 x 15 Tablets']);
  assert.equal(merged.texts[0].size, 64, 'the larger size wins');
});

test('"read the label" and friends ask for everything printed', () => {
  for (const text of ['Read the label', 'What else is written on it?', 'What does it say?', 'read it out', 'इस पर क्या लिखा है', 'దీనిపై ఏం రాసి ఉంది', 'ಇದರ ಮೇಲೆ ಏನು ಬರೆದಿದೆ']) {
    assert.deepEqual(route(text), { name: 'identify', aspect: 'text' }, text);
  }
  assert.deepEqual(route('What is this tablet?'), { name: 'identify', aspect: 'all' });
});

const many = texts(...Array.from({ length: 11 }, (_, i) => [`Line ${String.fromCharCode(65 + i)}`, 60 - i]));

test('Read everything: from memory, largest letters first', async () => {
  const t = setup({ readings: [{ ...reading(), texts: texts(['DOLO 650', 64], ['Paracetamol 650 mg', 34], ['Micro Labs', 18]) }] });
  await t.hear('What is this tablet?');
  const reads = t.captures();
  t.clear();
  await t.hear('What else is written on it?');
  assert.equal(t.captures(), reads);
  assert.equal(t.said[0].text, 'It says: DOLO 650. Paracetamol 650 mg. Micro Labs.');
});

test('More text: 8 lines, then "go on?", then the rest on yes', async () => {
  const t = setup({ readings: [{ ...reading(), texts: many }] });
  await t.hear('Read the label');
  assert.match(t.said[0].text, /^It says: Line A\. .*Line H\.$/);
  assert.doesNotMatch(t.said[0].text, /Line I/);
  assert.equal(t.said.at(-1).text, 'There is more. Do you want me to go on?');
  t.clear();
  await t.hear('yes');
  assert.equal(t.said[0].text, 'It says: Line I. Line J. Line K.');
});

test('Dosage left out: the dosage line is not read, and the user is told to ask', async () => {
  const t = setup({ readings: [{ ...reading(), texts: texts(['DOLO 650', 64], ['Dosage: 1 tablet twice daily', 30], ['Store below 25C', 20]) }] });
  await t.hear('Read the label');
  assert.equal(t.said[0].text, 'It says: DOLO 650. Store below 25C. Ask me for the dosage separately.');
});

test('Expired label read out: the warning comes first', async () => {
  const t = setup({ readings: [{ ...expired(), texts: texts(['DOLO 650', 64], ['Micro Labs', 18]) }] });
  await t.hear('Read the label');
  assert.match(t.said[0].text, /^Warning: this has expired\. Please do not take it\. It says: DOLO 650\. Micro Labs\./);
});

test('nothing read: says so plainly', async () => {
  const t = setup({ readings: [reading({ name: null, expiry: null, texts: [] })] });
  await t.hear('Read the label');
  assert.ok(t.said.some((s) => s.text === "I can't read any text on it yet."), t.said.map((s) => s.text).join(' | '));
});
