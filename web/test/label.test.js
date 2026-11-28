import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpiry, classify, monthsLeft } from '../js/core/expiry.js';
import { extractFields, agree } from '../js/core/label.js';
import { purposeFor } from '../js/core/ingredients.js';

const d = (year, month, day) => ({ year, month, day });
const line = (text, y, h = 30, x = 100, score = 0.95) => ({ text, score, box: { x, y, w: text.length * h * 0.5, h } });

test('expiry: only a date beside EXP counts', () => {
  assert.deepEqual(parseExpiry('EXP 12/2027'), d(2027, 12, null));
  assert.deepEqual(parseExpiry('EXP.DATE: 03-27'), d(2027, 3, null));
  assert.deepEqual(parseExpiry('Exp: DEC 2027'), d(2027, 12, null));
  assert.deepEqual(parseExpiry('EXP 17/03/2027'), d(2027, 3, 17));
  assert.equal(parseExpiry('12/2027'), null);                       // Unmarked date
  assert.equal(parseExpiry('USE BEFORE 12/2027'), null);
  assert.equal(parseExpiry('EXP 13/2027'), null);
  assert.equal(parseExpiry('EXP 31/02/2027'), null);
});

test('expiry: MFG date is never the expiry', () => {
  assert.deepEqual(parseExpiry('MFG 01/2025   EXP 12/2027'), d(2027, 12, null));
  assert.equal(parseExpiry('EXP        MFG 01/2025'), null);
});

test('expiry window boundaries', () => {
  const t = d(2027, 3, 10);
  assert.equal(classify(d(2027, 3, 10), t), 'week');   // Last valid day
  assert.equal(classify(d(2027, 3, 9), t), 'expired'); // Day after expiry
  assert.equal(classify(d(2027, 3, 17), t), 'week');   // Seven days left
  assert.equal(classify(d(2027, 3, 18), t), 'month');  // Eight days left
  assert.equal(classify(d(2027, 4, 10), t), 'month');  // One month boundary
  assert.equal(classify(d(2027, 4, 11), t), 'later');  // Past one month
  assert.equal(classify(d(2027, 2, 28), d(2027, 1, 31)), 'month'); // Shorter next month
  assert.equal(classify(d(2027, 3, 1), d(2027, 1, 31)), 'later');
  assert.equal(classify(d(2027, 3, null), d(2027, 3, 28)), 'week'); // Month and year only
  assert.equal(classify(null, t), 'unknown');
});

test('months left rounds down', () => {
  assert.equal(monthsLeft(d(2027, 2, null), d(2026, 11, 28)), 3);
  assert.equal(monthsLeft(d(2027, 12, null), d(2026, 11, 28)), 13);
});

const strip = (expiry = 'EXP 12/2027') => [
  line('DOLO-650', 40, 60),
  line('Paracetamol Tablets IP 650 mg', 120, 24),
  line('MFG 01/2025', 170, 22),
  { ...line(expiry, 170, 22), box: { x: 500, y: 170, w: 200, h: 22 } },
  line('Micro Labs Limited', 220, 26),
  line('15 Tablets', 260, 20),
  line('Dosage: As directed by the physician', 300, 20),
];

test('fields: name, ingredient, expiry, dosage and pack count', () => {
  const f = extractFields(strip());
  assert.equal(f.name, 'DOLO-650');
  assert.equal(f.ingredient, 'paracetamol');
  assert.deepEqual(f.expiry, d(2027, 12, null));
  assert.equal(f.dosage, 'Dosage: As directed by the physician');
  assert.equal(f.packCount, 15);
});

test('fields: EXP and its date split into two boxes on one row', () => {
  const f = extractFields([line('EXP.', 100, 22, 100), line('12/2027', 101, 22, 200)]);
  assert.deepEqual(f.expiry, d(2027, 12, null));
});

test('agreement: two copies must agree, digits are never changed', () => {
  const a = extractFields(strip());
  const b = extractFields(strip().map((l) => (l.text === 'DOLO-650' ? { ...l, text: 'Dolo 650' } : l)));
  const c = extractFields(strip('EXP 12/2021'));
  const r = agree([a, b, c]);
  assert.equal(r.name, 'DOLO-650');
  assert.deepEqual(r.expiry, d(2027, 12, null));
  const none = agree([extractFields(strip('EXP 12/2027')), extractFields(strip('EXP 12/2021'))]);
  assert.equal(none.expiry, null); // No agreement
  assert.equal(agree([a]).name, null);
});

test('agreement: label id comes from accepted name and expiry', () => {
  const f = extractFields(strip());
  assert.equal(agree([f, f]).labelId, 'DOLO650|2027-12');
  assert.equal(agree([f]).labelId, null);
});

test('purpose comes only from the bundled table', () => {
  assert.equal(purposeFor('paracetamol'), 'fever');
  assert.equal(purposeFor('unobtainium'), null);
  assert.equal(extractFields([line('Paracetamol and Ibuprofen Tablets', 10)]).ingredient, null);
});
