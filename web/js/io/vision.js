// Camera frames -> cleanup worker -> OCR on every copy -> two-copy agreement.
import { extractFields, agree, emptyReading } from '../core/label.js';
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

  async function readCopy(engine, copy) {
    // Finding text on a smaller image is much faster; the words are still read from the full-size copy.
    const [result] = await engine.predict(new ImageData(new Uint8ClampedArray(copy.data), copy.width, copy.height), DETECTION);
    // Boxes are mapped back to camera-frame pixels so every copy and the guidance share one scale.
    return result.items.map((item) => {
      const xs = item.poly.map((p) => (Array.isArray(p) ? p[0] : p.x) / copy.scale);
      const ys = item.poly.map((p) => (Array.isArray(p) ? p[1] : p.y) / copy.scale);
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
    const lines = [];
    for (const copy of cleaned.copies) lines.push(await readCopy(engine, copy));
    const reading = agree(lines.map(extractFields));
    // Guidance uses the copy that found the most text.
    reading.lines = lines.reduce((a, b) => (b.length > a.length ? b : a));
    reading.frame = size;
    return { reading, quality: cleaned.quality, frontCamera: camera.isFrontCamera() };
  }

  // Counting uses the server-side strip model only when one is configured. Two copies must agree.
  async function countTablets() {
    const frames = await camera.grabFrames();
    if (!frames.length) return { count: null };
    const size = { width: frames[0].width, height: frames[0].height };
    const { copies } = await clean(frames);
    const counts = [];
    for (const copy of copies.filter((c) => c.kind !== 'binarised')) {
      const found = await postFallback(await toJpeg(copy));
      counts.push(reliableCount(found, copy.scale, size));
    }
    return { count: counts[0] !== null && counts.every((n) => n === counts[0]) ? counts[0] : null };
  }

  return { capture, countTablets, warmUp };
}

// A count needs the whole strip in view and at least one pocket found.
export function reliableCount(found, scale, size) {
  if (!found?.strip || !(found.full.length + found.empty.length)) return null;
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
