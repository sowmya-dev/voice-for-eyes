// Replies sound like a person: full sentences, progress while reading, and one friendly offer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, reading, expired } from './helpers.js';

const OFFER_WHAT = 'Do you want to know what this medicine is?';
const OFFER_COUNT = 'Do you want to know how many tablets are left?';

test('Identified as a sentence', async () => {
  const t = setup();
  await t.hear('What is this tablet?');
  assert.match(t.said[0].text, /^This is Dolo 650/);
});

test('Offer what is left: asked about the expiry, offered what the medicine is', async () => {
  const t = setup();
  await t.hear('When does it expire?');
  assert.equal(t.said.at(-1).text, OFFER_WHAT);
});

test('Offer accepted: answered from the remembered label, with no new read', async () => {
  const t = setup();
  await t.hear('When does it expire?');
  const reads = t.captures();
  t.clear();
  await t.hear('yes');
  assert.equal(t.captures(), reads);
  assert.match(t.said[0].text, /^This is Dolo 650/);
  assert.doesNotMatch(t.text(), /You said/);
});

test('Offer declined: a short, polite reply', async () => {
  const t = setup();
  await t.hear('When does it expire?');
  t.clear();
  await t.hear('no thanks');
  assert.equal(t.said[0].text, 'Okay. Ask me anything else when you are ready.');
});

test('After identification the count is offered when counting is available', async () => {
  const t = setup({ counts: [{ count: 4 }] });
  await t.hear('What is this tablet?');
  assert.equal(t.said.at(-1).text, OFFER_COUNT);
});

test('Nothing left to offer: name and expiry told, and no counting', async () => {
  const t = setup();
  await t.hear('What is this tablet?');
  assert.ok(!t.said.some((s) => /^Do you want to know/.test(s.text)), t.text());
});

test('No offer after a warning', async () => {
  const t = setup({ readings: [expired()] });
  await t.hear('What is this tablet?');
  assert.ok(!t.said.some((s) => s.text === OFFER_COUNT || s.text === OFFER_WHAT), t.text());
});

test('Still reading: said once while the expiry is still being read', async () => {
  const cut = reading({ expiry: null, lines: [{ text: 'Dolo 650', score: 0.9, box: { x: 2, y: 300, w: 600, h: 60 } }] });
  const t = setup({ readings: [cut, cut, reading({ name: null })] });
  await t.hear('What is this tablet?');
  assert.equal(t.said[0].text, "I can see Dolo 650. Hold it there, I'm still reading the rest.");
  assert.equal(t.said.filter((s) => /still reading/.test(s.text)).length, 1);
  assert.match(t.said[1].text, /^This is Dolo 650/);
});
