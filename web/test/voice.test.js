// Language naming and pinning, using transcripts copied from real Sarvam realtime output on 2026-11-28.
import test from 'node:test';
import assert from 'node:assert/strict';
import { route, namedLanguage } from '../js/core/intent.js';
import { setup } from './helpers.js';

test('naming a language as Sarvam actually writes it, in auto and pinned modes', () => {
  const said = {
    'Telugu-lo matladu.': 'te', 'Kannadadalli maatanaadi.': 'kn', 'Speak in Telugu.': 'te', 'Kannada.': 'kn',
    'తెలుగులో మాట్లాడు': 'te', 'ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ': 'kn', 'English-లో మాట్లాడు.': 'en', 'English-ನಲ್ಲಿ ಮಾತನಾಡಿ.': 'en',
    'హిందీ.': 'hi', 'इंग्लिश में बोलो': 'en',
  };
  for (const [text, lang] of Object.entries(said)) {
    assert.equal(namedLanguage(text), lang, text);
    assert.equal(route(text).name, 'language', text);
  }
  assert.equal(namedLanguage('is there a telugu label on this strip of tablets'), null);
});

test('dosage questions with a singular tablet word', () => {
  for (const text of ['ಎಷ್ಟು ಮಾತ್ರೆ ತೆಗೆದುಕೊಳ್ಳಬೇಕು?', 'ఎన్ని మాత్ర వేసుకోవాలి?', 'ఎన్ని మాత్రలు వేసుకోవాలి?']) {
    assert.deepEqual(route(text), { name: 'dose', aspect: null }, text);
  }
});

test('a named language is pinned: recognition follows and detection stops switching', async () => {
  const t = setup();
  await t.hear('Telugu.');
  assert.deepEqual(t.speechLanguages, ['te']);
  assert.equal(t.view().lang, 'te');
  await t.hear('यह कौन सी गोली है', { sttLang: 'hi-IN', probability: 0.99 });
  assert.equal(t.said.at(-1).lang, 'te', 'no automatic switch while pinned');
  await t.hear('హిందీ.');
  assert.deepEqual(t.speechLanguages, ['te', 'hi']);
  assert.equal(t.view().lang, 'hi');
});

// The server turns romanised speech into its own script and names the base language (probability 1).
const BASE = (lang) => ({ sttLang: lang, probability: 1 });

test('Confident detection: the session switches and recognition follows the language found', async () => {
  const t = setup();
  await t.hear('यह कौन सी गोली है', { sttLang: 'hi-IN', probability: 0.99 });
  assert.equal(t.view().lang, 'hi');
  assert.deepEqual(t.speechLanguages, ['hi']);
});

test('First Telugu question from the landing screen: reading screen, reply and recognition in Telugu', async () => {
  const t = setup();
  assert.equal(t.view()?.screen ?? '1', '1');
  await t.hear('ఈ మాత్రం ఏంటి?', BASE('te-IN'));
  assert.ok(t.views.some((v) => v.screen === 'reading' && v.lang === 'te'), 'the reading screen is already in Telugu');
  assert.equal(t.said[0].lang, 'te');
  assert.deepEqual(t.speechLanguages, ['te']);
});

test('Telugu mixed with English: switched, and understood as an expiry question', async () => {
  const t = setup();
  await t.hear('ఈ ట్యాబ్లెట్ ఎక్స్పైరీ ఎప్పుడు?', BASE('te-IN'));
  assert.equal(t.said[0].lang, 'te');
  assert.match(t.said[0].text, /^గడువు/);
});

test('Hindi mixed with English: switched, and understood as an expiry question', async () => {
  const t = setup();
  await t.hear('इस टैबलेट की एक्सपायरी कब है', BASE('hi-IN'));
  assert.equal(t.said[0].lang, 'hi');
  assert.match(t.said[0].text, /^एक्सपायरी/);
});

test('Identification unavailable: romanised speech labelled English keeps the current language', async () => {
  const t = setup();
  await t.hear('Ee maatra enti?', { sttLang: 'en-IN', probability: 0 });
  assert.equal(t.view().lang, 'en');
  assert.deepEqual(t.speechLanguages, []);
});

test('Telugu, Hindi and Kannada count questions as written after transliteration', () => {
  for (const text of ['ఇది ఎన్ని టాబ్లెట్స్ ఉన్నాయి', 'कितने tablets बचे हैं', 'ಎಷ್ಟು ಮಾತ್ರೆಗಳು ಉಳಿದಿವೆ']) {
    assert.deepEqual(route(text), { name: 'identify', aspect: 'count' }, text);
  }
});

test('a single word with an added ending still names the language', () => {
  assert.equal(namedLanguage('Kannadaka.'), 'kn'); // real auto-mode transcript of "ಕನ್ನಡ"
  assert.equal(namedLanguage('Telugulu'), 'te');
  assert.equal(namedLanguage('Hindustan Times'), null);
  assert.equal(namedLanguage('engine'), null);
});
