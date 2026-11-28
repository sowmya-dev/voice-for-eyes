// Picks one cue at a time: fix the camera first, then move the medicine (sideways, up or down, then distance).
// shortcut: every limit below is a starting guess; tune them from real strip photos.
export const LIMITS = { sharpness: 60, haze: 35, motion: 12, dark: 35, edgePx: 15, minArea: 0.02, nearCentre: 0.2 };

const camera = (action, reason) => ({ phase: 'camera', action, reason, slowly: false });
const strip = (action, reason, slowly = false) => ({ phase: 'strip', action, reason, slowly });

function union(boxes) {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

export const isHazy = (quality) => quality.sharpness < LIMITS.sharpness && quality.contrast < LIMITS.haze;

export function cueFor(reading, quality, { frontCamera = false, previousHazy = false } = {}) {
  if (quality.motion > LIMITS.motion) return camera('hold_still', 'blurry');
  if (isHazy(quality)) return previousHazy ? camera('wipe_lens', 'hazy') : camera('hold_still', 'blurry');
  if (quality.brightness < LIMITS.dark || !reading.lines.length) return camera('point_camera', 'not_aimed');

  const { width, height } = reading.frame;
  const box = union(reading.lines.map((l) => l.box));
  const edge = LIMITS.edgePx;
  const cut = {
    left: box.x <= edge, right: box.x + box.w >= width - edge,
    top: box.y <= edge, bottom: box.y + box.h >= height - edge,
  };
  if ((cut.left && cut.right) || (cut.top && cut.bottom)) return strip('farther', 'too_large');
  const near = Math.abs((box.x + box.w / 2) / width - 0.5) < LIMITS.nearCentre;
  // Directions are for the medicine, as the user sees it. It moves away from the edge that cuts the text.
  // A rear camera faces the same way as the user. A front camera faces the user, so left and right swap.
  if (cut.left) return strip(frontCamera ? 'left' : 'right', 'strip_cut_off', near);
  if (cut.right) return strip(frontCamera ? 'right' : 'left', 'strip_cut_off', near);
  if (cut.top) return strip('down', 'strip_cut_off', near);
  if (cut.bottom) return strip('up', 'strip_cut_off', near);
  if ((box.w * box.h) / (width * height) < LIMITS.minArea) return strip('closer', 'too_small');
  return strip('turn_over', 'no_expiry');
}
