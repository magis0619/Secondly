/**
 * Web Audio の土台。AudioContext は遅延生成し、iOSのために
 * 最初のユーザー操作(pointerdown)で unlockAudio() を呼んで resume する。
 * 出力: 各音 → master(Gain) → Compressor → destination
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 20;
      comp.ratio.value = 6;
      comp.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(comp);
    } catch {
      ctx = null;
      master = null;
      return;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function suspendAudio(): void {
  if (ctx && ctx.state === "running") void ctx.suspend();
}

export function resumeAudio(): void {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export interface AudioBus {
  ctx: AudioContext;
  out: GainNode;
}

export function getAudio(): AudioBus | null {
  if (!ctx || !master || ctx.state !== "running") return null;
  return { ctx, out: master };
}

/** 使い回し用の1秒ホワイトノイズバッファ */
export function getNoiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
