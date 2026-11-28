// Cloud Vision label reading. The page fixture is the line conversion of a real Cloud Vision reply (2026-11-28)
// for a made-up label: a bold red name running up the strip, the expiry and pack size across it. No live calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractFields, toRows } from '../js/core/label.js';
import { readCloud, readWith } from '../js/io/vision.js';

const PAGE = JSON.parse(readFileSync(new URL('./fixtures/vision_page.json', import.meta.url), 'utf8'));
const copy = (page) => JSON.parse(JSON.stringify(page));
const frames = [0, 1, 2].map((i) => ({ i, width: 960, height: 640, data: new Uint8ClampedArray(4) }));
const encode = async (frame) => `jpeg-${frame.i}`;

test('Vertical name, horizontal expiry, read by the cloud: every field from one look', () => {
  const fields = extractFields(PAGE.lines);
  assert.equal(fields.name, 'DOLO 650');
  assert.deepEqual(fields.expiry, { year: 2027, month: 12, day: null }, 'EXP, not the MFG date beside it');
  assert.equal(fields.packCount, 15);
  assert.equal(fields.ingredient, 'paracetamol');
});

test('the vertical name keeps its own row, so the rows across the strip stay whole', () => {
  const texts = toRows(PAGE.lines).map((r) => r.text);
  assert.ok(texts.includes('MFG 01/2025 EXP 12/2027'), JSON.stringify(texts));
  assert.ok(texts.includes('DOLO 650'));
});

test('a vertical name level with a row is not joined to it (no "650 Tablets" pack size)', () => {
  const lines = [
    { text: 'DOLO 650', score: 0.97, box: { x: 10, y: 100, w: 56, h: 400 }, size: 56 },
    { text: 'Tablets', score: 0.97, box: { x: 200, y: 280, w: 150, h: 40 }, size: 38 },
    { text: 'EXP 03/2028', score: 0.97, box: { x: 200, y: 420, w: 260, h: 40 }, size: 38 },
  ];
  const fields = extractFields(lines);
  assert.equal(fields.packCount, null);
  assert.equal(fields.name, 'DOLO 650');
  assert.ok(toRows(lines).some((r) => r.text === 'Tablets'));
});

test('a long vertical line of small print does not beat a bold name across the strip', () => {
  const lines = [
    { text: 'Protect from light and moisture', score: 0.95, box: { x: 10, y: 20, w: 24, h: 560 }, size: 22 },
    { text: 'CROCIN 500', score: 0.97, box: { x: 200, y: 60, w: 380, h: 70 }, size: 64 },
    { text: 'EXP 03/2028', score: 0.97, box: { x: 200, y: 300, w: 260, h: 40 }, size: 38 },
  ];
  assert.equal(extractFields(lines).name, 'CROCIN 500');
});

test('device-reader lines without a letter height still work as before', () => {
  const lines = PAGE.lines.slice(1).map(({ size, ...rest }) => rest);
  const fields = extractFields(lines);
  assert.deepEqual(fields.expiry, { year: 2027, month: 12, day: null });
  assert.equal(fields.packCount, 15);
});

test('Read by Cloud Vision: the two sharpest colour frames are sent and both must agree', async () => {
  const sent = [];
  const result = await readCloud(frames, [2, 0, 1], async (images) => { sent.push(images); return [PAGE, PAGE]; }, encode);
  assert.deepEqual(sent, [['jpeg-2', 'jpeg-0']]);
  assert.equal(result.reading.name, 'DOLO 650');
  assert.equal(result.reading.packCount, 15);
  assert.equal(result.lines.length, 2);
});

test('frames that disagree on the expiry keep the name but not the expiry', async () => {
  const other = copy(PAGE);
  other.lines[2].text = 'MFG 01/2025 EXP 12/2028';
  const { reading } = await readCloud(frames, [0, 1], async () => [PAGE, other], encode);
  assert.equal(reading.name, 'DOLO 650');
  assert.equal(reading.expiry, null);
});

test('a frame with no text accepts nothing', async () => {
  const { reading } = await readCloud(frames, [0, 1], async () => [PAGE, { width: 960, height: 640, lines: [] }], encode);
  assert.equal(reading.name, null);
  assert.equal(reading.expiry, null);
});

test('Cloud Vision unavailable: null, so the device reader is used', async () => {
  assert.equal(await readCloud(frames, [0, 1], async () => null, encode), null);
});

test('one frame only: no cloud call, the device reader is used', async () => {
  let calls = 0;
  assert.equal(await readCloud(frames, [0], async () => { calls += 1; return [PAGE]; }, encode), null);
  assert.equal(calls, 0);
});

// ---------- swappable text readers ----------
function readers(googleResult) {
  const calls = [];
  return {
    calls,
    table: {
      google: async () => { calls.push('google'); return googleResult; },
      device: async () => { calls.push('device'); return { lines: [], reading: { name: 'from device' } }; },
    },
  };
}

test('the chosen reader is used when it gives a result', async () => {
  const r = readers({ lines: [], reading: { name: 'from google' } });
  assert.equal((await readWith(r.table, 'google')).reading.name, 'from google');
  assert.deepEqual(r.calls, ['google']);
});

test('the device reader takes over when the chosen reader gives nothing', async () => {
  const r = readers(null);
  assert.equal((await readWith(r.table, 'google')).reading.name, 'from device');
  assert.deepEqual(r.calls, ['google', 'device']);
});

test('Device reader chosen: the cloud reader is never called', async () => {
  const r = readers({ lines: [], reading: { name: 'from google' } });
  assert.equal((await readWith(r.table, 'device')).reading.name, 'from device');
  assert.deepEqual(r.calls, ['device']);
});

test('a reader the browser does not know falls back to the device', async () => {
  const r = readers({ lines: [], reading: { name: 'from google' } });
  assert.equal((await readWith(r.table, 'tesseract')).reading.name, 'from device');
  assert.deepEqual(r.calls, ['device']);
});
