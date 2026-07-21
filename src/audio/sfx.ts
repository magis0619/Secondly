/**
 * 効果音は全てWeb Audio合成(音声ファイルなし)。
 * 各関数は AudioContext が未解放(unlock前)なら黙って何もしない。
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

function noise(
  dur: number,
  opts: { gain?: number; filter?: BiquadFilterType; freq?: number; freqTo?: number; q?: number; delay?: number } = {},
): void {
  const bus = getAudio();
  if (!bus) return;
  const { ctx, out } = bus;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = opts.filter ?? "bandpass";
  f.Q.value = opts.q ?? 1.2;
  f.frequency.setValueAtTime(opts.freq ?? 2000, t0);
  if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.25, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** 射撃。マシンガン=軽いタタン、ショットガン=太いドン */
export function sfxShoot(shotgun: boolean): void {
  if (shotgun) {
    noise(0.14, { filter: "lowpass", freq: 1400, freqTo: 200, gain: 0.3 });
    tone(110, 0.12, { type: "square", gain: 0.14, slideTo: 50 });
  } else {
    noise(0.05, { freq: 2600, freqTo: 900, gain: 0.14 });
    tone(300, 0.03, { type: "square", gain: 0.07, slideTo: 180 });
  }
}

export function sfxEmpty(): void {
  tone(700, 0.03, { type: "square", gain: 0.08 });
  tone(500, 0.03, { type: "square", gain: 0.08, delay: 0.06 });
}

export function sfxTileHit(): void {
  noise(0.03, { filter: "lowpass", freq: 800, gain: 0.1 });
}

export function sfxTileBreak(hard: boolean): void {
  noise(0.09, { freq: hard ? 2400 : 1500, freqTo: 400, gain: 0.2 });
  tone(hard ? 260 : 200, 0.07, { type: "square", gain: 0.12, slideTo: 90 });
}

export function sfxEnemyHit(): void {
  tone(220, 0.05, { type: "square", gain: 0.12 });
}

/** 撃破。コンボでピッチ上昇 */
export function sfxKill(combo: number): void {
  const f = 330 * Math.pow(2, Math.min(combo, 20) / 12);
  tone(f, 0.14, { type: "triangle", gain: 0.2, slideTo: f * 0.7 });
  noise(0.06, { freq: 2400, freqTo: 800, gain: 0.14 });
}

/** 踏みつけ(バウンド+リロードの気持ちよさ) */
export function sfxStomp(): void {
  tone(180, 0.1, { type: "square", gain: 0.2, slideTo: 420 });
  tone(880, 0.12, { type: "triangle", gain: 0.14, delay: 0.05 });
}

export function sfxLand(perfect: boolean): void {
  noise(0.06, { filter: "lowpass", freq: 500, gain: 0.14 });
  if (perfect) {
    tone(784, 0.12, { type: "triangle", gain: 0.14, delay: 0.03 });
    tone(1175, 0.16, { type: "triangle", gain: 0.12, delay: 0.09 });
  }
}

export function sfxReload(): void {
  tone(520, 0.05, { type: "square", gain: 0.1 });
  tone(780, 0.07, { type: "square", gain: 0.1, delay: 0.06 });
}

export function sfxDamage(): void {
  tone(90, 0.28, { type: "sawtooth", gain: 0.3, slideTo: 40 });
  noise(0.22, { filter: "lowpass", freq: 1200, freqTo: 100, gain: 0.3 });
}

export function sfxCp(): void {
  tone(660, 0.12, { type: "triangle", gain: 0.15 });
  tone(990, 0.18, { type: "triangle", gain: 0.13, delay: 0.07 });
}

export function sfxGlass(): void {
  noise(0.12, { filter: "highpass", freq: 3000, gain: 0.18 });
}

export function sfxTelegraph(): void {
  tone(1100, 0.08, { gain: 0.1, slideTo: 1400 });
}

export function sfxEnemyShoot(): void {
  tone(480, 0.09, { type: "square", gain: 0.1, slideTo: 260 });
}

export function sfxBlocked(): void {
  tone(1500, 0.04, { type: "square", gain: 0.1 });
}

/** ジェム取得。コンボ中はピッチ上昇 */
export function sfxGem(combo: number): void {
  const f = 900 * Math.pow(2, Math.min(combo, 12) / 12);
  tone(f, 0.09, { type: "triangle", gain: 0.13, slideTo: f * 1.4 });
}

export function sfxAmmoPickup(): void {
  tone(600, 0.04, { type: "square", gain: 0.07, slideTo: 800 });
}

export function sfxComboBank(n: number): void {
  for (let i = 0; i < Math.min(Math.floor(n / 2), 5); i++) {
    tone(523 * Math.pow(2, (i * 4) / 12), 0.12, { type: "triangle", gain: 0.12, delay: i * 0.05 });
  }
}

export function sfxOverdrive(): void {
  tone(220, 0.4, { type: "sawtooth", gain: 0.14, slideTo: 880 });
  tone(1320, 0.25, { type: "triangle", gain: 0.14, delay: 0.18 });
}

/** 溶岩接近の心音 */
export function sfxLavaWarn(): void {
  tone(70, 0.12, { type: "sine", gain: 0.3, slideTo: 45 });
  tone(70, 0.1, { type: "sine", gain: 0.22, slideTo: 45, delay: 0.16 });
}

export function sfxClear(): void {
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((f, i) => tone(f, 0.3, { type: "triangle", gain: 0.16, delay: i * 0.09 }));
}

export function sfxFail(): void {
  const notes = [440, 349, 262, 196];
  notes.forEach((f, i) => tone(f, 0.34, { type: "triangle", gain: 0.16, delay: i * 0.12 }));
}

export function sfxStart(): void {
  tone(660, 0.08, { type: "triangle", gain: 0.14, slideTo: 990 });
}

export function sfxBuy(): void {
  tone(784, 0.1, { type: "triangle", gain: 0.16 });
  tone(1175, 0.16, { type: "triangle", gain: 0.14, delay: 0.06 });
}

export function sfxDenied(): void {
  tone(160, 0.14, { type: "square", gain: 0.1, slideTo: 120 });
}
