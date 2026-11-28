// OpenCV runs here so cleaning frames never freezes the camera preview.
import cv from '@techstark/opencv-js';
import { cleanFrames } from './cleanup.js';

// The OpenCV module is "thenable", so it must not be awaited or returned from a promise.
const ready = new Promise((resolve) => {
  if (cv.Mat) resolve();
  else cv.onRuntimeInitialized = () => resolve();
});

self.onmessage = async ({ data: { id, frames } }) => {
  try {
    await ready;
    const result = cleanFrames(cv, frames);
    self.postMessage({ id, result }, result.copies.map((c) => c.data.buffer));
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
};
