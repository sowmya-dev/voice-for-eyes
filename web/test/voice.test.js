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

test('before a language is named, detection still switches and recognition stays automatic', async () => {
  const t = setup();
  await t.hear('यह कौन सी गोली है', { sttLang: 'hi-IN', probability: 0.99 });
  assert.equal(t.view().lang, 'hi');
  assert.deepEqual(t.speechLanguages, []);
});

test('a single word with an added ending still names the language', () => {
  assert.equal(namedLanguage('Kannadaka.'), 'kn'); // real auto-mode transcript of "ಕನ್ನಡ"
  assert.equal(namedLanguage('Telugulu'), 'te');
  assert.equal(namedLanguage('Hindustan Times'), null);
  assert.equal(namedLanguage('engine'), null);
});
