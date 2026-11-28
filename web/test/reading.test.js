// The landing screen only waits; a label is read from the label-reading screen. And "I feel unwell" hears help first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, reading, expired, noExpiry } from './helpers.js';

const HELP = 'Please get help from someone nearby, and then contact a doctor.';
const WARNING = 'Warning: this has expired. Please do not take it.';
const cutLeft = () => noExpiry({ lines: [{ text: 'Dolo 650', score: 0.9, box: { x: 2, y: 300, w: 600, h: 60 } }] });
const screens = (t) => t.views.map((v) => v.screen);

test('a question that needs the label moves to the reading screen before anything is read', async () => {
  for (const question of ['What is this tablet?', 'When does it expire?', 'What is the dosage?', 'How many are left?', 'I just took one', 'Is this safe for me?', 'How much protein is in this?']) {
    const t = setup();
    await t.hear(question);
    assert.equal(t.screensAtRead[0], 'reading', question);
    assert.equal(t.views.find((v) => v.screen === 'reading').asked, question);
    assert.notEqual(t.view().screen, 'reading', question);
  }
});

test('unclear words are checked on the reading screen, then the noisy-speech screen follows', async () => {
  const t = setup();
  await t.hear('blah mumble');
  assert.equal(t.screensAtRead[0], 'reading');
  assert.equal(t.view().screen, '2');
});

test('questions that need no label never show the reading screen', async () => {
  for (const question of ["What's around me?", 'Which medicine should I take?', 'speak in Hindi']) {
    const t = setup();
    await t.hear(question);
    assert.ok(!screens(t).includes('reading'), question);
    assert.equal(t.screensAtRead.length, 0, question);
  }
});

test('retries and the noisy-speech steps keep their own screen', async () => {
  const retry = setup({ readings: [cutLeft()] });
  await retry.hear('What is this tablet?');
  const first = screens(retry).indexOf('5');
  assert.ok(first > 0 && !screens(retry).slice(first).includes('reading'), screens(retry).join());
  assert.ok(retry.screensAtRead.slice(-3).every((s) => s === '5' || s === '5b'), retry.screensAtRead.join());
  const noisy = setup();
  await noisy.hear('');
  await noisy.hear('');
  assert.equal(noisy.screensAtRead.at(-1), '2');
});

test('back from a result goes to the screen before the question, not to the reading screen', async () => {
  const t = setup();
  await t.hear('What is this tablet?');
  await t.hear('back');
  assert.equal(t.view().screen, '1');
});

test('later while reading pauses, and continue reads again and answers the same question', async () => {
  const t = setup();
  t.duringNextRead(() => t.hear('later'));
  await t.hear('What is this tablet?');
  assert.equal(t.view().screen, '5d');
  assert.doesNotMatch(t.text(), /Dolo 650/);
  await t.hear('continue');
  assert.match(t.said.at(-1).text, /Dolo 650, a fever tablet/);
  assert.equal(t.view().screen, '3');
});

test('settings while reading is refused', async () => {
  const t = setup();
  t.duringNextRead(() => t.hear('open settings'));
  await t.hear('What is this tablet?');
  assert.equal(t.said.at(-1).text, "Let's finish this first.");
  assert.equal(t.view().screen, '1b');
});

test('feeling unwell: the help instruction comes before any camera read', async () => {
  const t = setup();
  await t.hear('I took this tablet and now I feel dizzy');
  assert.ok(t.said[0].text.startsWith(HELP), t.said[0].text);
  assert.equal(t.said[0].at, 0, 'nothing delays the instruction');
  assert.equal(t.captures(), 1, 'the label is read afterwards');
  assert.ok(!screens(t).includes('reading'), 'the instruction stays on screen');
});

test('feeling unwell with an expired strip: help first, then the warning and the risk check', async () => {
  const t = setup({ readings: [expired()] });
  await t.hear('I took this tablet and now I feel dizzy');
  assert.ok(t.said[0].text.startsWith(HELP));
  assert.equal(t.said[1].text, WARNING);
  assert.equal(t.said[2].text, 'Do you understand the risk?');
  assert.equal(t.view().screen, '4');
});

test('a different strip since the last read is read again, and its expiry warning follows', async () => {
  const t = setup({ readings: [reading(), expired()] });
  await t.hear('What is this tablet?');
  t.clear();
  await t.hear('I feel dizzy');
  assert.ok(t.said[0].text.startsWith(HELP));
  assert.equal(t.said.filter((s) => s.text.includes(WARNING)).length, 1);
});

test('a known expired strip warns once, after the help instruction', async () => {
  const t = setup({ readings: [expired()] });
  await t.hear('What is this tablet?');
  await t.hear('yes');
  t.clear();
  await t.hear('I feel dizzy');
  assert.ok(t.said[0].text.startsWith(`${HELP} ${WARNING}`), t.said[0].text);
  assert.equal(t.said.filter((s) => s.text.includes(WARNING)).length, 1);
});

test('feeling unwell with a strip expiring soon: the notice follows the instruction', async () => {
  const t = setup({ readings: [reading({ expiry: { year: 2026, month: 12, day: 10 } })] });
  await t.hear('I feel dizzy');
  assert.ok(t.said[0].text.startsWith(HELP));
  assert.equal(t.said[1].text, 'This medicine expires within one month.');
});
