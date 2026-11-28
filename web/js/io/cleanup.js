// Image cleanup with OpenCV: pick the five sharpest frames, align and average them,
// then denoise, apply CLAHE, sharpen, upscale 2x, and make a black-and-white copy for embossed text.
// Pure functions of (cv, frames), so they run in the browser worker and in Node tests.
// Frame = { width, height, data: RGBA bytes }

export const TOP_FRAMES = 5;
const MIN_MATCH = 0.4; // below this the shift estimate is not trusted
const ALIGN_WIDTH = 320; // shifts are estimated on a copy about this wide, which is far faster

const withMats = (fn) => {
  const mats = [];
  const keep = (m) => { mats.push(m); return m; };
  try {
    return fn(keep);
  } finally {
    for (const m of mats) m.delete();
  }
};

function laplacianVariance(cv, gray) {
  return withMats((keep) => {
    const lap = keep(new cv.Mat());
    const mean = keep(new cv.Mat());
    const dev = keep(new cv.Mat());
    cv.Laplacian(gray, lap, cv.CV_64F);
    cv.meanStdDev(lap, mean, dev);
    return dev.data64F[0] ** 2;
  });
}

const ECC_ITERATIONS = 50;
const ECC_EPSILON = 1e-4;

function shrink(cv, gray, scale, keep) {
  if (scale === 1) return gray;
  const small = keep(new cv.Mat());
  cv.resize(gray, small, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
  return small;
}

function alignTo(cv, reference, gray) {
  return withMats((keep) => {
    const scale = Math.min(1, ALIGN_WIDTH / reference.cols);
    const smallReference = shrink(cv, reference, scale, keep);
    const x = Math.round(smallReference.cols * 0.2);
    const y = Math.round(smallReference.rows * 0.2);
    const template = keep(smallReference.roi(new cv.Rect(x, y, smallReference.cols - 2 * x, smallReference.rows - 2 * y)));
    const scores = keep(new cv.Mat());
    cv.matchTemplate(shrink(cv, gray, scale, keep), template, scores, cv.TM_CCOEFF_NORMED);
    const best = cv.minMaxLoc(scores);
    const out = new cv.Mat();
    if (best.maxVal < MIN_MATCH) {
      gray.copyTo(out);
      return out;
    }
    // The shift seeds a turn-and-shift (Euclidean) refinement; the warp maps reference points to frame points.
    const warp = keep(cv.matFromArray(2, 3, cv.CV_32F, [1, 0, best.maxLoc.x - x, 0, 1, best.maxLoc.y - y]));
    try {
      const criteria = new cv.TermCriteria(cv.TermCriteria_COUNT + cv.TermCriteria_EPS, ECC_ITERATIONS, ECC_EPSILON);
      cv.findTransformECC(smallReference, shrink(cv, gray, scale, keep), warp, cv.MOTION_EUCLIDEAN, criteria, keep(new cv.Mat()), 5);
    } catch {
      // No turn could be worked out (for example a plain frame): keep the shift alone.
      warp.data32F.set([1, 0, best.maxLoc.x - x, 0, 1, best.maxLoc.y - y]);
    }
    const [a, b, tx, c, d, ty] = warp.data32F;
    const full = keep(cv.matFromArray(2, 3, cv.CV_64F, [a, b, tx / scale, c, d, ty / scale]));
    cv.warpAffine(gray, out, full, new cv.Size(gray.cols, gray.rows), cv.INTER_CUBIC + cv.WARP_INVERSE_MAP, cv.BORDER_REPLICATE);
    return out;
  });
}

function toCopy(cv, gray, kind, scale) {
  return withMats((keep) => {
    const rgba = keep(new cv.Mat());
    cv.cvtColor(gray, rgba, cv.COLOR_GRAY2RGBA);
    return { kind, scale, width: rgba.cols, height: rgba.rows, data: new Uint8ClampedArray(rgba.data) };
  });
}

export function cleanFrames(cv, frames) {
  return withMats((keep) => {
    const grays = frames.map((f) => {
      const src = keep(cv.matFromImageData(f));
      const gray = keep(new cv.Mat());
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      return gray;
    });
    const ranked = grays.map((gray, index) => ({ index, sharpness: laplacianVariance(cv, gray) }))
      .sort((a, b) => b.sharpness - a.sharpness)
      .slice(0, TOP_FRAMES);
    const reference = grays[ranked[0].index];

    const mean = keep(new cv.Mat());
    const dev = keep(new cv.Mat());
    cv.meanStdDev(reference, mean, dev);
    let motion = 0;
    if (grays.length > 1) {
      const difference = keep(new cv.Mat());
      cv.absdiff(grays[0], grays[grays.length - 1], difference);
      motion = cv.mean(difference)[0];
    }
    const quality = { sharpness: ranked[0].sharpness, contrast: dev.data64F[0], brightness: mean.data64F[0], motion };

    const average = keep(reference.clone());
    ranked.slice(1).forEach((entry, n) => {
      const aligned = keep(alignTo(cv, reference, grays[entry.index]));
      cv.addWeighted(average, (n + 1) / (n + 2), aligned, 1 / (n + 2), 0, average);
    });

    const denoised = keep(new cv.Mat());
    cv.bilateralFilter(average, denoised, 5, 40, 40);
    const contrasted = keep(new cv.Mat());
    const clahe = keep(new cv.CLAHE(2.0, new cv.Size(8, 8)));
    clahe.apply(denoised, contrasted);
    const soft = keep(new cv.Mat());
    cv.GaussianBlur(contrasted, soft, new cv.Size(0, 0), 2);
    const sharpened = keep(new cv.Mat());
    cv.addWeighted(contrasted, 1.5, soft, -0.5, 0, sharpened);
    const enhanced = keep(new cv.Mat());
    cv.resize(sharpened, enhanced, new cv.Size(0, 0), 2, 2, cv.INTER_CUBIC);
    const binary = keep(new cv.Mat());
    cv.adaptiveThreshold(enhanced, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 10);

    return {
      used: ranked.map((r) => r.index),
      quality,
      averagedSharpness: laplacianVariance(cv, average),
      copies: [toCopy(cv, average, 'averaged', 1), toCopy(cv, enhanced, 'enhanced', 2), toCopy(cv, binary, 'binarised', 2)],
    };
  });
}
