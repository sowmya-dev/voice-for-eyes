// Calls to the app server. Keys live there; the browser only learns whether they are set.
const NOTHING = { voice: false, cloud: false, visionFallback: false, reachable: false };

export async function getStatus() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    return response.ok ? { ...NOTHING, ...(await response.json()), reachable: true } : NOTHING;
  } catch {
    return NOTHING;
  }
}

async function post(path, body, timeoutMs) {
  try {
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok ? await response.json() : { error: 'unavailable' };
  } catch {
    return { error: 'unavailable' };
  }
}

export const postCloud = (request) => post('/api/cloud', request, 30000);

// Sarvam's voice for one reply, as WAV bytes. Null means the browser must stand in.
export async function fetchSpeech(text, lang, pace) {
  const result = await post('/api/tts', { text: text.slice(0, 2500), lang, pace }, 10000);
  if (!result.audio) return null;
  return Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0)).buffer;
}

export async function postFallback(imageJpeg) {
  const result = await post('/api/vision/fallback', { imageJpeg }, 15000);
  return result.error ? null : result;
}
