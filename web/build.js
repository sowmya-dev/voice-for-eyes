// Builds web/dist: app files, bundled OpenCV and OCR code, fonts, ONNX runtime and OCR models.
// Everything is served by this app, so nothing is fetched from another site while it runs.
import { build } from 'esbuild';
import { cp, mkdir, readdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchModels, MODELS } from './models.js';

const out = 'dist';
const modules = 'node_modules';
const design = process.env.DESIGN_DIR ?? '../docs/design/voai';

await rm(out, { recursive: true, force: true });
await mkdir(`${out}/vendor/models`, { recursive: true });
await mkdir(`${out}/vendor/ort`, { recursive: true });

for (const file of ['index.html', 'styles.css', 'strings.json', 'sw.js']) await cp(file, `${out}/${file}`);
await cp('js', `${out}/js`, { recursive: true });
await cp(`${design}/tokens.css`, `${out}/tokens.css`);

const common = { bundle: true, minify: true, platform: 'browser', external: ['fs', 'path', 'crypto'], logLevel: 'warning', legalComments: 'none' };
await build({ ...common, entryPoints: ['js/io/ocr-entry.js'], outfile: `${out}/vendor/ocr.js`, format: 'esm' });
await build({ ...common, entryPoints: ['js/io/cleanup.worker.js'], outfile: `${out}/vendor/cleanup.worker.js`, format: 'iife' });
// The OCR package starts its own worker from ./assets next to its bundle.
await cp(`${modules}/@paddleocr/paddleocr-js/dist/assets`, `${out}/vendor/assets`, { recursive: true, filter: (src) => !src.endsWith('.map') });

const ort = `${modules}/onnxruntime-web/dist`;
for (const file of await readdir(ort)) {
  if (/^ort-wasm-simd-threaded.*\.(wasm|mjs)$/.test(file)) await cp(path.join(ort, file), `${out}/vendor/ort/${file}`);
}

for (const font of ['atkinson-hyperlegible', 'noto-sans-devanagari', 'noto-sans-telugu', 'noto-sans-kannada']) {
  const from = `${modules}/@fontsource/${font}`;
  const to = `${out}/vendor/fonts/${font}`;
  await mkdir(`${to}/files`, { recursive: true });
  for (const css of ['400.css', '700.css']) await writeFile(`${to}/${css}`, await readFile(`${from}/${css}`));
  for (const file of await readdir(`${from}/files`)) {
    if (/-(400|700)-normal\.woff2$/.test(file)) await cp(`${from}/files/${file}`, `${to}/files/${file}`);
  }
}

await fetchModels();
for (const name of MODELS) await cp(`.models/${name}_onnx_infer.tar`, `${out}/vendor/models/${name}_onnx_infer.tar`);
console.log('built', out);
