// Camera preview, frame grabbing and torch. The one <video> element is never moved or re-created.
const MAX_WIDTH = 1280;
const FRAMES = 7;
const FRAME_GAP_MS = 60;

export function createCamera(video) {
  let track = null;
  const canvas = document.createElement('canvas');

  async function start() {
    if (!window.isSecureContext || !navigator.mediaDevices) throw new DOMException('insecure', 'InsecureContext');
    if (track?.readyState === 'live') return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: MAX_WIDTH }, height: { ideal: 720 } } });
    [track] = stream.getVideoTracks();
    video.srcObject = stream;
    await video.play().catch(() => {}); // muted video may still need a tap in some browsers
  }

  async function grabFrames() {
    if (!track || !video.videoWidth) return [];
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const frames = [];
    for (let i = 0; i < FRAMES; i += 1) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      frames.push({ data, width, height });
      await new Promise((resolve) => setTimeout(resolve, FRAME_GAP_MS));
    }
    return frames;
  }

  // Laptop webcams often report no facing mode; they face the user.
  const isFrontCamera = () => track?.getSettings().facingMode !== 'environment';
  const torchSupported = () => Boolean(track?.getCapabilities?.().torch);

  async function setTorch(on) {
    if (!torchSupported()) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] });
      return true;
    } catch {
      return false;
    }
  }

  return { start, grabFrames, isFrontCamera, torchSupported, setTorch };
}
