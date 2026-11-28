import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, reading, noExpiry } from './helpers.js';
import { renderSegments } from '../js/core/templates.js';
import { checkView } from '../js/core/contract.js';

const on = { enabled: true, keyConfigured: true, online: true };

test('surroundings: offline line when cloud is off, and nothing is sent', async () => {
  const t = setup();
  await t.hear("What's around me?");
  assert.equal(t.said[0].text, "I can't describe surroundings offline.");
  assert.equal(t.cloudCalls.length, 0);
});

test('surroundings: describe, then a follow-up with history and a fresh frame', async () => {
  const t = setup({ cloudState: on, cloud: (r) => ({ text: r.history.length ? 'The door is on your left.' : 'A kitchen.' }) });
  await t.hear("What's around me?");
  await t.hear('Where is the door?');
  assert.equal(t.said[1].text, 'The door is on your left.');
  assert.deepEqual(t.cloudCalls.map((c) => c.task), ['scene', 'scene']);
  assert.equal(t.cloudCalls[1].history.length, 1);
});

test('cloud never gets medicine or dosage questions, and medicine advice from it is blocked', async () => {
  const t = setup({ cloudState: on, cloud: () => ({ text: 'You can take two tablets of 500 mg.' }), readings: [reading()] });
  await t.hear('How many should I take?');
  await t.hear('yes');
  await t.hear('Is this safe for me?');
  assert.equal(t.cloudCalls.length, 0);
  t.clear();
  await t.hear('Tell me about the Taj Mahal');
  assert.doesNotMatch(t.text(), /500 mg/);
  assert.match(t.said[0].text, /can't answer that/);
});

test('enabling cloud without a key says so and stays off', async () => {
  const t = setup({ cloudState: { enabled: false, keyConfigured: false, online: true } });
  assert.equal(await t.assistant.allowCloud(), false);
  assert.match(t.said[0].text, /Cloud key is not set/);
});

test('session memory replays the same question about the same strip only', async () => {
  const t = setup();
  await t.hear('What is this tablet?');
  await t.hear('What is this tablet?');
  assert.equal(t.said[1].text, t.said[0].text);
  assert.equal(t.assistant.memorySize(), 1);
  const other = setup({ readings: [reading(), reading({ name: 'Cetzine 10', ingredient: 'cetirizine' })] });
  await other.hear('What is this tablet?');
  await other.hear('What is this tablet?');
  assert.match(other.said[1].text, /Cetzine 10, an allergy tablet/);
});

test('finish the task first, then settings; back and start over', async () => {
  const t = setup({ readings: [reading({ dosage: 'Dosage: 1' })] });
  await t.hear('What is the dosage?');
  t.clear();
  await t.hear('open settings');
  assert.equal(t.said[0].text, "Let's finish this first.");
  assert.equal(t.view().screen, '1b');
  await t.hear('start over');
  assert.equal(t.view().screen, '1');
  await t.hear('open settings');
  assert.equal(t.view().screen, '6');
  await t.hear('back');
  assert.equal(t.view().screen, '1');
});

test('naming a language changes screen text and voice language', async () => {
  const t = setup();
  await t.hear('speak in Kannada');
  assert.equal(t.said[0].lang, 'kn');
  assert.equal(t.view().lang, 'kn');
  await t.hear('What is this tablet?');
  assert.equal(t.said[1].lang, 'kn');
  assert.match(t.said[1].text, /\p{Script=Kannada}/u);
});

test('food label: nutrition rows are read as printed', async () => {
  const t = setup({ readings: [noExpiry({ name: 'Oat Biscuits', ingredient: null, nutrition: ['Protein 8 g', 'Energy 450 kcal'] })] });
  await t.hear('How much protein is in this?');
  assert.match(t.said[0].text, /Protein 8 g.*Energy 450 kcal/);
});

test('partly readable: states what is readable and what is not', async () => {
  const t = setup({ readings: [reading({ name: null })] });
  await t.hear('When does it expire?');
  assert.match(t.said.map((s) => s.text).join(' '), /can't read/);
});

test('every template exists in all four languages', async () => {
  const { TEMPLATES } = await import('../js/core/templates.js');
  const en = Object.keys(TEMPLATES.en);
  for (const lang of ['hi', 'te', 'kn']) assert.deepEqual(Object.keys(TEMPLATES[lang]).sort(), [...en].sort(), lang);
  for (const lang of ['en', 'hi', 'te', 'kn']) {
    for (const id of en) {
      const text = renderSegments([{ id, slots: { name: 'X', text: 'Y', n: 2, month: 3, year: 2027, purposeKey: 'fever', direction: 'left' } }], lang);
      assert.doesNotMatch(text, /\{\w+\}|undefined/, `${lang} ${id}`);
    }
  }
});

test('every view sent to the screen matches the UI contract', async () => {
  const t = setup({ readings: [noExpiry()] });
  await t.hear('What is this tablet?');
  await t.hear('start over');
  await t.hear('blah');
  assert.ok(t.views.length > 4);
  for (const view of t.views) assert.deepEqual(checkView(view), [], JSON.stringify(view));
});

test('a spoken year is not mistaken for another medicine', async () => {
  const t = setup();
  await t.hear('Does it expire in December 2027?');
  assert.match(t.said[0].text, /February 2027/);
});

test('after the last attempt the task is over, so settings opens', async () => {
  const t = setup({ readings: [noExpiry()] });
  await t.hear('What is this tablet?');
  assert.ok(t.views.some((v) => v.final));
  assert.equal(t.view().screen, '1', 'back to the landing screen after the final message');
  await t.hear('open settings');
  assert.equal(t.view().screen, '6');
});

test('an older risk question is not added to an emergency, and it is not lost', async () => {
  const t = setup({ readings: [reading({ dosage: 'Dosage: 1' })] });
  await t.hear('What is the dosage?');
  t.clear();
  await t.hear('I cannot breathe properly');
  assert.doesNotMatch(t.text(), /Do you understand the risk/);
  t.clear();
  await t.hear('no');
  assert.match(t.text(), /The label says: Dosage: 1/);
});
