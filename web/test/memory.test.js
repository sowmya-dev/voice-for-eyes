// The strip is read once, gathered across reads, and follow-up questions are answered from memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, reading, noExpiry } from './helpers.js';
import { mergeReading } from '../js/core/label.js';

const WARNING = 'Warning: this has expired. Please do not take it.';
const at = (year, month, day = null) => reading({ expiry: { year, month, day } });
const expiryAnswer = async (r) => {
  const t = setup({ readings: [r] });
  await t.hear('When does it expire?');
  return t.said[0].text;
};

// ---------- label gathered across reads ----------
test('Name then expiry: the front and the back add up, with no request to move', async () => {
  const t = setup({ readings: [noExpiry(), reading({ name: null })] });
  await t.hear('What is this tablet?');
  assert.match(t.said[0].text, /Dolo 650/);
  assert.doesNotMatch(t.text(), /Move the medicine|turn/i);
});

test('Different strip: a different name starts again', () => {
  const known = reading();
  const next = reading({ name: 'Crocin', expiry: null });
  assert.equal(mergeReading(known, next), next);
  assert.equal(mergeReading(known, reading({ name: null, dosage: '1 tablet' })).name, 'Dolo 650');
});

test('Same name, different expiry: the new expiry is used', () => {
  const later = reading({ expiry: { year: 2026, month: 8, day: null } });
  assert.deepEqual(mergeReading(reading(), later).expiry, later.expiry);
});

// ---------- answers from the remembered label ----------
test('Follow-up question: answered from memory without reading the camera', async () => {
  const t = setup({ readings: [reading()] });
  await t.hear('What is this tablet?');
  const reads = t.captures();
  t.clear();
  await t.hear('When does it expire?');
  assert.equal(t.captures(), reads);
  assert.match(t.said[0].text, /^The expiry is on /);
});

test('New tablet: "What is this tablet?" reads the camera again', async () => {
  const t = setup({ readings: [reading(), reading({ name: 'Crocin', labelId: 'CROCIN|2027-2' })] });
  await t.hear('What is this tablet?');
  const reads = t.captures();
  await t.hear('What is this tablet?');
  assert.ok(t.captures() > reads);
  assert.match(t.said.at(-1).text, /Crocin/);
});

test('Start over: the remembered label is forgotten', async () => {
  const t = setup({ readings: [reading()] });
  await t.hear('What is this tablet?');
  await t.hear('start over');
  const reads = t.captures();
  await t.hear('When does it expire?');
  assert.ok(t.captures() > reads);
});

test('Long pause: 20 minutes later the answer still comes from memory', async () => {
  const t = setup({ readings: [reading()] });
  await t.hear('What is this tablet?');
  t.advance(20 * 60 * 1000);
  const reads = t.captures();
  await t.hear('When does it expire?');
  assert.equal(t.captures(), reads);
});

test('Same tablet asked again: one look, nothing new, answered without asking to move', async () => {
  const empty = noExpiry({ name: null, lines: [] });
  const t = setup({ readings: [reading(), empty] });
  await t.hear('What is this tablet?');
  t.clear();
  await t.hear('What is this tablet?');
  assert.match(t.said[0].text, /Dolo 650/);
  assert.doesNotMatch(t.text(), /Move the medicine|hold/i);
});

// ---------- session state kept and shown ----------
test('Card keeps the count: an expiry answer after the count still shows it', async () => {
  const t = setup({ readings: [reading()], counts: [{ count: 4 }] });
  await t.hear('What is this tablet?');
  await t.hear('How many are left?');
  await t.hear('When does it expire?');
  assert.equal(t.view().tiles.count, '4');
});

test('Start over clears the state: label, count and general answers are forgotten', async () => {
  const cloudState = { enabled: true, keyConfigured: true, online: true };
  const t = setup({ readings: [reading()], counts: [{ count: 4 }], cloudState });
  await t.hear('What is this tablet?');
  await t.hear('Who is Gandhi?');
  await t.hear('start over');
  const reads = t.captures();
  await t.hear('When does it expire?');
  assert.ok(t.captures() > reads, 'the label is read again');
  await t.hear('Who is Gandhi?');
  assert.deepEqual(t.cloudCalls.at(-1).history, []);
});

// ---------- follow-up general questions ----------
const CLOUD_ON = { enabled: true, keyConfigured: true, online: true };

test('Follow-up on a general answer: the earlier question and answer go along as context', async () => {
  const t = setup({ cloudState: CLOUD_ON, cloud: (r) => ({ text: r.text.startsWith('Who') ? 'A leader of India.' : 'In Porbandar.' }) });
  await t.hear('Who is Gandhi?');
  await t.hear('Where was he born?');
  assert.equal(t.cloudCalls.length, 2, 'the follow-up with no keyword is still a general question');
  assert.deepEqual(t.cloudCalls[1].history, [{ question: 'Who is Gandhi?', answer: 'A leader of India.' }]);
  assert.match(t.said.at(-1).text, /Porbandar/);
});

test('No medicine context: medicine answers are never sent with a general question', async () => {
  const t = setup({ readings: [reading()], cloudState: CLOUD_ON });
  await t.hear('What is this tablet?');
  await t.hear('Who is Gandhi?');
  assert.deepEqual(t.cloudCalls[0].history, []);
});

// ---------- count gathered with the label ----------
test('Count remembered: counted in the background and given without the camera', async () => {
  const t = setup({ readings: [reading()], counts: [{ count: 4 }] });
  await t.hear('What is this tablet?');
  const reads = t.captures();
  t.clear();
  await t.hear('How many are left?');
  assert.equal(t.captures(), reads);
  assert.match(t.said[0].text, /I can see 4 tablets/);
});

test('Tablet taken: the remembered count is forgotten', async () => {
  const t = setup({ readings: [reading()], counts: [{ count: 4 }, { count: 3 }] });
  await t.hear('What is this tablet?');
  await t.hear('I took one');
  const reads = t.captures();
  t.clear();
  await t.hear('How many are left?');
  assert.ok(t.captures() > reads, 'the camera is read again');
  assert.match(t.said[0].text, /I can see 3 tablets/);
});

// ---------- the expiry answer (today is 28 November 2026) ----------
test('Expired: warning, the date, and get a new one', async () => {
  const text = await expiryAnswer(at(2026, 8));
  assert.ok(text.startsWith(WARNING), text);
  assert.match(text, /The expiry is on .*Please get a new one\./);
});

test('Days left: the date, then the days left and that it can still be taken', async () => {
  const text = await expiryAnswer(at(2026, 12, 10));
  assert.match(text, /^The expiry is on .*\. It has 12 days left, so you can still take it\.$/);
  assert.doesNotMatch(text, /expires within/, 'the days left are the notice');
});

test('Expires today: it can still be taken today', async () => {
  assert.match(await expiryAnswer(at(2026, 11, 28)), /^The expiry is on .*\. It expires today, so you can still take it today\.$/);
});

test('Months left: how many more months', async () => {
  assert.match(await expiryAnswer(at(2027, 4, 28)), /^The expiry is on .*\. It is good for about 5 more months\.$/);
});

test('Years left: more than N years', async () => {
  assert.match(await expiryAnswer(at(2029, 2, 28)), /^The expiry is on .*\. It is good for more than 2 years\.$/);
});

test('Expiry not read: the system says it cannot read the expiry date', async () => {
  const t = setup({ readings: [noExpiry()] });
  await t.hear('When does it expire?');
  assert.match(t.said[0].text, /^I can read: Dolo 650\. I can't read the expiry date\./);
});

test('Expiry question within one month: no separate notice, other answers keep it', async () => {
  const t = setup({ readings: [at(2026, 12, 10)] });
  await t.hear('What is this tablet?');
  assert.match(t.said[0].text, /expires within one month/);
});
