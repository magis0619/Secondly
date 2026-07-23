/**
 * BGM(全てWeb Audio合成、音源ファイルなし)。
 * 小さなステップシーケンサ: 100msごとに先読みして音符をスケジュールする。
 * 3曲: menu(ゆったり) / game(軽快) / fever(高揚)。setBgm()で切替(短いフェード)。
 * AudioContextはユーザー操作後にしか動かないため、unlock前に呼ばれても
 * スケジューラが待機して再生可能になり次第流れ始める。
 */
import { getAudio, getNoiseBuffer } from "./audio.ts";

export type BgmTrack = "menu" | "game" | "fever";

type Wave = OscillatorType;

/** [ステップ, MIDIノート] */
type Hit = [number, number];

interface Part {
  type: Wave;
  gain: number;
  dur: number; // 秒
  notes: Hit[];
}

interface HatPart {
  gain: number;
  dur: number;
  freq: number;
  steps: number[];
  accent?: number[]; // 強めに鳴らすステップ
}

interface Song {
  bpm: number;
  /** 1ループの総ステップ数(1ステップ=8分音符) */
  steps: number;
  parts: Part[];
  hats?: HatPart;
}

const midi = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** バーごとの繰り返しを展開するヘルパ: bars[b]のパターンをbar*8+stepに配置 */
function bars(pattern: [number, number][][]): Hit[] {
  const out: Hit[] = [];
  pattern.forEach((bar, b) => {
    for (const [s, m] of bar) out.push([b * 8 + s, m]);
  });
  return out;
}

const SONGS: Record<BgmTrack, Song> = {
  // ゆうぐれのメニュー: FM7 → C → Dm7 → B♭ (88bpm)
  menu: {
    bpm: 88,
    steps: 32,
    parts: [
      {
        type: "sine",
        gain: 0.1,
        dur: 0.5,
        notes: bars([
          [[0, 41], [6, 48]],
          [[0, 36], [6, 43]],
          [[0, 38], [6, 45]],
          [[0, 34], [6, 41]],
        ]),
      },
      {
        type: "triangle",
        gain: 0.05,
        dur: 0.4,
        notes: bars([
          [[1, 69], [3, 72], [5, 76]],
          [[1, 67], [3, 72], [5, 76]],
          [[1, 69], [3, 74], [5, 77]],
          [[1, 70], [3, 74], [5, 77]],
        ]),
      },
    ],
  },
  // 登り: Am → F → C → G (132bpm、走るベース+プラック)
  game: {
    bpm: 132,
    steps: 32,
    parts: [
      {
        type: "triangle",
        gain: 0.12,
        dur: 0.16,
        notes: bars([
          [[0, 33], [2, 45], [4, 33], [6, 45]],
          [[0, 29], [2, 41], [4, 29], [6, 41]],
          [[0, 36], [2, 48], [4, 36], [6, 48]],
          [[0, 31], [2, 43], [4, 31], [6, 43]],
        ]),
      },
      {
        type: "square",
        gain: 0.032,
        dur: 0.12,
        notes: bars([
          [[1, 76], [3, 72], [5, 69], [7, 72]],
          [[1, 77], [3, 72], [5, 69], [7, 72]],
          [[1, 79], [3, 76], [5, 72], [7, 76]],
          [[1, 79], [3, 74], [5, 71], [7, 74]],
        ]),
      },
    ],
    hats: { gain: 0.016, dur: 0.04, freq: 6000, steps: [0, 1, 2, 3, 4, 5, 6, 7], accent: [2, 6] },
  },
  // フィーバー: gameを短3度上げ+密度アップ(138bpm)
  fever: {
    bpm: 138,
    steps: 32,
    parts: [
      {
        type: "sawtooth",
        gain: 0.075,
        dur: 0.14,
        notes: bars([
          [[0, 36], [1, 48], [2, 36], [3, 48], [4, 36], [5, 48], [6, 36], [7, 48]],
          [[0, 32], [1, 44], [2, 32], [3, 44], [4, 32], [5, 44], [6, 32], [7, 44]],
          [[0, 39], [1, 51], [2, 39], [3, 51], [4, 39], [5, 51], [6, 39], [7, 51]],
          [[0, 34], [1, 46], [2, 34], [3, 46], [4, 34], [5, 46], [6, 34], [7, 46]],
        ]),
      },
      {
        type: "square",
        gain: 0.038,
        dur: 0.1,
        notes: bars([
          [[0, 79], [1, 75], [2, 72], [3, 75], [4, 79], [5, 75], [6, 72], [7, 75]],
          [[0, 80], [1, 75], [2, 72], [3, 75], [4, 80], [5, 75], [6, 72], [7, 75]],
          [[0, 82], [1, 79], [2, 75], [3, 79], [4, 82], [5, 79], [6, 75], [7, 79]],
          [[0, 82], [1, 77], [2, 74], [3, 77], [4, 84], [5, 82], [6, 79], [7, 77]],
        ]),
      },
    ],
    hats: { gain: 0.02, dur: 0.035, freq: 7500, steps: [0, 1, 2, 3, 4, 5, 6, 7], accent: [0, 2, 4, 6] },
  },
};

let current: BgmTrack | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let bus: GainNode | null = null; // 曲全体の音量(フェード用)
let step = 0;
let nextTime = 0;

export function currentBgm(): BgmTrack | null {
  return current;
}

function stopNow(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (bus) {
    const a = getAudio();
    const old = bus;
    bus = null;
    if (a) {
      old.gain.setTargetAtTime(0, a.ctx.currentTime, 0.08);
      setTimeout(() => old.disconnect(), 400);
    } else {
      old.disconnect();
    }
  }
}

function scheduleStep(song: Song, t: number, s: number): void {
  const a = getAudio();
  if (!a || !bus) return;
  const { ctx } = a;
  for (const part of song.parts) {
    for (const [ns, m] of part.notes) {
      if (ns !== s) continue;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = part.type;
      osc.frequency.setValueAtTime(midi(m), t);
      g.gain.setValueAtTime(part.gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + part.dur);
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + part.dur + 0.02);
    }
  }
  const hats = song.hats;
  if (hats && hats.steps.includes(s % 8)) {
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hats.freq;
    const g = ctx.createGain();
    const gain = hats.accent?.includes(s % 8) ? hats.gain * 1.8 : hats.gain;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hats.dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + hats.dur + 0.02);
  }
}

export function setBgm(track: BgmTrack | null): void {
  if (track === current) return;
  current = track;
  stopNow();
  if (!track) return;
  const song = SONGS[track];
  const stepDur = 60 / song.bpm / 2; // 8分音符
  step = 0;
  nextTime = 0;
  timer = setInterval(() => {
    const a = getAudio();
    if (!a) return; // アンロック待ち
    if (!bus) {
      bus = a.ctx.createGain();
      bus.gain.value = 1;
      bus.connect(a.out);
      nextTime = a.ctx.currentTime + 0.06;
    }
    // 0.25秒ぶん先読みしてスケジュール
    while (nextTime < a.ctx.currentTime + 0.25) {
      scheduleStep(song, nextTime, step % song.steps);
      step++;
      nextTime += stepDur;
    }
  }, 100);
}
