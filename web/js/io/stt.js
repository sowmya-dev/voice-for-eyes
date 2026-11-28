// Microphone -> our server's /ws/stt relay -> Sarvam. Sarvam's voice activity detection marks each utterance.
import { toBase64 } from './vision.js';

const SAMPLE_RATE = 16000;
const MAX_BACKOFF_MS = 15000;

export function createStt({ onPartial, onFinal, onState }) {
  let context = null;
  let socket = null;
  let wanted = false; // false while muted: nothing is captured or sent
  let blocked = null; // a reason that reconnecting cannot fix
  let backoff = 1000;
  let timer = null;
  let language = 'auto'; // becomes te-IN and so on once the user names a language

  async function startMic() {
    if (context) return context.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    context = new AudioContext({ sampleRate: SAMPLE_RATE });
    await context.audioWorklet.addModule('/js/io/pcm-worklet.js');
    const node = new AudioWorkletNode(context, 'pcm-chunker');
    node.port.onmessage = ({ data }) => {
      if (wanted && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: 'audio_input', audio: toBase64(new Uint8Array(data)) }));
    };
    context.createMediaStreamSource(stream).connect(node);
    return context.resume();
  }

  function connect() {
    clearTimeout(timer);
    if (!wanted || blocked || (socket && socket.readyState <= WebSocket.OPEN)) return;
    const url = new URL(`/ws/stt?language_code=${language}`, location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url);
    socket = ws;
    ws.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.event === 'session.begin') {
        backoff = 1000;
        onState('listening');
      } else if (message.event === 'transcript.partial') onPartial(message.text);
      // The server names the base language from the words when recognition is automatic (base_language).
      else if (message.event === 'transcript.final') onFinal({ text: message.text, sttLang: message.base_language ?? message.language ?? null, probability: message.base_language ? 1 : Number(message.language_confidence ?? 0) });
      else if (message.event === 'error' && message.is_fatal) {
        if (['key_not_set', 'invalid_subscription_key'].includes(message.code)) blocked = message.code;
        onState('unavailable', message.code);
      }
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      if (!wanted) return;
      onState('unavailable', blocked ?? 'disconnected');
      if (!blocked) {
        timer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
    };
  }

  async function listen() {
    wanted = true;
    await startMic();
    connect();
  }

  function closeSocket() {
    clearTimeout(timer);
    const ws = socket;
    socket = null;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'end' }));
    ws?.close();
  }

  // Sarvam closes a silent stream after 60 s, so muting closes it and unmuting opens a new one.
  function stop() {
    wanted = false;
    closeSocket();
  }

  // The language is fixed when a stream opens, so changing it opens a new stream.
  function setLanguage(code) {
    if (code === language) return;
    language = code;
    if (!wanted) return;
    closeSocket();
    connect();
  }

  return { listen, stop, setLanguage, running: () => context?.state === 'running' };
}
