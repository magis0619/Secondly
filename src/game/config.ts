/**
 * ★全チューニング定数(CLIMB 30)。調整はこのファイルだけを触る。
 */

export const COLORS = {
  bg: "#0a0e1a",
  bgTop: "#2b3a6b", // 高く登るほどこの色へ
  text: "#eaf6ff",
  textDim: "#7f8db4",
  danger: "#ff3b5c",
  accent: "#38e1ff",
  accent2: "#ff4fa3",
  gold: "#ffd166",
  platform: "#4a5a8c",
  platformTop: "#6c7fc4",
  ground: "#3a4a75",
  player: "#eaf6ff",
  fog: "#0a0e1a",
} as const;

export const GAME = {
  /** 制限時間(秒) */
  TIME: 30,
  /** 開始カウントダウン(3,2,1) */
  COUNTDOWN: 3,
  /** 同一サイドの連続の上限(極端な破滅の防止) */
  MAX_RUN: 7,
  /** ホップのアニメ時間 */
  HOP_TIME: 0.13,
  /** ホップ中でもこの時刻以降なら次のタップを受け付ける(テンポ優先) */
  HOP_BUFFER: 0.08,
  /** 落下: 基本+1段ごとの加算(上限) */
  FALL_BASE: 0.16,
  FALL_PER_STEP: 0.05,
  FALL_MAX: 0.7,
  /** 残りこの秒数からtick音+赤表示 */
  URGENT: 5,
  /** TIME UP後、リザルトへ移るまでの間 */
  END_DELAY: 1.3,
} as const;

/** 画面レイアウト(unit=短辺/400 基準) */
export const LAYOUT = {
  COL_OFFSET: 78, // 塔の中心から左右足場の中心まで
  STEP_H: 84, // 1段の高さ
  PLAT_W: 108,
  PLAT_H: 16,
  PLAYER_R: 15,
  /** プレイヤーを画面上からこの割合の位置に */
  ANCHOR: 0.62,
} as const;
