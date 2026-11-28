// Turns microphone audio into 100 ms chunks of 16-bit PCM.
class PcmChunker extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Int16Array(Math.round(sampleRate / 10));
    this.length = 0;
  }

  process([input]) {
    for (const sample of input[0] ?? []) {
      const clipped = Math.max(-1, Math.min(1, sample));
      this.chunk[this.length] = clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff;
      this.length += 1;
      if (this.length === this.chunk.length) {
        this.port.postMessage(this.chunk.slice().buffer);
        this.length = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-chunker', PcmChunker);
