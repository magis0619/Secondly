/**
 * 効果音は全てWeb Audio合成(音声ファイルなし)。最小セット。
 */
import { getAudio, getNoiseBuffer } from "./audio.ts";

type Wave = OscillatorType;

function tone(
  freq: number,
  dur: number,
  opts: { type?: Wave; gain?: number; slideTo?: number; delay?: number } = {},
): void {
  const bus = getAudio();
  if (!bus) return;
  const { ctx, out } = bus;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(opts.slideTo, 1), t0 + dur);
  g.gain.setValueAtTime(opts.gain ?? 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, opts: { gain?: number; freq?: number; freqTo?: number } = {}): void {
  const bus = getAudio();
  if (!bus) return;
  const { ctx, out } = bus;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(opts.freq ?? 2000, t0);
  if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** ホップ。高度が上がるほどピッチも上がる(12段で1オクターブ、2オクターブでループ) */
export function sfxHop(h: number): void {
  const f = 440 * Math.pow(2, (h % 24) / 12);
  tone(f, 0.09, { type: "triangle", gain: 0.16, slideTo: f * 1.3 });
}

/** ミス落下(落ちた段数で音を重く) */
export function sfxFall(dist: number): void {
  tone(300, 0.35, { type: "sawtooth", gain: 0.2, slideTo: 70 });
  if (dist >= 3) noise(0.3, { freq: 1200, freqTo: 150, gain: 0.18 });
}

export function sfxCount(): void {
  tone(660, 0.1, { type: "square", gain: 0.12 });
}

export function sfxGo(): void {
  tone(880, 0.18, { type: "square", gain: 0.16, slideTo: 1320 });
}

export function sfxTick(): void {
  tone(1100, 0.05, { type: "square", gain: 0.12 });
}

export function sfxTimeup(): void {
  const notes = [784, 659, 523, 659, 784, 1047];
  notes.forEach((f, i) => tone(f, 0.22, { type: "triangle", gain: 0.15, delay: i * 0.09 }));
}

/** ゾーン到達(マイルストーン) */
export function sfxZone(): void {
  const notes = [659, 880, 1319];
  notes.forEach((f, i) => tone(f, 0.2, { type: "triangle", gain: 0.15, delay: i * 0.07 }));
}

export function sfxBest(): void {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone(f, 0.25, { type: "triangle", gain: 0.15, delay: i * 0.08 }));
}

/** リザルト2〜3位: 明るいファンファーレ(タ・タ・ター!) */
export function sfxFanfare(): void {
  tone(523, 0.11, { type: "square", gain: 0.13 });
  tone(523, 0.11, { type: "square", gain: 0.13, delay: 0.13 });
  tone(659, 0.11, { type: "square", gain: 0.14, delay: 0.26 });
  tone(784, 0.55, { type: "square", gain: 0.16, delay: 0.4 });
  tone(988, 0.55, { type: "triangle", gain: 0.1, delay: 0.4 });
}

/** リザルト1位: 特別なファンファーレ(長め+和音+キラキラ上昇) */
export function sfxFanfareBig(): void {
  const head = [523, 659, 784, 1047];
  head.forEach((f, i) => tone(f, 0.13, { type: "square", gain: 0.14, delay: i * 0.12 }));
  // フィナーレ和音
  for (const f of [1047, 1319, 1568]) {
    tone(f, 0.9, { type: "square", gain: 0.09, delay: 0.55 });
    tone(f / 2, 0.9, { type: "triangle", gain: 0.08, delay: 0.55 });
  }
  // キラキラ上昇
  [1568, 1865, 2093, 2637, 3136].forEach((f, i) =>
    tone(f, 0.18, { type: "triangle", gain: 0.07, delay: 0.95 + i * 0.07 }),
  );
}

/** UIタップ */
export function sfxStart(): void {
  tone(660, 0.08, { type: "triangle", gain: 0.14, slideTo: 990 });
}
