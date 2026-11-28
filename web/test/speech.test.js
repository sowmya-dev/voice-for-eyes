// What is sent to the voice. The screen always keeps the label text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { forSpeech } from '../js/core/speech.js';

test('a name printed in capitals is spoken as a word, with the same strength', () => {
  assert.equal(forSpeech('DOLO-650, a fever tablet.', 'en'), 'Dolo 650, a fever tablet.');
  assert.equal(forSpeech('I can read: CROCIN 500.', 'hi'), 'I can read: Crocin 500.');
  assert.equal(forSpeech('PANTOP-40, జ్వరం మాత్ర.', 'te'), 'Pantop 40, జ్వరం మాత్ర.');
});

test('short markers, dates and every digit are left alone', () => {
  const text = 'EXP 12/2027. MRP 30. IP 650 mg. Call 108.';
  assert.equal(forSpeech(text, 'en'), text);
  for (const lang of ['en', 'hi', 'te', 'kn']) {
    const spoken = forSpeech('AMOXIL-250 then 1 tablet, December 2027', lang);
    assert.equal(spoken.replace(/\D/g, ''), '25012027', lang);
  }
});

test('in Kannada a strength is spoken one digit at a time, but years and the emergency number are not changed', () => {
  assert.equal(forSpeech('DOLO-650, ಜ್ವರದ ಮಾತ್ರೆ.', 'kn'), 'Dolo 6 5 0, ಜ್ವರದ ಮಾತ್ರೆ.');
  assert.equal(forSpeech('Crocin 500 mg', 'kn'), 'Crocin 5 0 0 mg');
  assert.equal(forSpeech('Pantop 40', 'kn'), 'Pantop 40');
  assert.equal(forSpeech('December 2027', 'kn'), 'December 2027');
  assert.equal(forSpeech('ಈಗಲೇ 108ಕ್ಕೆ ಕರೆ ಮಾಡಿ.', 'kn'), 'ಈಗಲೇ 108ಕ್ಕೆ ಕರೆ ಮಾಡಿ.');
});
