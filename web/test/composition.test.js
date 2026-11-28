// Composition, generic (chemical) name, maker and a plain description. Varied local data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFields, mergeReading } from '../js/core/label.js';
import { route } from '../js/core/intent.js';
import { setup, reading, expired } from './helpers.js';

let y = 0;
const line = (text, size = 30) => ({ text, score: 0.95, size, box: { x: 100, y: (y += 60), w: text.length * 15, h: size } });
const fields = (...texts) => { y = 0; return extractFields(texts.map((t, i) => line(t, i === 0 ? 64 : 30))); };

test('Composition printed on one line', () => {
  const f = fields('DOLO 650', 'Composition: Each tablet contains Paracetamol IP 650 mg', 'EXP 12/2027');
  assert.equal(f.composition, 'Paracetamol IP 650 mg');
  assert.equal(f.name, 'DOLO 650', 'the composition line is never the name');
});

test('Composition under a heading, over several lines, stopping before other print', () => {
  const f = fields('AUGMENTIN 625 DUO', 'Each film coated tablet contains:', 'Amoxycillin Trihydrate IP eq. to Amoxycillin 500 mg',
    'Potassium Clavulanate Diluted IP eq. to Clavulanic Acid 125 mg', 'Batch No. B12345', 'EXP 03/2027');
  assert.equal(f.composition, 'Amoxycillin Trihydrate IP eq. to Amoxycillin 500 mg, Potassium Clavulanate Diluted IP eq. to Clavulanic Acid 125 mg');
});

test('the composition stops at the first other line, so a later dosage line never joins it', () => {
  const f = fields('DOLO 650', 'Each tablet contains:', 'Paracetamol IP 650 mg', 'Colour: Titanium Dioxide IP', 'Dosage: 500 mg twice daily');
  assert.equal(f.composition, 'Paracetamol IP 650 mg');
});

test('"Each capsule contains" with the ingredient on the same line', () => {
  const f = fields('OMEZ 20', 'Each capsule contains Omeprazole IP 20 mg (as enteric coated pellets)');
  assert.equal(f.composition, 'Omeprazole IP 20 mg (as enteric coated pellets)');
});

test('Chemical name: the generic line, and the maker without "Manufactured by"', () => {
  const f = fields('CROCIN ADVANCE', 'Paracetamol Tablets IP 500 mg', 'Manufactured by: GSK Pharmaceuticals Ltd, Nashik', 'EXP 01/2028');
  assert.equal(f.generic, 'Paracetamol Tablets IP 500 mg');
  assert.equal(f.composition, null);
  assert.equal(f.maker, 'GSK Pharmaceuticals Ltd, Nashik');
});

test('nothing that is not a composition, generic name or maker is taken for one', () => {
  const f = fields('ZZYXIN 10', 'EXP 12/2027', 'Batch B2345', 'Store below 25C');
  assert.deepEqual([f.composition, f.generic, f.maker], [null, null, null]);
});

test('composition and maker from the back of the strip join the front', () => {
  const front = reading({ composition: null, generic: 'Paracetamol Tablets IP 650 mg' });
  const back = reading({ name: null, composition: 'Paracetamol IP 650 mg', maker: 'Micro Labs Ltd' });
  const merged = mergeReading(front, back);
  assert.deepEqual([merged.generic, merged.composition, merged.maker], ['Paracetamol Tablets IP 650 mg', 'Paracetamol IP 650 mg', 'Micro Labs Ltd']);
});

test('composition and description questions in four languages', () => {
  const composition = ['What does it contain?', 'What is the chemical name?', 'What is this tablet made of?', 'What is the composition?',
    'What is the salt of this tablet?', 'इसमें क्या है', 'దీనిలో ఏముంది', 'ಇದರಲ್ಲಿ ಏನಿದೆ'];
  for (const text of composition) assert.deepEqual(route(text), { name: 'identify', aspect: 'composition' }, text);
  for (const text of ['Tell me about this medicine', 'Describe this tablet', 'इसके बारे में बताओ', 'దీని గురించి చెప్పు', 'ಇದರ ಬಗ್ಗೆ ಹೇಳಿ']) {
    assert.deepEqual(route(text), { name: 'identify', aspect: 'describe' }, text);
  }
  assert.deepEqual(route('Tell me about Delhi'), { name: 'general', aspect: null }, 'general questions still go to general');
});

test('Composition printed: answered from memory', async () => {
  const t = setup({ readings: [reading({ composition: 'Paracetamol IP 650 mg' })] });
  await t.hear('What is this tablet?');
  const reads = t.captures();
  t.clear();
  await t.hear('What does it contain?');
  assert.equal(t.captures(), reads);
  assert.equal(t.said[0].text, 'It contains Paracetamol IP 650 mg.');
});

test('Chemical name: the generic name when no composition is printed, then the ingredient', async () => {
  const generic = setup({ readings: [reading({ generic: 'Paracetamol Tablets IP 650 mg' })] });
  await generic.hear('What is the chemical name?');
  assert.equal(generic.said[0].text, 'Its generic name is Paracetamol Tablets IP 650 mg.');
  const ingredient = setup({ readings: [reading()] });
  await ingredient.hear('What is the chemical name?');
  assert.equal(ingredient.said[0].text, 'Its active ingredient is paracetamol.');
});

test('Composition not readable', async () => {
  const t = setup({ readings: [reading({ ingredient: null })] });
  await t.hear('What does it contain?');
  assert.equal(t.said[0].text, "I can't read what it contains.");
});

test('Tell me about it: a few plain sentences, each only when read', async () => {
  const t = setup({ readings: [reading({ generic: 'Paracetamol Tablets IP 650 mg', composition: 'Paracetamol IP 650 mg', maker: 'Micro Labs Ltd', packCount: 15 })] });
  await t.hear('Tell me about this medicine');
  assert.equal(t.said[0].text, 'This is Dolo 650, a fever tablet. It is Paracetamol Tablets IP 650 mg. It contains Paracetamol IP 650 mg. '
    + 'It is made by Micro Labs Ltd. Expires in 3 months. The pack prints 15 tablets. Please confirm with a doctor or pharmacist before taking it.');
  const plain = setup({ readings: [reading({ ingredient: null })] });
  await plain.hear('Tell me about this medicine');
  assert.equal(plain.said[0].text, 'This is Dolo 650. Expires in 3 months.');
});

test('Expired description: the warning comes first', async () => {
  const t = setup({ readings: [expired({ composition: 'Paracetamol IP 650 mg' })] });
  await t.hear('Tell me about this medicine');
  assert.match(t.said[0].text, /^Warning: this has expired\. Please do not take it\./);
});
