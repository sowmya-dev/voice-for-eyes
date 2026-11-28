// Reads label text on the graphics chip when it works, otherwise on the processor. A graphics reader that
// does not start, fails or stalls is replaced by the processor reader, and the same image is read again.

const within = (promise, ms) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timed out')), ms);
  promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
});

// make(kind) -> engine { predict(image, params), dispose() } for kind 'webgpu' or 'wasm'.
export async function createReader({ hasGpu, make, warmImage, startMs = 30000, readMs = 20000 }) {
  let kind = 'wasm';
  let engine = null;
  let switching = null;

  if (await Promise.resolve(hasGpu()).catch(() => false)) {
    const starting = make('webgpu');
    try {
      engine = await within((async () => {
        const gpu = await starting;
        await gpu.predict(await warmImage()); // the first read prepares the graphics programs
        return gpu;
      })(), startMs);
      kind = 'webgpu';
    } catch {
      starting.then((gpu) => gpu.dispose?.()).catch(() => {});
    }
  }
  engine ??= await make('wasm');

  const useProcessor = () => {
    switching ??= make('wasm').then((processor) => {
      Promise.resolve(engine.dispose?.()).catch(() => {});
      engine = processor;
      kind = 'wasm';
      return processor;
    }, (error) => {
      switching = null;
      throw error;
    });
    return switching;
  };

  async function predict(image, params) {
    if (kind !== 'webgpu') return engine.predict(image, params);
    try {
      return await within(engine.predict(image, params), readMs);
    } catch {
      return (await useProcessor()).predict(image, params);
    }
  }

  return { predict, kind: () => kind };
}
