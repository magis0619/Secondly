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

/** ノイズバースト(フィルタ経由) */
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

/** 土を掘る小さなザクザク */
export function sfxDig(): void {
  noise(0.04, { filter: "lowpass", freq: 900, gain: 0.07 });
}

/** 岩・鉄骨の破壊(ダッシュ貫通)。連続で鳴るのでコンボ位置でピッチが上がる */
export function sfxSmash(index: number, steel: boolean): void {
  const f = 200 + Math.min(index, 12) * 40;
  tone(f, 0.08, { type: "square", gain: 0.16, slideTo: f * 0.6 });
  noise(0.07, { freq: steel ? 2800 : 1600, freqTo: 500, gain: 0.2 });
}

/** ティア不足で弾かれた(ガキン)。ノーダメージの合図 */
export function sfxClang(): void {
  tone(1250, 0.12, { type: "square", gain: 0.18, slideTo: 900 });
  noise(0.06, { freq: 4200, gain: 0.12, q: 4 });
}

/** ダッシュ発射。ティアが上がるほど太い音 */
export function sfxDash(tier: number): void {
  noise(0.1 + tier * 0.06, { freq: 2400, freqTo: 420 - tier * 100, gain: 0.26 + tier * 0.1 });
  if (tier >= 1) tone(130, 0.14, { type: "square", gain: 0.12, slideTo: 55 });
  if (tier >= 2) noise(0.3, { filter: "lowpass", freq: 900, freqTo: 120, gain: 0.22 });
}

/** 貫通コンボ確定(3枚以上でファンファーレ的に) */
export function sfxCombo(n: number): void {
  const base = 523;
  for (let i = 0; i < Math.min(n, 5); i++) {
    tone(base * Math.pow(2, (i * 4) / 12), 0.14, { type: "triangle", gain: 0.13, delay: i * 0.04 });
  }
}

/** 鉱石/ジェムの取得 */
export function sfxPickup(kind: "ore" | "gem", duringDash: boolean): void {
  if (kind === "gem") {
    tone(1047, 0.12, { type: "triangle", gain: 0.16 });
    tone(1568, 0.16, { type: "triangle", gain: 0.13, delay: 0.05 });
  } else {
    const f = duringDash ? 1175 : 880;
    tone(f, 0.09, { type: "triangle", gain: 0.14, slideTo: f * 1.5 });
  }
}

/** ガス破裂(harmless=ダッシュ中の無害破壊) */
export function sfxGas(harmless: boolean): void {
  noise(harmless ? 0.1 : 0.2, { filter: "highpass", freq: 1200, gain: harmless ? 0.12 : 0.2 });
  if (!harmless) tone(180, 0.15, { type: "sawtooth", gain: 0.14, slideTo: 70 });
}

/** 被弾 */
export function sfxDamage(): void {
  tone(90, 0.28, { type: "sawtooth", gain: 0.3, slideTo: 40 });
  noise(0.22, { filter: "lowpass", freq: 1200, freqTo: 100, gain: 0.3 });
}

/** バネ圧縮のラチェット音(チャージ中に断続的に) */
export function sfxWind(ratio: number): void {
  tone(280 + ratio * 520, 0.02, { type: "square", gain: 0.05 });
  noise(0.015, { freq: 4000, gain: 0.03 });
}

/** チャージティア到達 */
export function sfxTierUp(tier: number): void {
  tone(tier === 2 ? 880 : 660, 0.1, { type: "triangle", gain: 0.16 });
  tone(tier === 2 ? 1320 : 990, 0.14, { type: "triangle", gain: 0.12, delay: 0.05 });
}

/** ステージクリア(上昇アルペジオ) */
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

/** ショップ購入 */
export function sfxBuy(): void {
  tone(784, 0.1, { type: "triangle", gain: 0.16 });
  tone(1175, 0.16, { type: "triangle", gain: 0.14, delay: 0.06 });
}

/** 購入不可 */
export function sfxDenied(): void {
  tone(160, 0.14, { type: "square", gain: 0.1, slideTo: 120 });
}
