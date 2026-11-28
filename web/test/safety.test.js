import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, reading, expired, noExpiry } from './helpers.js';

const RISK = 'Do you understand the risk?';
const WARNING = 'Warning: this has expired. Please do not take it.';
const printed = (over) => reading({ dosage: 'Dosage: As directed by the physician', ...over });

test('identify: danger-first answer with purpose, expiry and the confirm-with-doctor line', async () => {
  const t = setup();
  await t.hear('What is this tablet?');
  assert.match(t.said[0].text, /^Dolo 650, a fever tablet\. Expires in 3 months\./);
  assert.match(t.said[0].text, /confirm with a doctor or pharmacist before taking it/);
  assert.equal(t.view().screen, '3');
  assert.equal(t.view().asked, 'What is this tablet?');
  assert.equal(t.view().tiles.name, 'Dolo 650');
  assert.equal(t.view().tiles.expiry, 'In 3 months');
  assert.equal(t.view().tiles.expiryPrinted, 'February 2027');
  assert.equal(t.view().tiles.count, null);
  assert.equal(t.view().risk, false);
});

test('no purpose when the ingredient is not in the table', async () => {
  const t = setup({ readings: [reading({ ingredient: null, name: 'Zzyxin 10' })] });
  await t.hear('What is this tablet?');
  assert.match(t.said[0].text, /^Zzyxin 10\./);
  assert.doesNotMatch(t.text(), /tablet\.|confirm with a doctor/);
});

test('expired: warning first, no dosage, risk question, repeat once', async () => {
  const t = setup({ readings: [expired({ dosage: 'Dosage: 1 tablet' })] });
  await t.hear('What is the dosage?');
  assert.ok(t.said[0].text.startsWith(WARNING), t.said[0].text);
  assert.doesNotMatch(t.said[0].text, /1 tablet/);
  assert.equal(t.said[1].text, RISK);
  assert.equal(t.view().screen, '4');
  assert.equal(t.view().tone, 'warn');
  assert.equal(t.view().risk, true);
  t.clear();
  await t.hear('hmm');
  assert.equal(t.said.length, 1);
  assert.ok(t.said[0].text.startsWith(WARNING));
  t.clear();
  await t.fireTimers();
  assert.equal(t.said.length, 0, 'repeats exactly once');
});

test('risk: a clear yes means no repeat and the task ends', async () => {
  for (const yes of ['Yes', 'Haan', 'Howdu', 'Avunu', 'Aama']) {
    const t = setup({ readings: [printed()] });
    await t.hear('What is the dosage?');
    assert.equal(t.said.at(-1).text, RISK);
    t.clear();
    await t.hear(yes);
    assert.doesNotMatch(t.text(), /As directed/, yes);
    assert.equal(t.view().screen, '1', yes);
  }
});

test('risk: silence repeats the answer once', async () => {
  const t = setup({ readings: [printed()] });
  await t.hear('What is the dosage?');
  t.clear();
  await t.fireTimers();
  assert.equal(t.said.length, 1);
  assert.match(t.said[0].text, /The label says: Dosage: As directed by the physician/);
});

test('risk: a new question is answered, then the check comes back', async () => {
  const t = setup({ readings: [printed()] });
  await t.hear('What is the dosage?');
  t.clear();
  await t.hear("What's around me?");
  assert.equal(t.said[0].text, "I can't describe surroundings offline.");
  assert.match(t.said.at(-1).text, /Do you understand the risk\?/);
  t.clear();
  await t.hear('no');
  assert.match(t.said[0].text, /As directed by the physician/);
});

test('dosage is only what is printed, and never without a readable expiry', async () => {
  const none = setup();
  await none.hear('How many should I take?');
  assert.match(none.said[0].text, /can't read any dosage/);
  const unclear = setup({ readings: [noExpiry({ dosage: 'Dosage: 2 tablets' })] });
  await unclear.hear('How many should I take?');
  assert.doesNotMatch(unclear.text(), /2 tablets/);
  const ok = setup({ readings: [printed()] });
  await ok.hear('How many should I take?');
  assert.equal(ok.said[0].text, 'The label says: Dosage: As directed by the physician.');
});

test('no medicine recommendation', async () => {
  const t = setup();
  await t.hear('Which medicine should I take?');
  assert.match(t.said[0].text, /can't recommend a medicine.*doctor or pharmacist/);
});

test('taking more: count only when accepted, never a yes or no', async () => {
  const withCount = setup({ counts: [{ count: 4 }] });
  await withCount.hear('I took one, can I take another one?');
  assert.match(withCount.said[0].text, /You said you have taken one\. I can see 4 tablets\. I can't advise how many to take\. Please consult a doctor\./);
  const without = setup();
  await without.hear('Maine ek le li, kya ek aur le sakti hoon?');
  assert.match(without.said[0].text, /can't tell how many are left/);
  assert.match(without.said[0].text, /consult a doctor/);
  assert.doesNotMatch(without.text(), /\d tablets/);
});

test('expired medicine already taken', async () => {
  const t = setup({ readings: [expired()] });
  await t.hear('I just took one');
  assert.ok(t.said[0].text.startsWith(`${WARNING} Please consult a doctor right away.`), t.said[0].text);
  assert.equal(t.said[1].text, RISK);
});

test('feeling unwell: help then doctor first, with the expired warning after it', async () => {
  const t = setup();
  await t.hear('I took this tablet and now I feel dizzy');
  assert.ok(t.said[0].text.startsWith('Please get help from someone nearby, and then contact a doctor.'), t.said[0].text);
  const old = setup({ readings: [expired()] });
  await old.hear('I took this tablet and now I feel dizzy');
  assert.ok(old.said[0].text.startsWith('Please get help from someone nearby'), old.said[0].text);
  assert.match(old.text(), /Warning: this has expired/, 'the warning follows');
});

test('serious symptoms: 108 first, before the camera is used, and the dialer opens', async () => {
  const t = setup({ readings: [expired()] });
  await t.hear('I cannot breathe properly');
  assert.ok(t.said[0].text.startsWith('If someone is with you, ask them to help you call 108 now.'), t.said[0].text);
  assert.equal(t.said[0].at, 0, 'nothing delays the instruction');
  assert.deepEqual(t.dialled, ['108']);
  assert.equal(t.view().dial, '108');
  assert.doesNotMatch(t.text(), /I have called|call has been made/i);
  assert.match(t.text(), /Warning: this has expired/, 'the expired warning follows');
  const desk = setup({ dial: false });
  await desk.hear('I feel like I am going to faint');
  assert.match(desk.text(), /Dial 108 from a phone.*1 0 8/);
});

test('expiry-soon notices', async () => {
  const day = { year: 2027, month: 3, day: 10 };
  const run = async (expiry) => {
    const t = setup({ today: day, readings: [reading({ expiry })] });
    await t.hear('What is this tablet?');
    return t.said[0].text;
  };
  assert.ok((await run({ year: 2027, month: 3, day: 15 })).startsWith('This medicine expires within 7 days.'));
  const month = await run({ year: 2027, month: 3, day: 30 });
  assert.ok(month.startsWith('This medicine expires within one month.'));
  assert.doesNotMatch(month, /7 days/);
  assert.doesNotMatch(await run({ year: 2027, month: 9, day: null }), /expires within/);
  const old = await run({ year: 2027, month: 2, day: null });
  assert.ok(old.startsWith(WARNING));
  assert.doesNotMatch(old, /expires within/);
});

test('safety questions never say safe', async () => {
  const none = setup();
  await none.hear('Is this safe for me?');
  assert.match(none.said[0].text, /can't tell.*doctor or pharmacist/);
  const warned = setup({ readings: [reading({ warnings: ['Warning: may cause drowsiness'] })] });
  await warned.hear('Is this safe for me?');
  assert.match(warned.said[0].text, /The label says: Warning: may cause drowsiness/);
});

test('replies in the session language', async () => {
  const t = setup({ readings: [expired()] });
  await t.hear('यह कौन सी गोली है', { sttLang: 'hi-IN', probability: 0.9 });
  assert.equal(t.said[0].lang, 'hi');
  assert.match(t.said[0].text, /^चेतावनी/);
});

test('after unclear speech, an emergency still starts with the 108 instruction', async () => {
  const t = setup();
  await t.hear('blah mumble');
  t.clear();
  await t.hear('I cannot breathe properly');
  assert.ok(t.said[0].text.startsWith('If someone is with you'), t.said[0].text);
});

test('a yes said while the risk question is still loading does not confirm', async () => {
  const t = setup({ readings: [reading({ dosage: 'Dosage: 1' })] });
  t.keepLoading(/Do you understand the risk/);
  const first = t.hear('What is the dosage?');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(t.view().risk, false, 'the question is not on screen before it starts');
  t.keepLoading(null);
  t.clear();
  await t.hear('yes');
  await first;
  assert.deepEqual(t.said.map((s) => s.text), ['Do you understand the risk?'], 'it asks instead of confirming');
  assert.equal(t.view().risk, true);
  await t.hear('yes');
  assert.equal(t.view().screen, '1');
});
