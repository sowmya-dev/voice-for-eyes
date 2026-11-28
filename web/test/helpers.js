import { createAssistant } from '../js/core/assistant.js';
import { labelIdOf } from '../js/core/label.js';

export const GOOD_QUALITY = { sharpness: 300, contrast: 60, brightness: 120, motion: 2 };
const box = (x, y, w, h) => ({ x, y, w, h });

export function reading(over = {}) {
  const base = {
    name: 'Dolo 650', ingredient: 'paracetamol', expiry: { year: 2027, month: 2, day: null }, dosage: null,
    packCount: null, warnings: [], nutrition: [], labelId: 'DOLO650|2027-2',
    lines: [{ text: 'Dolo 650', score: 0.99, box: box(500, 300, 250, 60) }], frame: { width: 1280, height: 720 },
  };
  const r = { ...base, ...over };
  if (!('labelId' in over)) r.labelId = labelIdOf(r.name, r.expiry); // the same rule as real readings
  return r;
}

export const expired = (over = {}) => reading({ expiry: { year: 2026, month: 8, day: null }, ...over });
export const noExpiry = (over = {}) => reading({ expiry: null, ...over });

export function setup({ readings = [reading()], counts = null, cloud = null, cloudState, today = { year: 2026, month: 11, day: 28 }, dial = true } = {}) {
  let clock = 0;
  const said = [];
  const views = [];
  const timers = new Set();
  const dialled = [];
  const cloudCalls = [];
  const screensAtRead = [];
  let reading_ = null; // runs once, in the middle of the next camera read
  const speechLanguages = [];
  let captures = 0;
  const queue = [...readings];
  const countQueue = counts ? [...counts] : null;
  let loading = null; // sentences matching this never start playing
  let cancelLoading = null;
  let waiting = null; // runs once, during the next wait for the user to move the medicine
  const ports = {
    capture: async () => {
      captures += 1;
      clock += 2000;
      screensAtRead.push(views.at(-1)?.screen ?? '1');
      if (reading_) { const act = reading_; reading_ = null; await act(); }
      const next = queue.length > 1 ? queue.shift() : queue[0];
      return next.reading ? next : { reading: next, quality: GOOD_QUALITY };
    },
    countTablets: countQueue ? async () => (countQueue.length > 1 ? countQueue.shift() : countQueue[0]) : null,
    say: (text, lang, onStart) => {
      said.push({ text, lang, at: clock });
      if (loading && loading.test(text)) {
        // A network voice that is still loading: it has not started, and a new turn cancels it.
        return new Promise((resolve) => { cancelLoading = () => resolve('cancelled'); });
      }
      onStart?.();
      return Promise.resolve('end');
    },
    stopSpeaking: () => { cancelLoading?.(); cancelLoading = null; },
    sleep: async (ms) => {
      clock += ms;
      if (ms >= 3000 && waiting) { const act = waiting; waiting = null; await act(); }
    },
    now: () => clock,
    timer: (ms, fn) => { timers.add(fn); return () => timers.delete(fn); },
    today: () => today,
    cloud: async (request) => { cloudCalls.push(request); return cloud ? cloud(request) : { text: 'A room with a table.' }; },
    cloudState: () => cloudState ?? { enabled: false, keyConfigured: false, online: true },
    dial: (n) => { dialled.push(n); return dial; },
    setSpeechLanguage: (lang) => speechLanguages.push(lang),
    onView: (v) => views.push(v),
    log: () => {},
  };
  const assistant = createAssistant(ports);
  return {
    assistant, said, views, dialled, cloudCalls, speechLanguages, screensAtRead,
    duringNextRead: (act) => { reading_ = act; },
    captures: () => captures,
    advance: (ms) => { clock += ms; },
    duringNextWait: (act) => { waiting = act; },
    keepLoading: (pattern) => { loading = pattern; },
    view: () => views.at(-1),
    text: () => said.map((s) => s.text).join(' | '),
    clear: () => { said.length = 0; },
    hear: (text, extra = {}) => assistant.hear({ text, ...extra }),
    fireTimers: async () => { const all = [...timers]; timers.clear(); for (const fn of all) await fn(); },
  };
}
