import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, reading, noExpiry, GOOD_QUALITY } from './helpers.js';
import { cueFor } from '../js/core/guidance.js';

const cutLeft = () => noExpiry({ lines: [{ text: 'Dolo 650', score: 0.9, box: { x: 2, y: 300, w: 600, h: 60 } }] });
const FINAL = /can't confirm.*ask someone to check/;

test('blurry label: five seconds of cleaning, then the exact sentence with one direction', async () => {
  const t = setup({ readings: [cutLeft()] });
  await t.hear('What is this tablet?');
  assert.ok(t.said[0].at >= 5000, `cleaned only ${t.said[0].at} ms`);
  assert.match(t.said[0].text, /^I can read: Dolo 650\. I can't read this\. Move the medicine (left|right) so I can see the expiry date\./);
  const first = t.views.find((v) => v.screen === '5');
  assert.equal(first.attempt, 1);
  assert.equal(first.direction, 'right', 'a rear camera: cut at the left edge means move right');
});

test('three attempts, then ask someone to check', async () => {
  const t = setup({ readings: [cutLeft()] });
  await t.hear('What is this tablet?');
  const attempts = [...new Set(t.views.filter((v) => v.attempt).map((v) => `${v.screen}:${v.attempt}`))];
  assert.deepEqual(attempts, ['5:1', '5b:2', '5b:3']);
  assert.match(t.said.at(-1).text, FINAL);
  assert.equal(t.view().final, true);
  assert.equal(t.said.filter((s) => /Move the medicine/.test(s.text)).length, 3);
});

test('readable on a retry: answer and stop asking', async () => {
  const t = setup({ readings: [cutLeft(), cutLeft(), cutLeft(), reading()] });
  await t.hear('What is this tablet?');
  assert.match(t.said.at(-1).text, /Dolo 650, a fever tablet/);
  assert.equal(t.said.filter((s) => /Move the medicine/.test(s.text)).length, 1);
});

test('camera is fixed before the medicine is moved', async () => {
  const shaky = { reading: cutLeft(), quality: { ...GOOD_QUALITY, sharpness: 10, motion: 30 } };
  const t = setup({ readings: [shaky, shaky, shaky, { reading: cutLeft(), quality: GOOD_QUALITY }] });
  await t.hear('What is this tablet?');
  assert.match(t.said[0].text, /hold the phone still/i);
  assert.match(t.said[1].text, /Move the medicine/);
});

test('guidance: one cue at a time, sideways, then up or down, then distance', () => {
  const frame = { width: 1000, height: 1000 };
  const at = (x, y, w, h) => ({ frame, lines: [{ box: { x, y, w, h } }], expiry: null });
  assert.equal(cueFor(at(2, 2, 300, 100), GOOD_QUALITY).action, 'right');
  assert.equal(cueFor(at(2, 2, 300, 100), GOOD_QUALITY, { frontCamera: true }).action, 'left');
  assert.equal(cueFor(at(300, 2, 300, 100), GOOD_QUALITY).action, 'down');
  assert.equal(cueFor(at(2, 300, 996, 100), GOOD_QUALITY).action, 'farther');
  assert.equal(cueFor(at(480, 480, 60, 20), GOOD_QUALITY).action, 'closer');
  assert.equal(cueFor(at(200, 300, 600, 300), GOOD_QUALITY).action, 'turn_over');
  const hazy = { ...GOOD_QUALITY, sharpness: 10, contrast: 10, motion: 1 };
  assert.equal(cueFor(at(200, 300, 600, 300), hazy, { previousHazy: true }).action, 'wipe_lens');
  assert.equal(cueFor({ frame, lines: [], expiry: null }, GOOD_QUALITY).action, 'point_camera');
});

test('take photo counts as an attempt, later pauses, continue resumes', async () => {
  const t = setup({ readings: [cutLeft()] });
  let paused = false;
  // Say "later" while the first instruction is waiting for the user to move.
  t.duringNextWait(async () => { paused = true; await t.hear('later'); });
  await t.hear('What is this tablet?');
  assert.ok(paused);
  assert.equal(t.view().screen, '5d');
  t.clear();
  t.duringNextWait(async () => { await t.hear('take photo'); });
  await t.hear('continue');
  assert.match(t.text(), /Taking a photo in 3, 2, 1\./);
  const shot = t.views.find((v) => v.screen === '5c');
  assert.equal(shot.attempt, 2);
  assert.match(t.said.at(-1).text, FINAL);
});

test('unclear speech ladder: repeat or quieter, then label with a confirm, then repeat the question', async () => {
  const t = setup();
  await t.hear('umm expi something');
  assert.match(t.said[0].text, /say it again, or move somewhere quieter/);
  assert.equal(t.view().screen, '2');
  assert.equal(t.view().step, 2);
  t.clear();
  await t.hear('grr expi');
  assert.match(t.said[0].text, /I can read this on the label: Dolo 650/);
  assert.match(t.said[0].text, /Do you want to know the expiry date\?/);
  assert.doesNotMatch(t.said[0].text, /Dosage/);
  t.clear();
  await t.hear('yes');
  assert.match(t.said[0].text, /^You said: yes\./);
  assert.match(t.said[0].text, /February 2027/);
});

test('unclear confirm that is not a clear yes asks to repeat the question', async () => {
  const t = setup();
  await t.hear('umm expi');
  await t.hear('grr expi');
  t.clear();
  await t.hear('blah');
  assert.match(t.said[0].text, /ask your question again.*clearly/);
});

test('empty transcript is unclear; clarified question is repeated back', async () => {
  const t = setup();
  await t.hear('');
  t.clear();
  await t.hear('What is this tablet');
  assert.match(t.said[0].text, /^You said: What is this tablet\./);
});

test('camera text resolves a doubtful transcript', async () => {
  const t = setup();
  await t.hear('dolo um hmm');
  assert.match(t.said[0].text, /Dolo 650, a fever tablet/);
});

test('a different medicine name than the label is unclear', async () => {
  const t = setup();
  await t.hear('What is this tablet crocin 500');
  assert.match(t.said[0].text, /say it again, or move somewhere quieter/);
});

test('count: asks for the entire strip up to three times, then asks someone to count', async () => {
  const t = setup({ counts: [{ count: null }] });
  await t.hear('How many are left in this strip?');
  assert.equal(t.said.filter((s) => /entire strip/.test(s.text)).length, 3);
  assert.match(t.said.at(-1).text, /can't count the tablets.*someone/);
});

test('count: counted on a retry; with no counter nothing is guessed', async () => {
  const t = setup({ counts: [{ count: null }, { count: 4 }] });
  await t.hear('How many are left in this strip?');
  assert.equal(t.said.at(-1).text, 'I can see 4 tablets.');
  assert.equal(t.view().tiles.count, '4');
  const none = setup();
  await none.hear('How many are left in this strip?');
  assert.match(none.said[0].text, /can't count the tablets/);
  assert.doesNotMatch(none.text(), /\d tablets/);
});
