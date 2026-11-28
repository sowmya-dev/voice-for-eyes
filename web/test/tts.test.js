// The speaker: Sarvam first, then only a browser voice the privacy rule allows, never a silent "spoken".
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTts } from '../js/io/tts.js';

const ON_DEVICE_EN = { name: 'Ravi', lang: 'en-IN', localService: true };
const ONLINE_HI = { name: 'Google Hindi', lang: 'hi-IN', localService: false };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup({ server = true, audio = new ArrayBuffer(8), voices = [ON_DEVICE_EN, ONLINE_HI], cloudHelp = false, synthError = null, canPlay = true, hold = false } = {}) {
  const log = { fetched: [], played: 0, stopped: 0, spoken: [], noVoice: [], warnings: 0 };
  let release;
  let finishPlayback;
  const network = { hang: hold === 'fetch', down: false };
  const buffers = [];
  const synth = {
    getVoices: () => voices,
    addEventListener() {},
    removeEventListener() {},
    resume() {},
    cancel() {},
    speak(u) {
      log.spoken.push(u);
      queueMicrotask(() => {
        if (synthError) return u.onerror?.({ error: synthError });
        u.onstart?.();
        return u.onend?.();
      });
    },
  };
  const player = {
    play: async (data) => {
      if (!canPlay) return null;
      buffers.push(data);
      log.played += 1;
      const done = new Promise((resolve) => { finishPlayback = resolve; });
      if (hold !== true) queueMicrotask(() => finishPlayback());
      return { done, stop: () => { log.stopped += 1; finishPlayback(); } };
    },
    warn: () => { log.warnings += 1; },
    unlock() {},
  };
  const tts = createTts({
    settings: { cloudHelp, speechRate: 1.25 },
    onNoVoice: (lang) => log.noVoice.push(lang),
    serverAvailable: () => server,
    fetchSpeech: async (text, lang, pace) => {
      log.fetched.push({ text, lang, pace });
      if (network.hang) await new Promise((resolve) => { release = resolve; });
      return network.down ? null : audio;
    },
    player,
    synth,
    Utterance: class { constructor(text) { this.text = text; } },
  });
  return { tts, log, network, buffers, release: () => release?.() };
}

test('spoken reply: Sarvam speaks it, at the chosen speed, and the browser voice is not used', async () => {
  const t = setup();
  assert.equal(await t.tts.say('మీకు ప్రమాదం అర్థమైందా?', 'te'), 'end');
  assert.deepEqual(t.log.fetched, [{ text: 'మీకు ప్రమాదం అర్థమైందా?', lang: 'te', pace: 1.25 }]);
  assert.equal(t.log.played, 1);
  assert.equal(t.log.spoken.length, 0);
});

test('Sarvam unavailable: an on-device voice is used, and set explicitly', async () => {
  for (const options of [{ server: false }, { audio: null }, { canPlay: false }]) {
    const t = setup(options);
    assert.equal(await t.tts.say('Hello there.', 'en'), 'end', JSON.stringify(options));
    assert.equal(t.log.spoken[0].voice, ON_DEVICE_EN);
  }
});

test('privacy: with cloud help off, an online browser voice is never used, not even by default', async () => {
  const t = setup({ server: false });
  assert.equal(await t.tts.say('यह एक्सपायर हो चुकी है।', 'hi'), 'unspoken');
  assert.equal(t.log.spoken.length, 0, 'speak() must not be called without a permitted voice');
  assert.deepEqual(t.log.noVoice, ['hi']);
  assert.equal(t.log.warnings, 1);
});

test('with cloud help on, an online browser voice may stand in', async () => {
  const t = setup({ server: false, cloudHelp: true });
  assert.equal(await t.tts.say('नमस्ते।', 'hi'), 'end');
  assert.equal(t.log.spoken[0].voice, ONLINE_HI);
});

test('no voice at all, or a voice that fails, is never reported as spoken', async () => {
  const none = setup({ server: false });
  assert.equal(await none.tts.say('హెచ్చరిక', 'te'), 'unspoken');
  assert.equal(none.log.spoken.length, 0);
  assert.equal(none.log.warnings, 1);
  const broken = setup({ server: false, synthError: 'synthesis-failed' });
  assert.equal(await broken.tts.say('Hello.', 'en'), 'unspoken');
  assert.equal(broken.log.warnings, 1);
});

test('stopped while fetching: nothing is played later', async () => {
  const t = setup({ hold: 'fetch' });
  const result = t.tts.say('A long answer.', 'en');
  await tick();
  t.tts.stop();
  assert.equal(await result, 'cancelled');
  t.release();
  await tick();
  assert.equal(t.log.played, 0);
  assert.equal(t.log.spoken.length, 0);
});

test('stopped while playing: playback is stopped, and only playing audio counts as audible', async () => {
  const t = setup({ hold: true });
  const result = t.tts.say('A long answer.', 'en');
  assert.equal(t.tts.audible(), '', 'nothing is audible while the audio is still being fetched');
  await tick();
  await tick();
  assert.equal(t.tts.audible(), 'A long answer.');
  assert.ok(t.tts.speaking());
  t.tts.stop();
  assert.equal(await result, 'cancelled');
  assert.equal(t.log.stopped, 1);
});

test('emergency: a prepared sentence plays at once while the network voice hangs, and the rest follows', async () => {
  const t = setup();
  await t.tts.prepare('Call 108.', 'en');
  t.network.hang = true;
  const result = t.tts.say('Call 108. I am opening the dialer.', 'en');
  await tick();
  await tick();
  assert.equal(t.log.played, 1, 'the instruction played without waiting');
  assert.equal(t.log.fetched.at(-1).text, 'I am opening the dialer.', 'only the rest is fetched');
  t.network.hang = false;
  t.release();
  assert.equal(await result, 'end');
  assert.equal(t.log.played, 2);
});

test('emergency: the prepared sentence still plays when the voice service is gone, again and again', async () => {
  const t = setup({ voices: [] });
  await t.tts.prepare('Call 108.', 'en');
  t.network.down = true;
  assert.equal(await t.tts.say('Call 108.', 'en'), 'end');
  assert.equal(await t.tts.say('Call 108.', 'en'), 'end');
  assert.equal(t.log.played, 2);
  assert.notEqual(t.buffers[0], t.buffers[1], 'each play gets its own copy, because decoding empties the buffer');
});

test('it reports the moment speech starts, not when it was asked for', async () => {
  const t = setup({ hold: 'fetch' });
  let starts = 0;
  const result = t.tts.say('Do you understand the risk?', 'en', () => { starts += 1; });
  await tick();
  assert.equal(starts, 0, 'still loading');
  t.network.hang = false;
  t.release();
  await result;
  assert.equal(starts, 1);
  const fallback = setup({ server: false });
  let heard = 0;
  await fallback.tts.say('One. Two.', 'en', () => { heard += 1; });
  assert.equal(heard, 1);
});

test('names are sent to the voice as words, on the server voice and the browser voice', async () => {
  const t = setup();
  await t.tts.say('DOLO-650, a fever tablet.', 'en');
  assert.equal(t.log.fetched[0].text, 'Dolo 650, a fever tablet.');
  const fallback = setup({ server: false });
  await fallback.tts.say('DOLO-650.', 'en');
  assert.equal(fallback.log.spoken[0].text, 'Dolo 650.');
});

test('no wait between parts: the rest is fetched while the prepared sentence plays', async () => {
  const t = setup({ hold: true });
  await t.tts.prepare('Call 108.', 'en');
  await t.tts.prepare('Do you understand the risk?', 'en');
  const result = t.tts.say('Call 108. I am opening the dialer.', 'en');
  await tick();
  await tick();
  assert.equal(t.log.played, 1, 'the first part is still playing');
  assert.equal(t.log.fetched.at(-1).text, 'I am opening the dialer.', 'the rest is already being fetched');
  t.tts.stop();
  await result;
  const question = setup();
  await question.tts.prepare('Call 108.', 'en');
  await question.tts.prepare('Do you understand the risk?', 'en');
  const before = question.log.fetched.length;
  await question.tts.say('Do you understand the risk?', 'en');
  assert.equal(question.log.fetched.length, before, 'several sentences can be prepared');
});
