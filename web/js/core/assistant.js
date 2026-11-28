// The one pipeline for every spoken turn:
// transcript -> language -> command / intent -> camera and label -> safety rules -> screen + speech -> session memory.
// All hardware and network access comes in through `ports`, so whole conversations run in tests.
import { route, namedLanguage, isConfirm, parseCommand, likelyAspect, clean } from './intent.js';
import { detectLanguage, nextLanguage, LANGUAGES } from './language.js';
import { renderSegments, formatDate } from './templates.js';
import { evaluate, isMedicalAdvice } from './safety.js';
import { classify, monthsLeft, lastValidDay } from './expiry.js';
import { purposeFor } from './ingredients.js';
import { cueFor, isHazy } from './guidance.js';
import { normalise, emptyReading, mergeReading } from './label.js';
import { blankView } from './contract.js';

const CLEAN_MS = 5000; // spend this long cleaning frames before asking the user to move anything
const CLEAN_KNOWN_MS = 17000; // longer once the name or expiry is read: the strip is clearly in view (D14)
const MAX_ATTEMPTS_KNOWN = 5; // more requests once the name or expiry is read (D15)
const MOVE_WAIT_MS = 3000; // time to move the medicine before the next read
const RISK_WAIT_MS = 8000; // silence after the risk question
const MAX_ATTEMPTS = 3;
const COUNT_REQUESTS = 1; // asking again rarely helps a model that only sees used pockets
const MAX_CAMERA_CUES = 3;
const MEMORY_SIZE = 20;
const DIRECTIONS = ['left', 'right', 'up', 'down'];
const TASK_SCREENS = ['reading', '2', '3', '4', '5', '5b', '5c'];
const OWN_CAMERA = ['2', '5', '5b', '5c']; // these already show the camera and their own progress

const seg = (id, slots = {}) => ({ id, slots });
const complete = (label, today) => Boolean(label.name && label.expiry) || classify(label.expiry, today) === 'expired';
const partlyRead = (label) => Boolean(label.name || label.expiry);
const attemptsFor = (label) => (partlyRead(label) ? MAX_ATTEMPTS_KNOWN : MAX_ATTEMPTS);
const memorable = (intent) => intent.name === 'dose' || (intent.name === 'identify' && ['all', 'expiry'].includes(intent.aspect));

// A spoken brand with its strength, for example "dolo 500", that does not match the label. A year is not a strength.
function namesAnotherMedicine(text, label) {
  if (!label.name) return false;
  const spoken = clean(text).match(/\b(?!(?:tablet|capsule|take|after|about|only|than|year)\b)([a-z]{4,})\s?(?!(?:19|20)\d\d\b)(\d{3,4})\b/);
  return Boolean(spoken) && !normalise(label.name).includes(normalise(spoken[1] + spoken[2]));
}

function relativeExpiry(expiry, today, lang) {
  if (!expiry) return null;
  const format = new Intl.RelativeTimeFormat(LANGUAGES[lang].bcp47, { numeric: 'always' });
  const last = lastValidDay(expiry);
  const days = Math.round((Date.UTC(last.year, last.month - 1, last.day) - Date.UTC(today.year, today.month - 1, today.day)) / 864e5);
  const months = monthsLeft(expiry, today);
  const text = Math.abs(days) < 31 || (days > 0 && months < 1) ? format.format(days, 'day')
    : days > 0 ? format.format(months, 'month') : format.format(Math.round(days / 30.4), 'month');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function tilesFor(label, today, lang, count = null) {
  return {
    name: label.name ?? null,
    expiry: relativeExpiry(label.expiry, today, lang),
    expiryPrinted: label.expiry ? formatDate(label.expiry, lang) : null,
    count: count === null ? null : String(count),
  };
}

function expirySegment(label, today) {
  if (!label.expiry) return seg('unreadable.expiry');
  const months = monthsLeft(label.expiry, today);
  if (classify(label.expiry, today) === 'later' && months >= 1 && months <= 11) {
    return months === 1 ? seg('expiry.in_one') : seg('expiry.in', { n: months });
  }
  return seg('expiry.date', { ...label.expiry });
}

// Asked about the expiry: the printed date, then one plain sentence about what it means.
function expiryAnswer(label, today) {
  if (!label.expiry) return [seg('unreadable.expiry')];
  const date = seg('expiry.date', { ...label.expiry });
  const window = classify(label.expiry, today);
  if (window === 'expired') return [date, seg('expiry.new_one')]; // the safety rules put the warning first
  const last = lastValidDay(label.expiry);
  const days = Math.round((Date.UTC(last.year, last.month - 1, last.day) - Date.UTC(today.year, today.month - 1, today.day)) / 864e5);
  if (days === 0) return [date, seg('expiry.today')];
  if (window === 'week' || window === 'month') return [date, days === 1 ? seg('expiry.day_left') : seg('expiry.days_left', { n: days })];
  const months = monthsLeft(label.expiry, today);
  if (months < 12) return [date, months <= 1 ? seg('expiry.good_month') : seg('expiry.good_months', { n: months })];
  const years = Math.floor(months / 12);
  return [date, years === 1 ? seg('expiry.good_year') : seg('expiry.good_years', { n: years })];
}

// A count is the full pockets seen, or the printed total minus the used (empty) pockets seen, said with
// how it was worked out. Never more used than the strip holds.
function countFrom(result, label) {
  if (result?.count != null) {
    return { n: result.count, segments: [result.count === 1 ? seg('count.visible_one') : seg('count.visible', { n: result.count })] };
  }
  const total = label?.packCount;
  const empty = result?.empty;
  if (empty == null || !total || empty > total) return null;
  return { n: total - empty, segments: [seg('count.from_pack', { total, empty, n: total - empty })] };
}

// "What is written?": the kept lines, largest letters first, a page at a time. Dosage lines stay out,
// so the dosage keeps its own safety rules.
const DOSAGE_LINE = /\b(dos(e|age)|directed|times (a|per) day|daily|once|twice|thrice|every \d+ ?(hours?|hrs?))\b/i;
const TEXT_PAGE = 8;
function textAnswer(label, start) {
  const all = label?.texts ?? [];
  const lines = all.filter((t) => !DOSAGE_LINE.test(t.text));
  if (!lines.length) return { segments: [seg(all.length ? 'text.no_dose' : 'text.none')], next: null };
  const page = lines.slice(start, start + TEXT_PAGE);
  const segments = [seg('text.lines', { text: page.map((t) => t.text.replace(/[.\s]+$/, '')).join('. ') })];
  if (start === 0 && lines.length < all.length) segments.push(seg('text.no_dose'));
  return { segments, next: start + TEXT_PAGE < lines.length ? start + TEXT_PAGE : null };
}

function composeMedicine(intent, label, today) {
  const plan = { intent: intent.name, aspect: intent.aspect, medicine: true, segments: [] };
  const name = label.name ? seg('id.name', { name: label.name }) : seg('unreadable.name');
  if (intent.name === 'dose') {
    plan.segments = [label.dosage ? seg('dose.printed', { text: label.dosage }) : seg('dose.none')];
  } else if (intent.aspect === 'expiry') {
    plan.segments = expiryAnswer(label, today);
  } else {
    const purposeKey = label.name ? purposeFor(label.ingredient) : null;
    plan.segments = [
      purposeKey ? seg('id.purpose', { name: label.name, purposeKey }) : name,
      expirySegment(label, today),
      ...(label.packCount ? [seg('qty.pack', { n: label.packCount })] : []),
      ...(purposeKey ? [seg('id.confirm_doctor')] : []),
    ];
  }
  return plan;
}

function saidTaken(text) {
  const t = ` ${clean(text)} `;
  if (/ (two|2|do) |दो |రెండు|ಎರಡು/u.test(t)) return seg('more.said', { n: 2 });
  if (/ (one|1|ek) |एक |ఒక|ಒಂದು/u.test(t)) return seg('more.said_one');
  return seg('more.said_some');
}

export function createAssistant(ports, { lang = 'en' } = {}) {
  const state = {
    lang, turn: 0, view: blankView(lang), history: [],
    pinned: false, // set once the user names a language: no automatic switching after that
    speechLang: null, // the language speech recognition is set to; null while it detects automatically
    risk: null, // { text, view, name, asked, reasked }
    unclear: 0, // step reached in the noisy-speech ladder
    offer: null, // { aspect } while "Do you want to know ...?" waits for a yes
    task: null, // a retry the user can interrupt and come back to
    again: null, // runs the current question again, if it is paused while the label is being read
    paused: null,
    lastLabel: null, memory: [], cancelTimer: null,
    cloudHistory: { scene: [], general: [] }, // questions and answers sent back as context for follow-ups
    followUp: null, // 'scene' or 'general' right after such an answer: an unmatched question continues it
    told: new Set(), // what has been said about the strip this session: 'all' (what it is), 'expiry', 'count'
    lastVerdict: null, stillTurn: null,
    label: null, // { reading, at, count }: everything read from the strip in front of the camera, gathered across reads
  };
  const stale = (turn) => turn !== state.turn;
  const today = () => ports.today();

  function show(patch, { remember = true } = {}) {
    const view = { ...blankView(state.lang), ...patch, lang: state.lang };
    if (remember && view.screen !== state.view.screen && !['1b', '5d', 'reading'].includes(state.view.screen)) state.history.push(state.view);
    state.view = view;
    ports.onView({ ...view });
  }
  const update = (patch) => show({ ...state.view, ...patch }, { remember: false });
  const speak = (segments, onStart) => ports.say(renderSegments(segments, state.lang), state.lang, onStart);

  async function prompt(segments, patch) {
    show({ ...patch, spoken: renderSegments(segments, state.lang) });
    return speak(segments);
  }

  // The landing screen only waits. Before a label is read, move to a screen that shows the camera.
  function look(asked) {
    if (OWN_CAMERA.includes(state.view.screen) && !state.view.final) return;
    show({ screen: 'reading', asked });
  }

  async function capture() {
    const started = ports.now();
    try {
      const result = await ports.capture();
      // Every read adds to what is known about the strip, so a name from the front and an expiry from the back add up.
      const known = remembered();
      const reading = mergeReading(known?.reading, result.reading);
      if (known && reading !== result.reading) Object.assign(known, { reading, at: ports.now() });
      else state.label = { reading, at: ports.now(), count: undefined, counting: null };
      if (reading.labelId) state.lastLabel = reading;
      ports.log({ stage: 'label', durationMs: ports.now() - started, outcome: 'ok', turnId: state.turn });
      return { ...result, reading };
    } catch (error) {
      ports.log({ stage: 'label', durationMs: ports.now() - started, outcome: 'error', code: error.name, turnId: state.turn });
      return { reading: { ...emptyReading(), lines: [], frame: { width: 1, height: 1 } }, quality: { sharpness: 0, contrast: 0, brightness: 0, motion: 0 } };
    }
  }

  // The remembered label: kept until "start over".
  const remembered = () => state.label;

  async function readWithBudget(turn) {
    const started = ports.now();
    let result = await capture();
    const budget = () => (partlyRead(result.reading) ? CLEAN_KNOWN_MS : CLEAN_MS);
    if (!complete(result.reading, today()) && partlyRead(result.reading) && state.stillTurn !== turn && !stale(turn)) {
      state.stillTurn = turn;
      const known = result.reading.name ?? formatDate(result.reading.expiry, state.lang);
      await speak([seg('look.still', { name: known })]);
    }
    while (!complete(result.reading, today()) && ports.now() - started < budget() && !stale(turn)) result = await capture();
    return result;
  }

  // ---------- risk check ----------
  async function askRisk(turn, id = 'risk.question') {
    const risk = state.risk;
    // A "yes" counts only once the question is being heard, not while its audio is still loading.
    const begun = () => {
      if (stale(turn) || state.risk !== risk) return;
      risk.asked = true;
      update({ risk: true });
    };
    const result = await speak([seg(id, { name: risk.name })], begun);
    if (stale(turn) || result === 'cancelled' || state.risk !== risk) return;
    begun(); // if it could not be spoken, the question is still on screen
    state.cancelTimer = ports.timer(RISK_WAIT_MS, () => repeatRisk());
  }

  async function repeatRisk() {
    const risk = state.risk;
    if (!risk) return;
    state.risk = null;
    show({ ...risk.view, risk: false }, { remember: false });
    await ports.say(risk.text, state.lang);
  }

  const rememberedCount = (label) => (state.label && label.labelId && state.label.reading.labelId === label.labelId ? state.label.count ?? null : null);

  // Every answer goes through here: rules first, then screen and speech.
  async function deliver(draft, label, turn, { asked = null, prefix = [], count = null } = {}) {
    const verdict = evaluate(draft, label, today());
    const segments = [...prefix, ...verdict.plan.segments];
    const text = renderSegments(segments, state.lang);
    const emergency = draft.aspect === 'emergency';
    state.lastVerdict = verdict;
    if (draft.medicine && label) {
      if (draft.aspect === 'all') state.told.add('all');
      if (['all', 'expiry'].includes(draft.aspect) && label.expiry) state.told.add('expiry');
      if (draft.aspect === 'count' && count !== null) state.told.add('count');
    }
    state.followUp = ['scene', 'general'].includes(draft.intent) ? draft.intent : null;
    const earlier = state.risk;
    const tone = emergency ? 'emergency' : verdict.expired === true ? 'warn' : 'ok';
    show({
      screen: tone === 'ok' ? '3' : '4', tone, asked, spoken: text, dial: emergency ? '108' : null,
      tiles: draft.medicine && label ? tilesFor(label, today(), state.lang, count ?? rememberedCount(label)) : null,
    });
    if (verdict.requiresConfirmation) {
      // A new dosage or expiry answer starts its own check and drops the older one.
      state.risk = { text: renderSegments(verdict.plan.segments, state.lang), view: { ...state.view }, name: label?.name ?? null, asked: false, reasked: false };
    }
    const result = await ports.say(text, state.lang);
    if (stale(turn) || result === 'cancelled' || !state.risk) return;
    // Nothing is added to an emergency or an "I feel unwell" answer; an older check waits for the next one.
    const urgent = ['emergency', 'unwell'].includes(draft.aspect);
    if (verdict.requiresConfirmation) await askRisk(turn);
    else if (urgent) return;
    else if (state.risk === earlier && !earlier.reasked) {
      earlier.reasked = true;
      await askRisk(turn, earlier.name ? 'risk.reask' : 'risk.question');
    } else if (state.risk === earlier) await repeatRisk();
  }

  // ---------- medicine answers ----------
  async function finishMedicine(intent, label, turn, ctx) {
    if (namesAnotherMedicine(ctx.text, label)) return unclearStep(ctx.text, turn, intent.aspect ?? 'dose');
    const key = `${intent.name}/${intent.aspect}/${clean(ctx.text)}`;
    const hit = memorable(intent) && label.labelId ? state.memory.find((m) => m.labelId === label.labelId && m.key === key) : null;
    const draft = hit?.plan ?? composeMedicine(intent, label, today());
    if (!hit && memorable(intent) && label.labelId) {
      state.memory.push({ labelId: label.labelId, key, plan: draft });
      if (state.memory.length > MEMORY_SIZE) state.memory.shift();
    }
    countInBackground();
    await deliver(draft, label, turn, ctx);
    return offerNext(label, turn);
  }

  // After a plain answer, offer the next thing not yet told: what it is, the expiry, then the count.
  async function offerNext(label, turn) {
    const verdict = state.lastVerdict;
    if (stale(turn) || state.risk || state.task || !verdict || verdict.expired === true || verdict.requiresConfirmation) return;
    const canCount = Boolean(ports.countTablets) || typeof state.label?.count === 'number';
    const available = { all: Boolean(label?.name), expiry: Boolean(label?.expiry), count: canCount };
    const next = ['all', 'expiry', 'count'].find((aspect) => available[aspect] && !state.told.has(aspect));
    if (!next) return;
    state.offer = { aspect: next, friendly: true };
    update({ spoken: `${state.view.spoken} ${renderSegments([seg(`confirm.${next}`)], state.lang)}` });
    await speak([seg(`confirm.${next}`)]);
  }

  // Once the label is complete, the tablets are counted once without making the user wait.
  function countInBackground() {
    const entry = remembered();
    if (!ports.countTablets || !entry || entry.count !== undefined || entry.counting) return;
    entry.counting = ports.countTablets()
      .then((result) => {
        const counted = countFrom(result, entry.reading);
        if (counted) Object.assign(entry, { count: counted.n, countSegments: counted.segments });
      })
      .catch(() => {})
      .finally(() => { entry.counting = null; });
  }

  async function medicine(intent, turn, ctx) {
    const known = remembered();
    if (known && complete(known.reading, today()) && !namesAnotherMedicine(ctx.text, known.reading)) {
      if (!(intent.name === 'identify' && intent.aspect === 'all') || ctx.fromOffer) return finishMedicine(intent, known.reading, turn, ctx);
      // "What is this tablet?" takes one look: a different strip replaces the remembered one, otherwise memory answers.
      look(ctx.asked);
      const glance = await capture();
      if (stale(turn)) return;
      if (complete(glance.reading, today())) return finishMedicine(intent, glance.reading, turn, ctx);
      state.task = { intent, ctx, attempt: 0, cameraCues: 0, hazy: false, last: null };
      return retry(state.task, turn, glance);
    }
    look(ctx.asked);
    const first = await readWithBudget(turn);
    if (stale(turn)) return;
    if (complete(first.reading, today())) return finishMedicine(intent, first.reading, turn, ctx);
    state.task = { intent, ctx, attempt: 0, cameraCues: 0, hazy: false, last: null };
    return retry(state.task, turn, first);
  }

  function instruction(cue, label) {
    const readable = label.name ?? (label.expiry ? formatDate(label.expiry, state.lang) : null);
    const segments = readable ? [seg('blur.readable', { name: readable })] : [];
    if (DIRECTIONS.includes(cue.action)) {
      segments.push(seg('blur.move', { direction: cue.action }));
      if (cue.slowly) segments.push(seg('blur.slowly'));
    } else {
      // No single direction applies, so say what cannot be read before the cue.
      segments.push(seg(label.name ? 'unreadable.expiry' : 'unreadable.name'));
      segments.push(seg(cue.action === 'closer' || cue.action === 'farther' ? `blur.${cue.action}` : 'cue.turn_over'));
    }
    return { segments, readable };
  }

  async function giveUp(task, turn) {
    state.task = null;
    const attempts = task.attempts ?? MAX_ATTEMPTS;
    await prompt([seg('retry.final')], { screen: '5b', tone: 'blur', asked: task.ctx.asked, attempt: attempts, attempts, final: true });
  }

  // At most three attempts. Camera problems are fixed first and do not use up an attempt.
  async function retry(task, turn, result = null) {
    while (!stale(turn) && state.task === task) {
      if (!result) look(task.ctx.asked);
      const read = result ?? await readWithBudget(turn);
      result = null;
      if (stale(turn)) return;
      if (complete(read.reading, today())) {
        state.task = null;
        return finishMedicine(task.intent, read.reading, turn, task.ctx);
      }
      const cue = cueFor(read.reading, read.quality, { frontCamera: read.frontCamera, previousHazy: task.hazy });
      task.hazy = isHazy(read.quality);
      const isCamera = cue.phase === 'camera';
      // Whatever has been read stays on the card while the rest is asked for.
      const tiles = partlyRead(read.reading) ? tilesFor(read.reading, today(), state.lang) : null;
      const attempts = (task.attempts = attemptsFor(read.reading));
      if (isCamera && task.cameraCues < MAX_CAMERA_CUES) {
        task.cameraCues += 1;
        task.last = { segments: [seg(`cue.${cue.action}`)], patch: { screen: task.attempt > 1 ? '5b' : '5', tone: 'blur', asked: task.ctx.asked, cue: cue.action, attempt: task.attempt, attempts, tiles } };
      } else {
        if (isCamera || task.attempt >= attempts) return giveUp(task, turn);
        task.attempt += 1;
        const { segments, readable } = instruction(cue, read.reading);
        task.last = {
          segments,
          patch: { screen: task.attempt === 1 ? '5' : '5b', tone: 'blur', asked: task.ctx.asked, readable, cue: cue.action, attempt: task.attempt, direction: DIRECTIONS.includes(cue.action) ? cue.action : null, attempts, tiles },
        };
      }
      await prompt(task.last.segments, task.last.patch);
      if (stale(turn)) return;
      await ports.sleep(MOVE_WAIT_MS);
    }
  }

  async function takePhoto(turn) {
    const task = state.task;
    const attempts = task.attempts ?? MAX_ATTEMPTS;
    if (task.attempt < attempts) task.attempt += 1;
    const patch = { screen: '5c', tone: 'blur', asked: task.ctx.asked, attempt: task.attempt, attempts };
    show({ ...patch, countdown: 3, spoken: renderSegments([seg('photo.countdown')], state.lang) });
    const speaking = speak([seg('photo.countdown')]);
    for (const n of [3, 2, 1]) {
      update({ countdown: n });
      await ports.sleep(1000);
      if (stale(turn)) return;
    }
    await speaking;
    const result = await capture();
    if (stale(turn)) return;
    if (!complete(result.reading, today()) && task.attempt >= attemptsFor(result.reading)) return giveUp(task, turn);
    return retry(task, turn, result);
  }

  async function resumeTask(turn) {
    const task = state.task;
    if (task.last) {
      await prompt(task.last.segments, task.last.patch);
      if (stale(turn)) return;
      await ports.sleep(MOVE_WAIT_MS);
    }
    return retry(task, turn);
  }

  // ---------- everything printed ----------
  async function readAll(turn, ctx) {
    let label = remembered()?.reading;
    if (!label?.texts?.length) {
      look(ctx.asked);
      const read = await readWithBudget(turn);
      if (stale(turn)) return;
      label = read.reading;
    }
    const { segments, next } = textAnswer(label, ctx.textStart ?? 0);
    await deliver({ intent: 'identify', aspect: 'text', medicine: true, segments }, label, turn, ctx);
    if (stale(turn) || state.risk || next === null) return;
    state.offer = { aspect: 'text', friendly: true, start: next };
    update({ spoken: `${state.view.spoken} ${renderSegments([seg('text.more')], state.lang)}` });
    await speak([seg('text.more')]);
  }

  // ---------- counting ----------
  const countOnce = async () => (ports.countTablets ? (await ports.countTablets()) ?? null : null);
  const labelNow = (fallback) => state.label?.reading ?? fallback;

  async function count(turn, ctx) {
    const known = remembered();
    if (known?.counting) await known.counting;
    if (stale(turn)) return;
    if (known && typeof known.count === 'number' && complete(known.reading, today())) {
      const n = known.count;
      const segments = known.countSegments ?? [n === 1 ? seg('count.visible_one') : seg('count.visible', { n })];
      return deliver({ intent: 'identify', aspect: 'count', medicine: true, segments }, known.reading, turn, { ...ctx, count: n });
    }
    look(ctx.asked);
    const { reading: label } = await capture();
    if (stale(turn)) return;
    let result = await countOnce();
    let counted = countFrom(result, labelNow(label));
    // With no counter available, asking the user to move the strip cannot help.
    for (let asked = 0; !counted && ports.countTablets && asked < COUNT_REQUESTS; asked += 1) {
      // Used cells are seen but not how many the strip holds: read the printed side, then work it out.
      const needTotal = result?.empty != null && !labelNow(label).packCount;
      const cue = needTotal ? [seg('count.need_total', { empty: result.empty })] : [seg('count.show_strip')];
      await prompt(cue, { screen: '5', tone: 'blur', asked: ctx.asked, cue: needTotal ? 'show_print' : 'show_strip', attempt: asked + 1 });
      if (stale(turn)) return;
      await ports.sleep(MOVE_WAIT_MS);
      if (stale(turn)) return;
      if (needTotal) await capture(); // the pack size joins the remembered label
      else result = await countOnce();
      if (stale(turn)) return;
      counted = countFrom(result, labelNow(label));
    }
    if (stale(turn)) return;
    const seen = counted?.n ?? null;
    if (counted && state.label) Object.assign(state.label, { count: counted.n, countSegments: counted.segments });
    const segments = counted ? counted.segments : [result?.empty != null ? seg('count.used_only', { empty: result.empty }) : seg('count.give_up')];
    await deliver({ intent: 'identify', aspect: 'count', medicine: true, segments }, labelNow(label), turn, { ...ctx, count: seen });
    if (seen !== null) await offerNext(labelNow(label), turn);
  }

  // ---------- safety events ----------
  // Help first: nothing waits for the camera. The label is read afterwards for a warning or notice.
  async function urgent(aspect, segments, turn, ctx) {
    const known = state.lastLabel;
    const knownWindow = known ? classify(known.expiry, today()) : 'unknown';
    await deliver({ intent: 'safety', aspect, medicine: Boolean(known), segments }, known, turn, ctx);
    if (stale(turn) || knownWindow === 'expired') return;
    // Read again even when a label is known: it may be a different strip by now.
    const { reading: label } = await capture();
    if (stale(turn)) return;
    const window = classify(label.expiry, today());
    const alreadySaid = window === knownWindow && label.labelId === known?.labelId;
    if (!['expired', 'week', 'month'].includes(window) || alreadySaid) return;
    const isExpired = window === 'expired';
    const text = renderSegments([seg(isExpired ? 'warn.expired' : `notice.${window}`)], state.lang);
    update({
      spoken: `${state.view.spoken} ${text}`,
      tiles: tilesFor(label, today(), state.lang),
      ...(isExpired ? { screen: '4', tone: state.view.tone === 'emergency' ? 'emergency' : 'warn' } : {}),
    });
    if (!isExpired) return ports.say(text, state.lang);
    state.risk = { text, view: { ...state.view }, name: label.name, asked: false, reasked: false };
    if (await ports.say(text, state.lang) !== 'cancelled' && !stale(turn)) await askRisk(turn);
  }

  async function safety(intent, turn, ctx) {
    if (intent.aspect === 'emergency') {
      const opened = ports.dial('108');
      return urgent('emergency', [seg('safety.emergency'), seg(opened ? 'dial.trying' : 'dial.manual')], turn, ctx);
    }
    if (intent.aspect === 'unwell') return urgent('unwell', [seg('help.unwell')], turn, ctx);
    const plan = (segments, medicineAnswer = true) => ({ intent: 'safety', aspect: intent.aspect, medicine: medicineAnswer, segments });
    if (intent.aspect === 'which_take') return deliver(plan([seg('rec.none')], false), null, turn, ctx);
    if (['took', 'took_more'].includes(intent.aspect) && state.label) Object.assign(state.label, { count: undefined, countSegments: undefined }); // the strip has changed
    look(ctx.asked);
    const { reading: label } = await capture();
    if (stale(turn)) return;
    if (intent.aspect === 'took') return deliver(plan([seg('took.ack')]), label, turn, ctx);
    if (intent.aspect === 'took_more') {
      const left = countFrom(await countOnce(), label)?.n ?? null;
      if (stale(turn)) return;
      const counted = left === null ? seg('more.cant_tell') : left === 1 ? seg('count.visible_one') : seg('count.visible', { n: left });
      return deliver(plan([saidTaken(ctx.text), counted, seg('more.advise')]), label, turn, { ...ctx, count: left });
    }
    const printed = label.warnings.length
      ? [seg('safety.printed', { text: label.warnings.join('. ') }), seg('safety.ask')]
      : [seg('safety.cannot_tell')];
    return deliver(plan(printed), label, turn, ctx);
  }

  // ---------- cloud: surroundings and general questions only ----------
  async function cloud(intent, turn, ctx) {
    const offline = intent.name === 'scene' ? 'scene.offline' : 'general.offline';
    const status = ports.cloudState();
    let segment = seg(offline);
    if (status.enabled && status.keyConfigured && status.online) {
      const reply = await ports.cloud({
        task: intent.name, lang: state.lang, text: ctx.text, image: intent.name === 'scene',
        history: state.cloudHistory[intent.name].slice(-4), // never medicine questions
      });
      if (stale(turn)) return;
      if (reply.text && isMedicalAdvice(reply.text)) segment = seg('cloud.blocked');
      else if (reply.text) {
        segment = seg('cloud.text', { text: reply.text });
        state.cloudHistory[intent.name].push({ question: ctx.text, answer: reply.text });
      }
    }
    return deliver({ intent: intent.name, aspect: null, medicine: false, segments: [segment] }, null, turn, ctx);
  }

  function answer(intent, turn, ctx) {
    state.again = (next) => answer(intent, next, ctx);
    if (intent.name === 'scene' || intent.name === 'general') return cloud(intent, turn, ctx);
    if (intent.name === 'safety') return safety(intent, turn, ctx);
    if (intent.name === 'identify' && intent.aspect === 'count') return count(turn, ctx);
    if (intent.name === 'identify' && intent.aspect === 'text') return readAll(turn, ctx);
    if (intent.name === 'identify' && intent.aspect === 'nutrition') {
      look(ctx.asked);
      return capture().then(({ reading: label }) => stale(turn) ? null : deliver({
        intent: 'identify', aspect: 'nutrition', medicine: false,
        segments: [label.nutrition.length ? seg('nutrition.rows', { text: label.nutrition.join(', ') }) : seg('nutrition.none')],
      }, label, turn, ctx));
    }
    return medicine(intent, turn, ctx);
  }

  // ---------- unclear speech ----------
  async function unclearStep(text, turn, likely) {
    state.unclear += 1;
    const base = { screen: '2', asked: text || null };
    if (state.unclear === 1) return prompt([seg('unclear.repeat')], { ...base, step: 2 });
    if (state.unclear === 2) {
      look(base.asked);
      const { reading: label } = await capture();
      if (stale(turn)) return;
      const aspect = likely ?? likelyAspect(text);
      const isExpired = classify(label.expiry, today()) === 'expired';
      const segments = label.name
        ? [seg('unclear.label', { name: label.name }), ...(label.expiry ? [seg('expiry.date', { ...label.expiry })] : [seg('unreadable.expiry')])]
        : [seg('unclear.no_label')];
      if (!isExpired) segments.push(seg(aspect ? `confirm.${aspect}` : 'unclear.again'));
      // An expired label goes through the safety rules like any other answer.
      if (isExpired) return deliver({ intent: 'identify', aspect: 'all', medicine: true, segments }, label, turn, { asked: base.asked });
      state.offer = aspect ? { aspect } : null;
      const verdict = evaluate({ intent: 'identify', aspect: 'all', medicine: Boolean(label.name), segments }, label, today());
      return prompt(verdict.plan.segments, { ...base, step: 3, tiles: label.name ? tilesFor(label, today(), state.lang) : null });
    }
    state.offer = null;
    return prompt([seg('unclear.again')], { ...base, step: 3 });
  }

  async function unclear(text, turn) {
    if (state.unclear === 0 && clean(text)) {
      // Cross-check: words that match the label resolve the doubt.
      state.again = (next) => unclear(text, next);
      look(text);
      const { reading: label } = await capture();
      if (stale(turn)) return;
      const heard = clean(text).split(' ');
      if (label.name && clean(label.name).split(' ').some((w) => w.length >= 4 && heard.includes(w))) {
        return answer({ name: 'identify', aspect: 'all' }, turn, { text, asked: text });
      }
    }
    return unclearStep(text, turn);
  }

  // ---------- commands ----------
  const taskOpen = () => Boolean(state.risk || state.task || (!state.view.final && ['reading', '2', '5', '5b', '5c', '5d'].includes(state.view.screen)));

  async function command(name, turn) {
    if (name === 'start_over') {
      Object.assign(state, {
        risk: null, unclear: 0, offer: null, task: null, paused: null, history: [], label: null,
        lastLabel: null, memory: [], cloudHistory: { scene: [], general: [] }, followUp: null, told: new Set(),
      });
      return show({ screen: '1' }, { remember: false });
    }
    if (name === 'back') {
      state.task = null;
      state.offer = null;
      const previous = state.history.pop() ?? blankView(state.lang);
      if (previous.screen === '1') state.risk = null;
      return show({ ...previous, risk: false, countdown: null }, { remember: false });
    }
    if (name === 'later') {
      if (!TASK_SCREENS.includes(state.view.screen)) return;
      state.paused = { view: { ...state.view }, task: state.task, again: state.view.screen === 'reading' ? state.again : null };
      state.task = null;
      return prompt([seg('paused')], { screen: '5d' });
    }
    if (name === 'continue') {
      if (!state.paused) return state.task ? resumeTask(turn) : undefined;
      const { view, task, again } = state.paused;
      state.paused = null;
      state.task = task;
      if (task) return resumeTask(turn);
      if (again) return again(turn); // paused while reading: read again and answer the same question
      show({ ...view, risk: false }, { remember: false });
      await ports.say(view.spoken, state.lang);
      if (!stale(turn) && state.risk) await askRisk(turn);
      return;
    }
    if (name === 'take_photo') return state.task ? takePhoto(turn) : unclear('take photo', turn);
    // "next" and "open settings" wait until the task is finished.
    if (taskOpen()) return prompt([seg('finish.first')], { screen: '1b' });
    if (name === 'open_settings') show({ screen: '6' });
  }

  async function hear({ text = '', sttLang = null, probability = null } = {}) {
    const said = text.trim();
    const name = parseCommand(said);
    // Switching the phone view must not cancel anything that is running.
    if (name === 'show_camera' || name === 'back_to_answer') return ports.panel?.(name);

    const turn = (state.turn += 1);
    ports.stopSpeaking();
    state.cancelTimer?.();
    state.cancelTimer = null;
    if (name) return command(name, turn);

    const intent = route(said);
    if (intent.name === 'language') {
      state.lang = namedLanguage(said);
      state.pinned = true;
      state.speechLang = state.lang;
      ports.setSpeechLanguage?.(state.lang); // recognition is set to the named language
      update({});
      await speak([seg('lang.changed')]);
      if (stale(turn)) return;
      if (state.task) return resumeTask(turn);
      if (state.risk) await askRisk(turn);
      return;
    }
    // Short Latin-script replies such as "yes" or "Avunu" do not switch the language.
    if (!state.pinned && !isConfirm(said) && (clean(said).split(' ').length > 2 || /[^\u0000-\u007f]/.test(said))) {
      state.lang = nextLanguage(state.lang, detectLanguage(said, sttLang, probability), null);
      // Automatic recognition writes Indian languages in English letters, so once one is found, recognition
      // is set to it and later questions come back in its own script.
      if (state.lang !== 'en' && state.speechLang !== state.lang) {
        state.speechLang = state.lang;
        ports.setSpeechLanguage?.(state.lang);
      }
    }

    const notARequest = intent.name === 'unknown' || intent.name === 'yes';
    if (state.risk) {
      if (state.risk.asked && isConfirm(said)) {
        state.risk = null;
        state.unclear = 0;
        show({ screen: '1' });
        await speak([seg('risk.ok')]);
        return;
      }
      if (notARequest) return state.risk.asked ? repeatRisk() : askRisk(turn);
    }

    const ctx = { text: said, asked: said || null, prefix: [] };
    if (state.offer) {
      const { aspect, friendly, start } = state.offer;
      state.offer = null;
      if (isConfirm(said)) {
        state.unclear = 0;
        const wanted = aspect === 'dose' ? { name: 'dose', aspect: null } : { name: 'identify', aspect };
        if (friendly) return answer(wanted, turn, { ...ctx, fromOffer: true, textStart: start });
        return answer(wanted, turn, { ...ctx, prefix: [seg('heard.you_said', { text: said })] });
      }
      if (friendly && notARequest) return speak([seg('offer.declined')]);
      if (notARequest) {
        state.unclear = 3;
        return prompt([seg('unclear.again')], { screen: '2', asked: said, step: 3 });
      }
    }

    // While the app waits for the medicine to move, "okay" or an unclear sound means "read again now".
    if (state.task && notARequest) return retry(state.task, turn);
    if (intent.name === 'unknown' && state.followUp && !state.task && !state.offer) return answer({ name: state.followUp, aspect: null }, turn, ctx);
    if (intent.name === 'unknown' || intent.name === 'yes') return unclear(said, turn);

    // Nothing may come before an emergency or "I feel unwell" instruction.
    const urgent = intent.name === 'safety' && ['emergency', 'unwell'].includes(intent.aspect);
    if (state.unclear && !urgent) ctx.prefix = [seg('heard.you_said', { text: said.replace(/[.?!]+$/, '') })];
    state.unclear = 0;
    state.task = null;
    state.paused = null;
    return answer(intent, turn, ctx);
  }

  async function allowCloud() {
    if (ports.cloudState().keyConfigured) return true;
    await speak([seg('cloud.no_key')]);
    return false;
  }

  return {
    hear,
    allowCloud,
    say: (id) => speak([seg(id)]),
    view: () => state.view,
    memorySize: () => state.memory.length,
  };
}
