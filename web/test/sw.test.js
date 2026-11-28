// Offline copies: big unchanging files come from the saved copy; the app's own code must update after a deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Runs sw.js against a saved copy ("old") and a server ("new"); returns what a request for the path gets.
async function served(path, { online = true } = {}) {
  const handlers = {};
  const cache = { put: async () => {} };
  vm.runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), {
    URL, Response,
    location: { origin: 'http://app' },
    self: { addEventListener: (name, handler) => { handlers[name] = handler; } },
    caches: { match: async () => 'old', open: async () => cache, keys: async () => [] },
    fetch: async () => {
      if (!online) throw new TypeError('offline');
      return { ok: false, status: 304, body: 'new' };
    },
  });
  let answer;
  handlers.fetch({ request: { url: `http://app${path}`, method: 'GET' }, respondWith: (value) => { answer = value; }, waitUntil: () => {} });
  const got = await answer;
  return got?.body ?? got;
}

test('the app code, including the bundled reader, comes from the server when there is a network', async () => {
  for (const path of ['/js/app.js', '/vendor/ocr.js', '/vendor/cleanup.worker.js']) assert.equal(await served(path), 'new', path);
});

test('models and runtime files come from the saved copy', async () => {
  for (const path of ['/vendor/models/PP-OCRv5_mobile_det_onnx_infer.tar', '/vendor/ort/ort-wasm-simd-threaded.jsep.wasm']) assert.equal(await served(path), 'old', path);
});

test('without a network, the saved app code is used', async () => {
  assert.equal(await served('/vendor/ocr.js', { online: false }), 'old');
});
