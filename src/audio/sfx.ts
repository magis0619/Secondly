/**
 * 効果音は全てWeb Audio合成(音声ファイルなし)。
 * 各関数は AudioContext が未解放(unlock前)なら黙って何もしない。
 */
import { getAudio, getNoiseBuffer } from "./audio.ts";

type Wave = OscillatorType;

/** 単発オシレータ。減衰エンベロープ+任意のピッチスライド */
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

/** ノイズバースト(バンドパス/ローパス経由) */
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

/** 解放スイング。ティアが上がるほど太く長い音に */
export function sfxSwing(tier: number): void {
  noise(0.08 + tier * 0.05, { freq: 2400, freqTo: 500 - tier * 120, gain: 0.28 + tier * 0.1 });
  if (tier >= 1) tone(140, 0.12, { type: "square", gain: 0.12, slideTo: 60 });
  if (tier >= 2) {
    tone(90, 0.22, { type: "sawtooth", gain: 0.16, slideTo: 40 });
    noise(0.3, { filter: "lowpass", freq: 900, freqTo: 120, gain: 0.22 });
  }
}

/** 非撃破ヒット */
export function sfxHit(): void {
  tone(220, 0.05, { type: "square", gain: 0.14 });
  noise(0.04, { freq: 3000, gain: 0.1 });
}

/** 撃破。コンボ数に応じてピッチが半音ずつ上がる(上限2オクターブ) */
export function sfxKill(comboIdx: number): void {
  const semi = Math.min(comboIdx, 24);
  const f = 330 * Math.pow(2, semi / 12);
  tone(f, 0.14, { type: "triangle", gain: 0.22, slideTo: f * 0.75 });
  noise(0.06, { freq: 2600, freqTo: 900, gain: 0.16 });
}

/** クリティカル(JUST) */
export function sfxCrit(): void {
  tone(1318, 0.12, { gain: 0.16 });
  tone(1975, 0.16, { gain: 0.12, delay: 0.02 });
}

/** マルチキル(2体以上を一薙ぎ) */
export function sfxMulti(n: number): void {
  const base = 523;
  for (let i = 0; i < Math.min(n, 4); i++) {
    tone(base * Math.pow(2, (i * 4) / 12), 0.16, { type: "triangle", gain: 0.14, delay: i * 0.045 });
  }
}

/** 被弾 */
export function sfxDamage(): void {
  tone(90, 0.28, { type: "sawtooth", gain: 0.3, slideTo: 40 });
  noise(0.22, { filter: "lowpass", freq: 1200, freqTo: 100, gain: 0.3 });
}

/** 毎秒のtick。urgent(残り10秒)は音程・音量が上がる */
export function sfxTick(urgent: boolean, timeLeft: number): void {
  if (urgent) {
    const f = 900 + (10 - timeLeft) * 60;
    tone(f, 0.03, { type: "square", gain: 0.12 });
  } else {
    tone(600, 0.015, { type: "square", gain: 0.045 });
  }
}

/** スポーン予告のピング(種別で音程を変える) */
export function sfxTelegraph(kind: string): void {
  const f = kind === "rush" ? 1100 : kind === "chime" ? 700 : 880;
  tone(f, 0.09, { gain: 0.08, slideTo: f * 1.3 });
}

/** ゼンマイ巻きのラチェット音(チャージ中に断続的に鳴らす) */
export function sfxWind(ratio: number): void {
  tone(300 + ratio * 500, 0.02, { type: "square", gain: 0.05 });
  noise(0.015, { freq: 4000, gain: 0.03 });
}

/** チャージティア到達 */
export function sfxTierUp(tier: number): void {
  tone(tier === 2 ? 880 : 660, 0.1, { type: "triangle", gain: 0.16 });
  tone(tier === 2 ? 1320 : 990, 0.14, { type: "triangle", gain: 0.12, delay: 0.05 });
}

/** Chimeの発射音 */
export function sfxShot(): void {
  tone(520, 0.07, { type: "square", gain: 0.08, slideTo: 300 });
}

/** 弾がコアリングに吸収された */
export function sfxAbsorb(): void {
  tone(240, 0.08, { gain: 0.08, slideTo: 480 });
}

/** クリア(上昇アルペジオ) */
export function sfxClear(): void {
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((f, i) => tone(f, 0.3, { type: "triangle", gain: 0.16, delay: i * 0.09 }));
}

/** ゲームオーバー(下降) */
export function sfxFail(): void {
  const notes = [440, 349, 262, 196];
  notes.forEach((f, i) => tone(f, 0.34, { type: "triangle", gain: 0.16, delay: i * 0.12 }));
}

/** 画面遷移などのUI音 */
export function sfxStart(): void {
  tone(660, 0.08, { type: "triangle", gain: 0.14, slideTo: 990 });
}
