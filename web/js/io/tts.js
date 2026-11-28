// Spoken replies. Sarvam's voice comes through our server. If it cannot be used, only a browser voice that the
// privacy rule allows stands in: one on the device, or an online one only while cloud help is on.
// The browser's speak() is never called without such a voice: with none set, it may pick an online voice itself.
import { LANGUAGES } from '../core/language.js';
import { forSpeech } from '../core/speech.js';

const FADE_SECONDS = 0.15;
const VOICES_WAIT_MS = 1000;

export function createTts({
  settings, onNoVoice, serverAvailable, fetchSpeech,
  player = createPlayer(), synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance,
}) {
  let current = null; // { text, playing, cancelled, halt, cancel }
  let recent = { text: '', until: 0 };
  const prepared = new Map(); // key -> { voice, sentence, audio }: sentences fetched before they are needed
  const voiceOf = (lang) => `${lang}|${settings.speechRate}`;

  // The list of voices can arrive a moment after the page loads.
  async function pickVoice(lang) {
    if (!synth) return null;
    if (!synth.getVoices().length) {
      await new Promise((resolve) => {
        const done = () => { clearTimeout(timer); synth.removeEventListener?.('voiceschanged', done); resolve(); };
        const timer = setTimeout(done, VOICES_WAIT_MS);
        synth.addEventListener?.('voiceschanged', done);
      });
    }
    const wanted = LANGUAGES[lang].bcp47.toLowerCase();
    const tag = (v) => v.lang.replace('_', '-').toLowerCase();
    const allowed = synth.getVoices().filter((v) => v.localService || settings.cloudHelp);
    return allowed.find((v) => tag(v) === wanted) ?? allowed.find((v) => tag(v).split('-')[0] === lang) ?? null;
  }

  async function playAudio(audio, job) {
    const playback = await player.play(audio);
    if (!playback) return null;
    if (job.cancelled) {
      playback.stop();
      return null;
    }
    job.playing = true;
    job.halt = () => playback.stop();
    job.begin();
    await playback.done;
    return 'end';
  }

  // `fetched` is audio already on its way.
  async function fromServer(text, lang, job, fetched) {
    if (!fetched && !serverAvailable()) return null;
    const audio = await (fetched ?? fetchSpeech(text, lang, settings.speechRate));
    if (!audio || job.cancelled) return null;
    return playAudio(audio, job);
  }

  function fromBrowser(text, lang, voice, job) {
    return new Promise((resolve) => {
      let started = false;
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        resolve(result);
      };
      // Some browsers never fire "end", so a time limit based on the length backs it up.
      const watchdog = setTimeout(() => finish(started ? 'end' : 'unspoken'), 4000 + (text.length * 120) / settings.speechRate);
      job.playing = true;
      job.halt = () => synth.cancel();
      // Short pieces, because long utterances are cut off in some browsers.
      const pieces = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
      pieces.forEach((piece, index) => {
        const utterance = new Utterance(piece.trim());
        utterance.lang = LANGUAGES[lang].bcp47;
        utterance.voice = voice;
        utterance.rate = settings.speechRate;
        utterance.onstart = () => {
          started = true;
          job.begin();
        };
        if (index === pieces.length - 1) utterance.onend = () => finish('end');
        utterance.onerror = (event) => finish(['interrupted', 'canceled'].includes(event.error) ? 'cancelled' : 'unspoken');
        synth.speak(utterance);
      });
    });
  }

  // A prepared sentence plays at once, even when the network voice is slow or gone; the rest follows.
  async function speakNow(text, lang, job) {
    const ready = [...prepared.values()].find((p) => p.voice === voiceOf(lang) && text.startsWith(p.sentence));
    if (ready) {
      const rest = text.slice(ready.sentence.length).trim();
      // The rest is fetched while the first part plays, so there is no pause between them.
      const next = rest && serverAvailable() ? fetchSpeech(rest, lang, settings.speechRate).catch(() => null) : undefined;
      // Decoding empties the buffer, so each play gets its own copy.
      const played = await playAudio(ready.audio.slice(0), job).catch(() => null);
      if (job.cancelled) return 'cancelled';
      if (played) {
        return rest ? speakText(rest, lang, job, next) : 'end';
      }
    }
    return speakText(text, lang, job);
  }

  async function speakText(text, lang, job, fetched) {
    const served = await fromServer(text, lang, job, fetched).catch(() => null);
    if (served || job.cancelled) return served ?? 'cancelled';
    const voice = await pickVoice(lang);
    if (job.cancelled) return 'cancelled';
    const result = voice ? await fromBrowser(text, lang, voice, job) : 'unspoken';
    if (result === 'unspoken' && !job.cancelled) {
      player.warn(); // a blind user must at least hear that something was not read out
      onNoVoice(lang);
    }
    return result;
  }

  async function prepare(text, lang) {
    const sentence = forSpeech(text, lang);
    const voice = voiceOf(lang);
    const key = `${voice}|${sentence}`;
    if (prepared.has(key) || !serverAvailable()) return;
    const audio = await fetchSpeech(sentence, lang, settings.speechRate);
    if (audio) prepared.set(key, { voice, sentence, audio });
  }

  function stop() {
    current?.cancel();
    synth?.cancel();
  }

  // Resolves to 'end', 'cancelled', or 'unspoken' when no permitted voice could say it.
  // onStart is called once, when the words start to be heard.
  function say(shown, lang, onStart) {
    stop();
    if (!shown) return Promise.resolve('end');
    const text = forSpeech(shown, lang);
    const job = { text, playing: false, cancelled: false, halt: null, started: false };
    job.begin = () => {
      if (job.started || job.cancelled) return;
      job.started = true;
      onStart?.();
    };
    current = job;
    const stopped = new Promise((resolve) => {
      job.cancel = () => {
        job.cancelled = true;
        job.halt?.();
        resolve('cancelled');
      };
    });
    return Promise.race([stopped, speakNow(text, lang, job)]).then((result) => {
      if (job.playing) recent = { text, until: Date.now() + 2500 };
      if (current === job) current = null;
      return job.cancelled ? 'cancelled' : result;
    });
  }

  return {
    say,
    stop,
    prepare,
    // True from the moment a reply is asked for, so speech from the user stops it even while it is loading.
    speaking: () => Boolean(current),
    // What the microphone could be hearing from the speaker right now.
    audible: () => (current?.playing ? current.text : Date.now() < recent.until ? recent.text : ''),
    unlock: () => {
      synth?.resume();
      player.unlock();
    },
  };
}

// Plays WAV audio with Web Audio, so an interruption can fade it out.
export function createPlayer() {
  let context = null;

  const open = () => {
    context ??= new AudioContext();
    return context;
  };
  const resume = async () => {
    const audio = open();
    if (audio.state !== 'running') await Promise.race([audio.resume(), new Promise((resolve) => setTimeout(resolve, 500))]);
    return audio.state === 'running' ? audio : null;
  };

  async function play(wav) {
    const audio = await resume();
    if (!audio) return null; // the browser still waits for a tap
    const source = audio.createBufferSource();
    source.buffer = await audio.decodeAudioData(wav);
    const gain = audio.createGain();
    source.connect(gain).connect(audio.destination);
    const done = new Promise((resolve) => { source.onended = resolve; });
    source.start();

    return {
      done,
      stop: () => {
        const now = audio.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
        source.stop(now + FADE_SECONDS);
      },
    };
  }

  function tone(frequency, delay = 0) {
    const audio = open();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(audio.currentTime + delay);
    oscillator.stop(audio.currentTime + delay + 0.18);
  }

  return {
    play: (wav) => play(wav).catch(() => null),
    // Two falling notes: the answer is on screen but could not be spoken.
    warn: () => {
      try {
        tone(440);
        tone(300, 0.22);
      } catch { /* no sound output */ }
    },
    unlock: () => { resume().catch(() => {}); },
  };
}
