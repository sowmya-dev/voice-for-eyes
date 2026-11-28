// Counting with OCR and the blister model together: printed total minus the used cells. Varied local data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, reading } from './helpers.js';

const usedCells = (n) => ({ count: null, empty: n });
const said = (t, pattern) => t.said.some((s) => pattern.test(s.text));

test('Worked out from the print: holds 10, 3 used, 7 left, on the card too', async () => {
  const t = setup({ readings: [reading({ packCount: 10 })], counts: [usedCells(3)] });
  await t.hear('How many are left?');
  assert.ok(said(t, /^The strip holds 10\. I can see 3 used, so 7 should be left\.$/), t.text());
  assert.equal(t.view().tiles.count, '7');
});

test('Worked out from the print: varied totals and used cells', async () => {
  for (const [total, empty, left] of [[15, 1, 14], [10, 9, 1], [10, 10, 0], [14, 4, 10]]) {
    const t = setup({ readings: [reading({ packCount: total })], counts: [usedCells(empty)] });
    await t.hear('How many are left?');
    assert.ok(said(t, new RegExp(`holds ${total}\\. I can see ${empty} used, so ${left} should be left`)), `${total}-${empty}: ${t.text()}`);
  }
});

test('Printed total not read yet: asks for the printed side, reads it, then answers', async () => {
  const t = setup({ readings: [reading({ packCount: null }), reading({ name: null, packCount: 10 })], counts: [usedCells(3)] });
  await t.hear('How many are left?');
  assert.ok(said(t, /^I can see 3 used\. Show me the side that says how many the strip holds/), t.text());
  assert.ok(said(t, /holds 10\. I can see 3 used, so 7 should be left/), t.text());
});

test('Printed total never read: no count is guessed', async () => {
  const t = setup({ readings: [reading({ packCount: null })], counts: [usedCells(3)] });
  await t.hear('How many are left?');
  assert.ok(said(t, /can't count the tablets/), t.text());
  assert.ok(!said(t, /should be left/), t.text());
});

test('More empty than printed: no count is given', async () => {
  const t = setup({ readings: [reading({ packCount: 10 })], counts: [usedCells(12)] });
  await t.hear('How many are left?');
  assert.ok(!said(t, /should be left/), t.text());
  assert.ok(said(t, /can't count the tablets/), t.text());
});

test('A full-pocket model still counts what it sees, ahead of the printed total', async () => {
  const t = setup({ readings: [reading({ packCount: 10 })], counts: [{ count: 6, empty: 4 }] });
  await t.hear('How many are left?');
  assert.ok(said(t, /^I can see 6 tablets\.$/), t.text());
});

test('Counted in the background with the label, answered from memory with the explanation', async () => {
  const t = setup({ readings: [reading({ packCount: 10 })], counts: [usedCells(2)] });
  await t.hear('What is this tablet?');
  const reads = t.captures();
  t.clear();
  await t.hear('How many are left?');
  assert.equal(t.captures(), reads, 'no new read');
  assert.match(t.said[0].text, /holds 10\. I can see 2 used, so 8 should be left/);
});

test('After "I took one" the worked-out count is read again', async () => {
  const t = setup({ readings: [reading({ packCount: 10 })], counts: [usedCells(2), usedCells(3)] });
  await t.hear('What is this tablet?');
  await t.hear('I took one');
  t.clear();
  await t.hear('How many are left?');
  assert.ok(said(t, /so 7 should be left/), t.text());
});
