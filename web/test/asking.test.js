// The app must not keep asking to see the strip. The count is offered only when it is already known, counted
// silently once per strip, and asked for at most once per strip in a session. Varied local data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setup, reading } from './helpers.js';
import { countRequestTitle } from '../js/ui/render.js';

const strings = JSON.parse(readFileSync(new URL('../strings.json', import.meta.url), 'utf8'));
const CANT = { count: null, empty: null, strips: 1 };
const TWO_STRIPS = { count: null, empty: null, strips: 2 };
const times = (t, pattern) => t.said.filter((s) => pattern.test(s.text)).length;
const SHOW = /Please show me the entire strip/;
const OFFER = /Do you want to know how many tablets are left\?/;

// ---------- the count is offered only when it is already known ----------
test('Count not offered after it failed: no offer that would lead to "show me the strip"', async () => {
  const t = setup({ readings: [reading()], counts: [CANT] });
  await t.hear('What is this tablet?');
  await t.hear('When does it expire?');
  assert.equal(times(t, OFFER), 0, t.text());
});

test('Count offered only when known: counted in the background, offered, answered from memory', async () => {
  const t = setup({ readings: [reading()], counts: [{ count: 4 }] });
  await t.hear('What is this tablet?');
  assert.match(t.said.at(-1).text, OFFER);
  const reads = t.captures();
  t.clear();
  await t.hear('yes');
  assert.equal(t.captures(), reads, 'no camera read');
  assert.match(t.said[0].text, /I can see 4 tablets/);
  assert.equal(times(t, SHOW), 0);
});

// A strip model that has not answered yet: the test decides when it does.
const slowCount = () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  return { pending, finish };
};
const settle = () => new Promise((resolve) => setImmediate(resolve)); // lets the assistant run until it has to wait

test('the offer waits for a silent count that is still running', async () => {
  const { pending, finish } = slowCount();
  const t = setup({ readings: [reading()], counts: [pending] });
  const heard = t.hear('What is this tablet?');
  await settle();
  assert.match(t.text(), /Dolo 650/, 'the answer is not held back by the count');
  assert.equal(times(t, OFFER), 0, 'nothing is offered while the count is unknown');
  finish({ count: 4 });
  await heard;
  assert.match(t.said.at(-1).text, OFFER);
});

test('a silent count that ends after the user has moved on brings no late offer', async () => {
  const { pending, finish } = slowCount();
  const t = setup({ readings: [reading({ composition: 'Paracetamol IP 650 mg' })], counts: [pending] });
  const first = t.hear('What is this tablet?');
  await settle();
  const second = t.hear('What does it contain?');
  await settle();
  finish({ count: 4 });
  await Promise.all([first, second]);
  assert.equal(times(t, OFFER), 1, t.text());
  assert.equal(t.countCalls(), 1);
});

test('with no strip model at all, counting is never offered', async () => {
  const t = setup({ readings: [reading()] });
  await t.hear('What is this tablet?');
  assert.equal(times(t, OFFER), 0);
});

// ---------- one silent count per strip ----------
test('No recount after each answer: the strip model is asked once for a strip', async () => {
  const t = setup({ readings: [reading({ composition: 'Paracetamol IP 650 mg' })], counts: [CANT] });
  await t.hear('What is this tablet?');
  await t.hear('When does it expire?');
  await t.hear('What does it contain?');
  await t.hear('Tell me about this medicine');
  assert.equal(t.countCalls(), 1);
});

test('a tablet taken, or a different strip, lets the silent count run again', async () => {
  const t = setup({ readings: [reading(), reading(), reading({ name: 'Crocin' })], counts: [CANT] });
  await t.hear('What is this tablet?');
  assert.equal(t.countCalls(), 1);
  await t.hear('I took one');
  await t.hear('When does it expire?');
  assert.equal(t.countCalls(), 2, 'the strip has changed, so it is counted again');
  await t.hear('What is this tablet?');
  assert.match(t.text(), /Crocin/);
  assert.equal(t.countCalls(), 3, 'a different strip is counted');
});

// ---------- one request per strip ----------
test('Strip not fully visible: asks to show the entire strip and states no number', async () => {
  const t = setup({ readings: [reading()], counts: [CANT] });
  await t.hear('How many are left?');
  assert.equal(times(t, SHOW), 1);
  assert.equal(times(t, /\d+ tablets|should be left|\d+ used/), 0, t.text());
  assert.equal(t.view().tiles?.count ?? null, null, 'and no number on the screen');
});

test('Asked again about the same strip: one request in all, then honest answers with no request', async () => {
  const t = setup({ readings: [reading()], counts: [CANT] });
  await t.hear('How many are left?');
  assert.equal(times(t, SHOW), 1);
  for (let again = 0; again < 3; again += 1) {
    t.clear();
    await t.hear('How many are left?');
    assert.equal(times(t, SHOW), 0, t.text());
    assert.match(t.said.at(-1).text, /can't count the tablets.*someone/);
    assert.equal(t.view().screen, '1');
  }
});

test('asked again, and now it can be counted: the count is given with no request', async () => {
  const t = setup({ readings: [reading()], counts: [CANT, CANT, { count: 6 }] });
  await t.hear('How many are left?');
  t.clear();
  await t.hear('How many are left?');
  assert.equal(times(t, SHOW), 0);
  assert.match(t.said[0].text, /I can see 6 tablets/);
});

test('a different strip gets its own one request', async () => {
  const t = setup({ readings: [reading(), reading({ name: 'Crocin' })], counts: [CANT] });
  await t.hear('How many are left?');
  await t.hear('How many are left?');
  assert.equal(times(t, SHOW), 2, 'the second question read a different strip');
  await t.hear('How many are left?');
  assert.equal(times(t, SHOW), 2);
});

test('"start over" forgets that the strip was asked about', async () => {
  const t = setup({ readings: [reading()], counts: [CANT] });
  await t.hear('How many are left?');
  await t.hear('start over');
  await t.hear('How many are left?');
  assert.equal(times(t, SHOW), 2);
});

// ---------- more than one strip ----------
test('More than one strip in view: asks once to see just one, and states no number', async () => {
  const t = setup({ readings: [reading()], counts: [TWO_STRIPS] });
  await t.hear('How many are left?');
  assert.equal(times(t, /^I can see more than one strip\. Please show me just one\.$/), 1);
  assert.equal(times(t, SHOW), 0);
  assert.match(t.said.at(-1).text, /^I can still see more than one strip, so I can't count them\. Please ask someone to count them\.$/);
  assert.equal(times(t, /\d+ tablets|should be left/), 0);
  assert.equal(t.view().screen, '1');
});

test('just one strip after the request: counted', async () => {
  const t = setup({ readings: [reading()], counts: [TWO_STRIPS, { count: 7, empty: null, strips: 1 }] });
  await t.hear('How many are left?');
  assert.equal(times(t, /Please show me just one/), 1);
  assert.equal(times(t, /I can see 7 tablets/), 1);
});

test('more than one strip comes before reading the printed side: the strip is counted again, not read again', async () => {
  const both = { count: null, empty: 3, strips: 2 }; // used pockets seen as well, and no printed total known
  const t = setup({ readings: [reading({ packCount: null })], counts: [both, { count: 5, empty: null, strips: 1 }] });
  await t.hear('How many are left?');
  assert.equal(times(t, /Please show me just one/), 1);
  assert.equal(times(t, /printed side/), 0);
  assert.equal(t.countCalls(), 2);
  assert.equal(times(t, /I can see 5 tablets/), 1);
});

// ---------- the request screen ----------
test('Request screen: a count request names what is asked for and carries no attempt number', async () => {
  const cases = [[CANT, 'show_strip'], [TWO_STRIPS, 'one_strip'], [{ count: null, empty: 3 }, 'show_print']];
  for (const [result, cue] of cases) {
    const t = setup({ readings: [reading({ packCount: null })], counts: [result] });
    await t.hear('How many are left?');
    const request = t.views.find((v) => v.cue === cue);
    assert.ok(request, `${cue}: ${t.views.map((v) => v.cue).join()}`);
    assert.equal(request.attempt, 0, `${cue}: no attempt counter`);
    assert.ok(countRequestTitle(request, strings.en));
  }
});

test('Request screen: each count request has its own heading in every language, other cues have none', () => {
  assert.equal(countRequestTitle({ cue: 'show_strip' }, strings.en), 'Show me the entire strip');
  assert.equal(countRequestTitle({ cue: 'one_strip' }, strings.en), 'Show me just one strip');
  assert.equal(countRequestTitle({ cue: 'show_print' }, strings.en), 'Show me the printed side');
  for (const cue of ['hold_still', 'left', 'turn_over', null]) assert.equal(countRequestTitle({ cue }, strings.en), null, String(cue));
  for (const lang of ['hi', 'te', 'kn']) {
    const titles = ['show_strip', 'one_strip', 'show_print'].map((cue) => countRequestTitle({ cue }, strings[lang]));
    assert.ok(titles.every(Boolean) && new Set(titles).size === 3, `${lang}: ${titles}`);
  }
});
