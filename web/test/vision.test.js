import test from 'node:test';
import assert from 'node:assert/strict';
import { rotateCopy, unrotate, readOriented, reliableCount, countFrames } from '../js/io/vision.js';

const line = (text, y, h = 30, x = 100, score = 0.95) => ({ text, score, box: { x, y, w: text.length * h * 0.5, h } });
const LABEL = [line('DOLO 650', 40, 60), line('Paracetamol Tablets IP', 120), line('EXP 12/2027', 200)];
const NOISE = [line('|l', 50, 20, 100, 0.6)];
const copies = [{ kind: 'averaged' }, { kind: 'enhanced' }, { kind: 'binarised' }];

// A fake OCR that sees the label only at one quarter turn, and records every read.
function ocrAt(goodTurn) {
  const calls = [];
  const read = async (copy, turn) => {
    calls.push([copy.kind, turn]);
    return turn === goodTurn ? LABEL : NOISE;
  };
  return { read, calls };
}

test('rotateCopy turns pixels clockwise and unrotate maps points back', () => {
  const width = 4;
  const height = 3;
  const data = new Uint8ClampedArray(width * height * 4);
  data.set([255, 0, 0, 255], (1 * width + 3) * 4); // marked pixel at x=3, y=1
  for (const turn of [1, 2, 3]) {
    const turned = rotateCopy({ kind: 'enhanced', scale: 2, width, height, data }, turn);
    assert.equal(turned.scale, 2);
    assert.deepEqual([turned.width, turned.height], turn % 2 ? [height, width] : [width, height]);
    const at = turned.data.findIndex((v, i) => i % 4 === 0 && v === 255) / 4;
    const p = unrotate({ x: (at % turned.width) + 0.5, y: Math.floor(at / turned.width) + 0.5 }, turn, width, height);
    assert.deepEqual([p.x, p.y], [3.5, 1.5], `turn ${turn}`);
  }
});

test('Upright strip: no turned copy is read', async () => {
  const ocr = ocrAt(0);
  const { reading } = await readOriented(copies, ocr.read);
  assert.equal(reading.name, 'DOLO 650');
  assert.ok(reading.expiry);
  assert.ok(ocr.calls.every(([, turn]) => turn === 0), JSON.stringify(ocr.calls));
});

test('Upside-down strip: the half turn is found and every copy is read at it', async () => {
  const ocr = ocrAt(2);
  const { reading, lines } = await readOriented(copies, ocr.read);
  assert.equal(reading.name, 'DOLO 650');
  assert.deepEqual(reading.expiry, { year: 2027, month: 12, day: null });
  assert.equal(lines.length, 3);
  for (const kind of ['averaged', 'binarised']) assert.ok(ocr.calls.some(([k, t]) => k === kind && t === 2), kind);
});

test('Sideways strip: a quarter turn either way is found', async () => {
  for (const turn of [1, 3]) {
    const { reading } = await readOriented(copies, ocrAt(turn).read);
    assert.equal(reading.name, 'DOLO 650', `turn ${turn}`);
  }
});

test('Nothing readable at any turn keeps the upright reading', async () => {
  const ocr = ocrAt(-1);
  const { reading } = await readOriented(copies, ocr.read);
  assert.equal(reading.name, null);
  assert.equal(ocr.calls.filter(([, t]) => t !== 0).length, 3, 'only the enhanced copy is tried at each turn');
});

const strip = { x: 100, y: 100, w: 400, h: 200 };
const size = { width: 1280, height: 720 };
const box = { x: 0, y: 0, w: 1, h: 1 };

test('Full pockets found: the number of full pockets is the count', () => {
  assert.equal(reliableCount({ strip, full: [box, box, box], empty: [box] }, 1, size), 3);
});

test('Model without a full-pocket class: no count is accepted', () => {
  assert.equal(reliableCount({ strip, full: [], empty: [box, box] }, 1, size), null);
});

// Colour frames tagged by index; the fake model answers per frame.
const colourFrames = [0, 1, 2].map((i) => ({ i, width: 1280, height: 720, data: new Uint8ClampedArray(4) }));
const pockets = (n) => ({ strip, full: Array(n).fill(box), empty: [] });

test('Counted from colour frames: the two sharpest original frames are sent and agree', async () => {
  const sent = [];
  const count = await countFrames(colourFrames, [2, 0, 1], async (f) => { sent.push(f); return pockets(4); });
  assert.equal(count, 4);
  assert.deepEqual(sent.map((f) => f.i), [2, 0]);
  assert.ok(sent.every((f) => f.data instanceof Uint8ClampedArray && f.width === 1280), 'original-size colour frames');
});

test('Frames disagree: no count is accepted', async () => {
  assert.equal(await countFrames(colourFrames, [0, 1], async (f) => pockets(f.i ? 5 : 4)), null);
  assert.equal(await countFrames(colourFrames, [0, 1], async () => null), null);
});
