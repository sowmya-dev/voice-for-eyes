// Downloads the PP-OCRv5 Mobile models once into .models/. Docker caches this step.
import { mkdir, stat, writeFile, rename } from 'node:fs/promises';

export const MODELS = ['PP-OCRv5_mobile_det', 'PP-OCRv5_mobile_rec'];
const BASE = 'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0';

export async function fetchModels() {
  await mkdir('.models', { recursive: true });
  for (const name of MODELS) {
    const file = `.models/${name}_onnx_infer.tar`;
    if (await stat(file).then((s) => s.size, () => 0)) continue;
    console.log(`downloading ${name}`);
    const response = await fetch(`${BASE}/${name}_onnx_infer.tar`);
    if (!response.ok) throw new Error(`download failed for ${name}: ${response.status}`);
    // Renamed only when complete, so a broken download is never reused.
    await writeFile(`${file}.part`, Buffer.from(await response.arrayBuffer()));
    await rename(`${file}.part`, file);
  }
}

if (process.argv[1]?.endsWith('models.js')) await fetchModels();
