// Runs the real OpenCV.js pipeline on synthetic frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cleanFrames, TOP_FRAMES } from '../js/io/cleanup.js';

const cv = createRequire(import.meta.url)('@techstark/opencv-js');
if (!cv.Mat) await new Promise((resolve) => { cv.onRuntimeInitialized = resolve; });

const W = 320;
const H = 240;

// A high-contrast pattern, optionally shifted and blurred, as RGBA.
function frame({ dx = 0, dy = 0, blur = 0, angle = 0 } = {}) {
  if (angle) return rotated(frame({ dx, dy, blur }), angle);
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const sx = x - dx;
      const sy = y - dy;
      const ink = sx > 80 && sx < 240 && sy > 90 && sy < 150 && ((sx >> 3) + (sy >> 4)) % 2 === 0;
      data.set([ink ? 30 : 210, ink ? 30 : 210, ink ? 30 : 210, 255], (y * W + x) * 4);
    }
  }
  if (!blur) return { width: W, height: H, data };
  const src = cv.matFromImageData({ width: W, height: H, data });
  cv.GaussianBlur(src, src, new cv.Size(blur, blur), 0);
  const out = { width: W, height: H, data: new Uint8ClampedArray(src.data) };
  src.delete();
  return out;
}

test('shaky capture: the five sharpest frames are aligned and averaged', () => {
  const frames = [frame({ blur: 15 }), frame(), frame({ dx: 4, dy: 3 }), frame({ dx: -3 }), frame({ blur: 11 }), frame({ dy: -4 }), frame({ dx: 2, dy: 2 })];
  const result = cleanFrames(cv, frames);
  assert.equal(TOP_FRAMES, 5);
  assert.equal(result.used.length, 5);
  assert.ok(!result.used.includes(0) && !result.used.includes(4), `blurred frames excluded: ${result.used}`);
  // Aligned frames average back to a crisp image; unaligned ones would smear it.
  const single = cleanFrames(cv, [frames[result.used[0]]]);
  assert.ok(result.averagedSharpness > single.averagedSharpness * 0.7, `${result.averagedSharpness} vs ${single.averagedSharpness}`);
});

// A frame turned by `angle` degrees about its centre, as a tilting hand would.
function rotated(f, angle) {
  const src = cv.matFromImageData(f);
  const out = new cv.Mat();
  const m = cv.getRotationMatrix2D(new cv.Point(W / 2, H / 2), angle, 1);
  cv.warpAffine(src, out, m, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
  const result = { width: W, height: H, data: new Uint8ClampedArray(out.data) };
  [src, out, m].forEach((x) => x.delete());
  return result;
}

test('tilting hand: frames turned by a few degrees are aligned before averaging', () => {
  // Every frame is turned, so each is equally softened by the test's own resampling.
  const frames = [frame({ angle: 1 }), frame({ angle: 4 }), frame({ angle: -2 }), frame({ angle: 5, dx: 2 }), frame({ angle: -3, dy: 2 })];
  const result = cleanFrames(cv, frames);
  const single = cleanFrames(cv, [frames[result.used[0]]]);
  assert.ok(result.averagedSharpness > single.averagedSharpness * 0.7, `${result.averagedSharpness} vs ${single.averagedSharpness}`);
});

test('alignment fails: frames with nothing to line up still give three copies', () => {
  const flat = () => ({ width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(128) });
  const result = cleanFrames(cv, [flat(), flat(), flat()]);
  assert.equal(result.copies.length, 3);
});

test('three copies: averaged, enhanced at 2x, and binarised for embossed text', () => {
  const { copies } = cleanFrames(cv, [frame(), frame(), frame()]);
  assert.deepEqual(copies.map((c) => [c.kind, c.width, c.scale]), [['averaged', W, 1], ['enhanced', W * 2, 2], ['binarised', W * 2, 2]]);
  const levels = new Set(copies[2].data.filter((_, i) => i % 4 !== 3));
  assert.deepEqual([...levels].sort((a, b) => a - b), [0, 255]);
  assert.equal(copies[1].data.length, W * H * 4 * 4);
});

test('quality measures tell blur, motion and darkness apart', () => {
  const sharp = cleanFrames(cv, [frame(), frame()]).quality;
  const blurry = cleanFrames(cv, [frame({ blur: 21 }), frame({ blur: 21 })]).quality;
  const moving = cleanFrames(cv, [frame(), frame({ dx: 30 })]).quality;
  assert.ok(sharp.sharpness > blurry.sharpness * 3);
  assert.ok(moving.motion > sharp.motion + 5);
  assert.ok(sharp.brightness > 150 && sharp.contrast > 20);
});
