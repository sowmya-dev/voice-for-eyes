// PaddleOCR PP-OCRv5 Mobile, with models and runtime served by this app so it works offline.
// Bundled to /vendor/ocr.js by build.js.
import { PaddleOCR } from '@paddleocr/paddleocr-js';
import { createReader } from './reader.js';

const model = (name) => ({ url: new URL(`/vendor/models/${name}_onnx_infer.tar`, self.location.href).href });

function make(kind) {
  return PaddleOCR.create({
    textDetectionModelName: 'PP-OCRv5_mobile_det',
    textDetectionModelAsset: model('PP-OCRv5_mobile_det'),
    textRecognitionModelName: 'PP-OCRv5_mobile_rec',
    textRecognitionModelAsset: model('PP-OCRv5_mobile_rec'),
    // The graphics chip is used on the page itself: inside the package's background worker it stalled.
    worker: kind === 'wasm',
    // Several processor threads need cross-origin isolation (see nginx.conf); otherwise it runs on one.
    ortOptions: {
      backend: kind, wasmPaths: new URL('/vendor/ort/', self.location.href).href, simd: true,
      numThreads: self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1,
    },
  });
}

// A software stand-in for a graphics chip is slower than the processor reader, so it is not used.
async function hasGpu() {
  const adapter = await self.navigator.gpu?.requestAdapter();
  return Boolean(adapter) && !adapter.isFallbackAdapter && !adapter.info?.isFallbackAdapter;
}

// Text in the warm-up image makes both finding and reading text get prepared.
function warmImage() {
  const canvas = new OffscreenCanvas(640, 200);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 640, 200);
  context.fillStyle = '#000';
  context.font = '48px sans-serif';
  context.fillText('DOLO 650  EXP 12/2027', 30, 110);
  return context.getImageData(0, 0, 640, 200);
}

export const createOcr = () => createReader({ hasGpu, make, warmImage });
