import test from 'node:test';
import assert from 'node:assert/strict';
import { route, parseCommand, namedLanguage, isConfirm, likelyAspect } from '../js/core/intent.js';
import { detectLanguage, nextLanguage } from '../js/core/language.js';

const is = (text, name, aspect) => {
  const i = route(text);
  assert.equal(`${i.name}/${i.aspect ?? ''}`, `${name}/${aspect ?? ''}`, text);
};

test('identify in four languages and mixed speech', () => {
  for (const t of ['What is this tablet?', 'yeh kaunsi tablet hai', 'यह कौन सी गोली है', 'ఇది ఏ మాత్ర', 'ಇದು ಯಾವ ಮಾತ್ರೆ', 'idi emi tablet', 'idu yaava tablet', 'यह tablet क्या है']) is(t, 'identify', 'all');
});

test('expiry, count, dose and nutrition are separate', () => {
  is('When does it expire?', 'identify', 'expiry');
  is('इसकी expiry date क्या है', 'identify', 'expiry');
  is('How many are left in this strip?', 'identify', 'count');
  is('कितनी गोलियां बची हैं', 'identify', 'count');
  is('How many should I take?', 'dose', null);
  is('What is the dosage?', 'dose', null);
  is('कितनी गोली लेनी है', 'dose', null);
  is('How much protein is in this?', 'identify', 'nutrition');
});

test('safety aspects, most urgent first', () => {
  is('I took this tablet and I cannot breathe properly', 'safety', 'emergency');
  is('I feel like I am going to faint', 'safety', 'emergency');
  is('I took this tablet and now I feel dizzy', 'safety', 'unwell');
  is('I took one, can I take another one?', 'safety', 'took_more');
  is('Maine ek le li, kya ek aur le sakti hoon?', 'safety', 'took_more');
  is('I just took one', 'safety', 'took');
  is('Which medicine should I take?', 'safety', 'which_take');
  is('Is this safe for me?', 'safety', 'warnings');
});

test('scene and general only for non-medicine questions', () => {
  is("What's around me?", 'scene', null);
  is('Where is the door?', 'scene', null);
  is('Tell me about the Taj Mahal', 'general', null);
  assert.notEqual(route('Tell me about this medicine').name, 'general');
  assert.notEqual(route('Tell me about paracetamol dosage').name, 'general');
});

test('no rule matches gives unknown', () => {
  is('blah mumble', 'unknown', null);
  is('', 'unknown', null);
});

test('global commands in each language', () => {
  for (const t of ['back', 'पीछे', 'వెనుకకు', 'ಹಿಂದೆ', 'Go back.']) assert.equal(parseCommand(t), 'back', t);
  assert.equal(parseCommand('start over'), 'start_over');
  assert.equal(parseCommand("I'll come back"), 'later');
  assert.equal(parseCommand('later'), 'later');
  assert.equal(parseCommand('continue'), 'continue');
  assert.equal(parseCommand('open settings'), 'open_settings');
  assert.equal(parseCommand('next'), 'next');
  assert.equal(parseCommand('show camera'), 'show_camera');
  assert.equal(parseCommand('back to answer'), 'back_to_answer');
  assert.equal(parseCommand('take photo'), 'take_photo');
  assert.equal(parseCommand('what is this tablet'), null);
});

test('confirm words must be clear', () => {
  for (const t of ['Yes', 'Haan', 'Howdu', 'Avunu', 'Aama', 'हाँ', 'అవును', 'ಹೌದು', 'yes I do']) assert.ok(isConfirm(t), t);
  for (const t of ['no', 'haan nahi', 'yes but what is the dose', '', 'हाँ नहीं']) assert.ok(!isConfirm(t), t);
});

test('language: named, detected, mixed and uncertain', () => {
  assert.equal(namedLanguage('Hindi'), 'hi');
  assert.equal(namedLanguage('speak in Kannada please'), 'kn');
  assert.equal(namedLanguage('తెలుగు'), 'te');
  assert.equal(namedLanguage('what is this tablet'), null);
  assert.deepEqual(detectLanguage('यह tablet क्या है', 'en-IN', 0.4), { lang: 'hi', confident: true });
  assert.deepEqual(detectLanguage('what is this', 'te-IN', 0.3), { lang: 'te', confident: false });
  assert.equal(nextLanguage('en', { lang: 'te', confident: false }, null), 'en');
  assert.equal(nextLanguage('en', { lang: 'te', confident: true }, null), 'te');
  assert.equal(nextLanguage('en', { lang: 'te', confident: false }, 'kn'), 'kn');
});

test('likely request from a half-heard sentence', () => {
  assert.equal(likelyAspect('umm expi something'), 'expiry');
  assert.equal(likelyAspect('zzz'), null);
});
