// Camera frames -> cleanup worker -> OCR on every copy -> two-copy agreement.
import { extractFields, agree, emptyReading, labelIdOf } from '../core/label.js';
import { postFallback } from './api.js';

const DETECTION = { textDetLimitSideLen: 736, textDetLimitType: 'max' };
export function createVision(camera) {
  const worker = new Worker('/vendor/cleanup.worker.js');
  const pending = new Map();
  let nextId = 0;
  worker.onmessage = ({ data }) => {
    const job = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) job?.reject(new Error(data.error));
    else job?.resolve(data.result);
  };

  const clean = (frames) => new Promise((resolve, reject) => {
    const id = (nextId += 1);
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, frames }, frames.map((f) => f.data.buffer));
  });

  let ocr = null;
  function loadOcr() {
    ocr ??= import('/vendor/ocr.js').then((m) => m.createOcr()).catch((error) => {
      ocr = null; // allow a later retry
      throw error;
    });
    return ocr;
  }

  async function readCopy(engine, copy, turn = 0) {
    const view = turn ? rotateCopy(copy, turn) : copy;
    // Finding text on a smaller image is much faster; the words are still read from the full-size copy.
    const [result] = await engine.predict(new ImageData(new Uint8ClampedArray(view.data), view.width, view.height), DETECTION);
    // Boxes are mapped back to upright camera-frame pixels so every copy, every turn and the guidance share one frame.
    return result.items.map((item) => {
      const points = item.poly.map((p) => unrotate(Array.isArray(p) ? { x: p[0], y: p[1] } : p, turn, copy.width, copy.height));
      const xs = points.map((p) => p.x / copy.scale);
      const ys = points.map((p) => p.y / copy.scale);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { text: item.text, score: item.score, box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } };
    });
  }

  // Load the models and OpenCV early so the first question is not slowed by them.
  const warmUp = () => {
    clean([{ width: 64, height: 48, data: new Uint8ClampedArray(64 * 48 * 4).fill(128) }]).catch(() => {});
    // Resolves to the reader in use (graphics chip or processor), or false if it could not load.
    // An older saved copy of the reader may not say which it is (the first reload after an update).
    return loadOcr().then((reader) => reader.kind?.() ?? 'wasm', () => false);
  };

  // One read at a time: the OCR engine is shared.
  let queue = Promise.resolve();
  const capture = () => {
    const next = queue.then(readLabel);
    queue = next.catch(() => {});
    return next;
  };

  async function readLabel() {
    const frames = await camera.grabFrames();
    if (!frames.length) {
      return { reading: { ...emptyReading(), lines: [], frame: { width: 1, height: 1 } }, quality: { sharpness: 0, contrast: 0, brightness: 0, motion: 0 } };
    }
    const size = { width: frames[0].width, height: frames[0].height };
    const [engine, cleaned] = await Promise.all([loadOcr(), clean(frames)]);
    const { lines, reading } = await readOriented(cleaned.copies, (copy, turn) => readCopy(engine, copy, turn));
    // Guidance uses the copy that found the most text.
    reading.lines = lines.reduce((a, b) => (b.length > a.length ? b : a));
    reading.frame = size;
    return { reading, quality: cleaned.quality, frontCamera: camera.isFrontCamera() };
  }

  // Counting uses the server-side strip model only when one is configured. The model was trained on
  // colour photos, so it gets the two sharpest frames as captured, not the black-and-white cleaned copies.
  async function countTablets() {
    const frames = await camera.grabFrames();
    if (!frames.length) return { count: null };
    const colour = frames.map((f) => ({ ...f, data: new Uint8ClampedArray(f.data) })); // the worker takes the originals
    const { used } = await clean(frames);
    return { count: await countFrames(colour, used, async (frame) => postFallback(await toJpeg({ ...frame, scale: 1 }))) };
  }

  return { capture, countTablets, warmUp };
}

// Two of the sharpest frames must give the same reliable count.
export async function countFrames(frames, used, post) {
  if (used.length < 2) return null;
  const size = { width: frames[0].width, height: frames[0].height };
  const counts = [];
  for (const index of used.slice(0, 2)) counts.push(reliableCount(await post(frames[index]), 1, size));
  return counts[0] !== null && counts[0] === counts[1] ? counts[0] : null;
}

// Reads every copy upright and keeps what it finds. A strip can print the name along its length and the
// expiry across it, so each missing name or expiry is looked for at its own quarter turn: the averaged copy
// is read at each turn, and a turn that shows the field must be confirmed by a second copy at that turn.
export async function readOriented(copies, read) {
  const upright = [];
  for (const copy of copies) upright.push(await read(copy, 0));
  const reading = agree(upright.map(extractFields));
  if (reading.name && reading.expiry) return { lines: upright, reading };
  const probe = copies.find((c) => c.kind === 'averaged') ?? copies[0];
  const second = copies.find((c) => c.kind === 'enhanced' && c !== probe) ?? copies.find((c) => c !== probe);
  const turns = [];
  for (const turn of [1, 2, 3]) {
    const lines = await read(probe, turn);
    turns.push({ turn, lines, fields: extractFields(lines), confirm: null });
  }
  turns.sort((a, b) => textWeight(b.lines) - textWeight(a.lines));
  const used = new Set();
  for (const field of ['name', 'expiry']) {
    if (reading[field]) continue;
    for (const t of turns.filter((x) => x.fields[field])) {
      t.confirm ??= second ? await read(second, t.turn) : [];
      const agreed = agree([t.fields, extractFields(t.confirm)]);
      if (!agreed[field]) continue;
      // Anything else this turn confirms fills only what the upright reading left empty.
      for (const [key, value] of Object.entries(agreed)) {
        if (value !== null && !Array.isArray(value) && reading[key] == null) reading[key] = value;
      }
      used.add(t);
      break;
    }
  }
  reading.labelId = labelIdOf(reading.name, reading.expiry);
  return { lines: [...upright, ...[...used].flatMap((t) => [t.lines, t.confirm])], reading };
}

const textWeight = (lines) => lines.reduce((sum, l) => sum + l.score * l.text.trim().length, 0);

// `turn` quarter turns clockwise. Pixels are moved as whole 32-bit RGBA values.
export function rotateCopy(copy, turn) {
  const { width: w, height: h } = copy;
  const src = new Uint32Array(new Uint8ClampedArray(copy.data).buffer);
  const out = new Uint32Array(w * h);
  const ow = turn % 2 ? h : w;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [nx, ny] = turn === 1 ? [h - 1 - y, x] : turn === 2 ? [w - 1 - x, h - 1 - y] : [y, w - 1 - x];
      out[ny * ow + nx] = src[y * w + x];
    }
  }
  return { ...copy, width: ow, height: turn % 2 ? w : h, data: new Uint8ClampedArray(out.buffer) };
}

// A point in a copy turned `turn` quarter turns clockwise, back in the upright copy of size width x height.
export function unrotate({ x, y }, turn, width, height) {
  if (turn === 1) return { x: y, y: height - x };
  if (turn === 2) return { x: width - x, y: height - y };
  if (turn === 3) return { x: width - y, y: x };
  return { x, y };
}

// A count needs the whole strip in view and at least one full pocket, so a model that cannot see
// tablets never reports zero.
export function reliableCount(found, scale, size) {
  if (!found?.strip || !found.full.length) return null;
  const { x, y, w, h } = found.strip;
  const edge = 15;
  const whole = x / scale > edge && y / scale > edge && (x + w) / scale < size.width - edge && (y + h) / scale < size.height - edge;
  return whole ? found.full.length : null;
}

async function toJpeg(copy) {
  const canvas = new OffscreenCanvas(copy.width, copy.height);
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(copy.data), copy.width, copy.height), 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  return toBase64(new Uint8Array(await blob.arrayBuffer()));
}

export function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
