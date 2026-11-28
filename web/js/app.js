// Wires the camera, microphone, speech and screens to the assistant.
// Only settings are stored. Labels, questions and answers stay in memory and go when the page closes.
import { createAssistant } from './core/assistant.js';
import { blankView } from './core/contract.js';
import { isEcho } from './core/echo.js';
import { LANGUAGES } from './core/language.js';
import { render } from './core/templates.js';
import { todayFrom } from './core/expiry.js';
import { fetchSpeech, getStatus, postCloud } from './io/api.js';
import { createCamera } from './io/camera.js';
import { createVision, toBase64 } from './io/vision.js';
import { createStt } from './io/stt.js';
import { createTts } from './io/tts.js';
import { createRenderer } from './ui/render.js';

const SETTINGS_KEY = 'voai.settings';
const LOG_SIZE = 200;
const DEFAULTS = { speechRate: 1, cloudHelp: false, alwaysListening: true, torchAtStart: false };
const COMMAND_TEXT = {
  back: 'back', start_over: 'start over', later: 'later', continue: 'continue', take_photo: 'take photo',
  open_settings: 'open settings', show_camera: 'show camera', back_to_answer: 'back to answer', yes: 'yes', no_repeat: 'no',
};

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

const settings = loadSettings();
const saveSettings = () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* private browsing: settings last for this visit */ }
};

const strings = await fetch('/strings.json').then((r) => r.json());
let status = { voice: false, cloud: false, visionFallback: false, reachable: false };
let view = blankView('en');
const flags = { camera: null, mic: null, voice: null, ocr: 'loading', noVoice: false, needsTap: false, reading: false };
const ui = { settings, panel: 'answer', muted: false, torchOn: false, partial: '', keyNotSet: false, notices: [], cameraState: 'off' };

// Operation log kept on the device. It never holds audio, images, transcripts or label text.
const logEntries = [];
function log(entry) {
  logEntries.push({ at: Date.now(), ...entry });
  if (logEntries.length > LOG_SIZE) logEntries.shift();
  console.debug('[voai]', entry.stage, entry.outcome, entry.durationMs ?? '', entry.code ?? '');
}

const renderer = createRenderer({ onAction });

function redraw() {
  ui.notices = [
    flags.needsTap && 'tapToStart',
    flags.camera,
    flags.mic,
    flags.voice === 'unavailable' && 'voiceUnavailable',
    flags.voice === 'unavailable' && !status.voice && status.reachable && 'voiceNoKey',
    flags.ocr === 'loading' && view.screen === 'reading' && 'loading',
    flags.ocr === 'failed' && 'loadFailed',
    flags.noVoice && 'noVoice',
    flags.reading && !['reading', '1', '1b', '5d'].includes(view.screen) && 'reading',
  ].filter(Boolean);
  renderer.draw(view, ui, strings[view.lang]);
}

const camera = createCamera(document.getElementById('video'));
const vision = createVision(camera);
const tts = createTts({
  settings,
  fetchSpeech,
  serverAvailable: () => status.voice && navigator.onLine,
  onNoVoice: () => {
    flags.noVoice = true;
    log({ stage: 'speak', outcome: 'error', code: 'no_voice' });
    redraw();
  },
});

// Fetched before they are needed: the 108 sentence, so an emergency never waits for the network,
// and the risk question, so it follows an answer without a pause.
const prepareVoice = () => {
  for (const id of ['safety.emergency', 'help.unwell', 'risk.question']) tts.prepare(render({ id }, view.lang), view.lang).catch(() => {});
};

async function snapshot() {
  const [frame] = await camera.grabFrames();
  if (!frame) return undefined;
  const full = new OffscreenCanvas(frame.width, frame.height);
  full.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
  const scale = Math.min(1, 768 / frame.width);
  const small = new OffscreenCanvas(Math.round(frame.width * scale), Math.round(frame.height * scale));
  small.getContext('2d').drawImage(full, 0, 0, small.width, small.height);
  const blob = await small.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  return toBase64(new Uint8Array(await blob.arrayBuffer()));
}

// A web page cannot place a call. On a phone this opens the dialer, and the next tap opens it again if blocked.
function dial(number) {
  const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (phone) {
    window.location.href = `tel:${number}`;
    document.addEventListener('click', (event) => {
      if (!event.target.closest('a, button')) window.location.href = `tel:${number}`;
    }, { once: true });
  }
  return phone;
}

// A soft tone and a notice, so a few seconds of reading do not feel like a freeze.
let toneContext = null;
function readingTone() {
  try {
    toneContext ??= new AudioContext();
    const oscillator = toneContext.createOscillator();
    const gain = toneContext.createGain();
    oscillator.frequency.value = 660;
    gain.gain.value = 0.04;
    oscillator.connect(gain).connect(toneContext.destination);
    oscillator.start();
    oscillator.stop(toneContext.currentTime + 0.12);
  } catch { /* no sound output */ }
}

async function readForAnswer() {
  flags.reading = true;
  readingTone();
  redraw();
  try {
    return await vision.capture();
  } finally {
    flags.reading = false;
    redraw();
  }
}

const ports = {
  capture: () => readForAnswer(),
  countTablets: null, // set when the server has a strip model configured
  say: async (text, lang, onStart) => {
    const result = await tts.say(text, lang, onStart);
    if (result === 'end' && flags.noVoice) {
      flags.noVoice = false;
      redraw();
    }
    return result;
  },
  setSpeechLanguage: (lang) => stt.setLanguage(LANGUAGES[lang].bcp47),
  stopSpeaking: () => tts.stop(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => performance.now(),
  timer: (ms, fn) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
  today: () => todayFrom(new Date()),
  cloudState: () => ({ enabled: settings.cloudHelp, keyConfigured: status.cloud, online: navigator.onLine }),
  cloud: async ({ task, lang, text, image, history }) => postCloud({ task, lang, text, history, imageJpeg: image ? await snapshot() : undefined }),
  dial,
  panel: (command) => {
    ui.panel = command === 'show_camera' ? 'camera' : 'answer';
    redraw();
  },
  onView: (next) => {
    // While the user is framing the strip, a phone shows the camera first.
    if (next.screen !== view.screen) ui.panel = ['5c', 'reading'].includes(next.screen) ? 'camera' : 'answer';
    const changedLanguage = next.lang !== view.lang;
    if (changedLanguage) flags.noVoice = false;
    view = next;
    if (changedLanguage) prepareVoice();
    redraw();
  },
  log,
};

const assistant = createAssistant(ports);

async function hear(utterance) {
  const started = performance.now();
  try {
    await assistant.hear(utterance);
    log({ stage: 'turn', outcome: 'ok', durationMs: Math.round(performance.now() - started) });
  } catch (error) {
    log({ stage: 'turn', outcome: 'error', code: error.name });
    console.error(error);
  }
}

const stt = createStt({
  onPartial: (text) => {
    if (isEcho(text, tts.audible())) return;
    if (tts.speaking()) tts.stop(); // the user is speaking: stop at once
    ui.partial = text;
    redraw();
  },
  onFinal: (utterance) => {
    if (isEcho(utterance.text, tts.audible()) || (!utterance.text.trim() && tts.speaking())) return;
    ui.partial = '';
    if (!settings.alwaysListening) stt.stop();
    redraw();
    hear(utterance);
  },
  onState: (state, code) => {
    flags.voice = state === 'listening' ? null : 'unavailable';
    log({ stage: 'speech', outcome: state === 'listening' ? 'ok' : 'error', code });
    redraw();
  },
});

async function startListening() {
  if (!status.voice) {
    flags.voice = 'unavailable';
    return;
  }
  try {
    await Promise.race([stt.listen(), ports.sleep(1500)]);
    flags.mic = null;
  } catch (error) {
    flags.mic = error.name === 'NotAllowedError' || error.name === 'NotFoundError' ? 'micDenied' : null;
    flags.voice = 'unavailable';
  }
}

async function startCamera() {
  try {
    await camera.start();
    flags.camera = null;
    ui.cameraState = 'on';
    if (settings.torchAtStart) ui.torchOn = await camera.setTorch(true);
  } catch (error) {
    flags.camera = error.name === 'InsecureContext' ? 'insecure' : 'cameraDenied';
    ui.cameraState = 'off';
  }
}

async function start() {
  await startCamera();
  redraw();
  if (settings.alwaysListening && !ui.muted && flags.camera !== 'insecure') await startListening();
  // Browsers may hold audio back until the user has tapped the page once.
  const tapped = navigator.userActivation?.hasBeenActive ?? false;
  flags.needsTap = !tapped && (flags.camera === 'cameraDenied' ? false : status.voice && !stt.running());
  redraw();
}

document.addEventListener('pointerdown', () => {
  tts.unlock();
  if (!flags.needsTap) return;
  flags.needsTap = false;
  start();
}, { capture: true });

async function onAction(key) {
  if (key === 'mic') {
    if (!camera || ui.cameraState !== 'on') await startCamera();
    // One tap listens once when "always listening" is off; otherwise the tap asks the default question.
    if (status.voice && !settings.alwaysListening) {
      ui.muted = false;
      await startListening();
      return redraw();
    }
    return hear({ text: strings[view.lang].defaultQuestion });
  }
  if (COMMAND_TEXT[key]) return hear({ text: COMMAND_TEXT[key] });
  if (key === 'torch') {
    if (!camera.torchSupported()) return assistant.say('torch.unavailable');
    if (await camera.setTorch(!ui.torchOn)) ui.torchOn = !ui.torchOn;
  } else if (key === 'mute') {
    ui.muted = !ui.muted;
    ui.partial = '';
    if (ui.muted) stt.stop();
    else if (settings.alwaysListening) await startListening();
  } else if (key === 'slower' || key === 'faster') {
    settings.speechRate = Math.min(1.5, Math.max(0.5, settings.speechRate + (key === 'faster' ? 0.25 : -0.25)));
    prepareVoice();
  } else if (key === 'sample') {
    return assistant.say('settings.sample');
  } else if (key === 'cloudHelp') {
    ui.keyNotSet = false;
    if (!settings.cloudHelp) {
      status = await getStatus();
      if (status.cloud) settings.cloudHelp = true;
      else {
        ui.keyNotSet = true;
        redraw(); // show the message at once; it is spoken as well
        await assistant.allowCloud();
      }
    } else settings.cloudHelp = false;
  } else if (key === 'alwaysListening') {
    settings.alwaysListening = !settings.alwaysListening;
    if (settings.alwaysListening && !ui.muted) await startListening();
    else stt.stop();
  } else if (key === 'torchAtStart') {
    settings.torchAtStart = !settings.torchAtStart;
  }
  saveSettings();
  return redraw();
}

window.addEventListener('offline', () => {
  flags.voice = 'unavailable';
  redraw();
});
window.addEventListener('online', async () => {
  status = await getStatus();
  prepareVoice();
  if (settings.alwaysListening && !ui.muted) await startListening();
  redraw();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

redraw();
status = await getStatus();
ports.countTablets = status.visionFallback ? () => vision.countTablets() : null;
prepareVoice();
if (!status.voice) flags.voice = 'unavailable';
redraw();
vision.warmUp().then((reader) => {
  flags.ocr = reader ? 'ready' : 'failed';
  log({ stage: 'ocr-load', outcome: reader ? 'ok' : 'error', code: reader || undefined });
  redraw();
});
await start();
