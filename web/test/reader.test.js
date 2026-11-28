// Choosing the text reader: graphics chip when it works, processor otherwise, and never a lost read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createReader } from '../js/io/reader.js';

const never = () => new Promise(() => {});

function fakes({ gpu = true, start = 'ok', read = 'ok' } = {}) {
  const made = [];
  const seen = [];
  const make = async (kind) => {
    made.push(kind);
    if (kind === 'webgpu' && start === 'fail') throw new Error('no adapter');
    if (kind === 'webgpu' && start === 'hang') return never();
    let reads = 0;
    return {
      predict: async (image) => {
        reads += 1;
        // The first call is the warm-up read.
        if (kind === 'webgpu' && reads > 1 && read === 'fail') throw new Error('device lost');
        if (kind === 'webgpu' && reads > 1 && read === 'hang') return never();
        seen.push([kind, image]);
        return [{ items: [{ text: `${kind}:${image}` }] }];
      },
      dispose: async () => {},
    };
  };
  return { made, seen, options: { hasGpu: async () => gpu, make, startMs: 40, readMs: 40, warmImage: () => 'warm' } };
}

test('a working graphics chip is used, after one warm-up read', async () => {
  const f = fakes();
  const reader = await createReader(f.options);
  const [result] = await reader.predict('strip');
  assert.equal(result.items[0].text, 'webgpu:strip');
  assert.equal(reader.kind(), 'webgpu');
  assert.deepEqual(f.made, ['webgpu']);
  assert.deepEqual(f.seen[0], ['webgpu', 'warm']);
});

test('without a graphics chip the processor reads', async () => {
  const f = fakes({ gpu: false });
  const reader = await createReader(f.options);
  assert.equal((await reader.predict('strip'))[0].items[0].text, 'wasm:strip');
  assert.deepEqual(f.made, ['wasm']);
});

test('a graphics reader that fails or stalls while starting is replaced', async () => {
  for (const start of ['fail', 'hang']) {
    const f = fakes({ start });
    const reader = await createReader(f.options);
    assert.equal(reader.kind(), 'wasm', start);
    assert.equal((await reader.predict('strip'))[0].items[0].text, 'wasm:strip');
  }
});

test('a failed or stalled graphics read is done again on the processor, which is then kept', async () => {
  for (const read of ['fail', 'hang']) {
    const f = fakes({ read });
    const reader = await createReader(f.options);
    const both = await Promise.all([reader.predict('one'), reader.predict('two')]);
    assert.deepEqual(both.map((r) => r[0].items[0].text), ['wasm:one', 'wasm:two'], read);
    assert.equal(reader.kind(), 'wasm');
    assert.equal(f.made.filter((k) => k === 'wasm').length, 1, 'one processor reader, even with two failing reads');
  }
});
