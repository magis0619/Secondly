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
  PLAYER_R: 18.5,
  /** プレイヤーを画面上からこの割合の位置に */
  ANCHOR: 0.62,
} as const;

/** 動きの質感 */
export const MOTION = {
  /** カメラの上方向への先読み(行) */
  CAM_LOOKAHEAD: 0.7,
  CAM_RATE: 10,
  /** 着地時に足場が沈む量(unit)と戻る時間 */
  PLAT_DIP: 5,
  PLAT_DIP_TIME: 0.28,
  /** 着地後のキャラのぼよん時間 */
  LAND_SQUASH_TIME: 0.2,
} as const;

/** 高度ゾーン(背景の変化)。fromはそのゾーンが始まる高度 */
export interface Zone {
  from: number;
  name: string;
  skyTop: string;
  skyBottom: string;
  /** 足場に薄く乗せる色 */
  tint: string;
  deco: "dusk" | "night" | "clouds" | "space";
}

export const ZONES: Zone[] = [
  { from: 0, name: "ゆうぐれ", skyTop: "#41295e", skyBottom: "#c8613c", tint: "#c8613c", deco: "dusk" },
  { from: 25, name: "よぞら", skyTop: "#141d3e", skyBottom: "#233060", tint: "#38e1ff", deco: "night" },
  { from: 50, name: "くものうえ", skyTop: "#2b2558", skyBottom: "#54418c", tint: "#b48cff", deco: "clouds" },
  { from: 80, name: "うちゅう", skyTop: "#0a0f24", skyBottom: "#131a38", tint: "#ff4fa3", deco: "space" },
];

/** ゾーン境界の色ブレンド幅(m) */
export const ZONE_BLEND = 8;

/** フィーバーコンボ: ノーミスでREQ回登るとTIME秒間、1ホップごとにボーナス+BONUS m */
export const FEVER = {
  REQ: 12,
  TIME: 5,
  BONUS: 1,
} as const;

/** ほんばんのチケット: 1日DAILY回無料、広告1回でAD_REWARD回ぶん補充 */
export const TICKETS = {
  DAILY: 3,
  AD_REWARD: 3,
} as const;

/** きせかえ(バンダナ)。condは自動判定なので解放状態の保存は不要 */
export interface Skin {
  id: string;
  name: string;
  /** バンダナ色。"rainbow"は特別扱い(時間で色相回転) */
  color: string;
  cond: { type: "free" | "plays" | "best" | "support"; n: number };
  condText: string;
}

/** スキンIDからバンダナ色を得る(rainbowは時間tで色相回転) */
export function skinColor(id: string, t: number): string {
  const s = SKINS.find((k) => k.id === id) ?? SKINS[0];
  return s.color === "rainbow" ? `hsl(${Math.floor((t * 90) % 360)}, 90%, 62%)` : s.color;
}

export const SKINS: Skin[] = [
  { id: "pink", name: "ピンク", color: "#ff4fa3", cond: { type: "free", n: 0 }, condText: "さいしょから" },
  { id: "sky", name: "みずいろ", color: "#38b6ff", cond: { type: "plays", n: 10 }, condText: "10かい あそぶ" },
  { id: "green", name: "みどり", color: "#43d9a3", cond: { type: "plays", n: 30 }, condText: "30かい あそぶ" },
  { id: "purple", name: "むらさき", color: "#9b6bf3", cond: { type: "plays", n: 50 }, condText: "50かい あそぶ" },
  { id: "gold", name: "ゴールド", color: "#ffd166", cond: { type: "best", n: 50 }, condText: "ベスト50mいじょう" },
  { id: "rainbow", name: "レインボー", color: "rainbow", cond: { type: "best", n: 80 }, condText: "うちゅうに とうたつ(80m)" },
  { id: "star", name: "⭐しろ", color: "#f4f7ff", cond: { type: "support", n: 1 }, condText: "かいはつしゃを おうえん" },
];

/**
 * オンラインランキング(Firebase Firestore REST)。
 * projectId/apiKeyが空の間はオフラインモード(ローカルのみ)。
 * 設定手順はREADME参照。Sparkプラン無料枠で動作する。
 */
/**
 * 法務系リンク。privacyUrlを設定するとストア画面に「プライバシーポリシー」リンクが出る。
 * 広告/課金ありアプリの審査ではプライバシーポリシーURLが必須(docs/release-checklist.md参照)。
 * テンプレは docs/privacy-policy.md — GitHub Pages等で公開してURLをここに貼る。
 */
export const LEGAL = {
  privacyUrl: "", // 例: "https://<ユーザー名>.github.io/climb30-privacy/"
};

export const ONLINE = {
  projectId: "climb30-6f201", // 例: "climb30-xxxxx"
  apiKey: "AIzaSyAXuC6n6oFKJGVnJY0aTD7L5qAHbGF6oUk", // FirebaseコンソールのウェブAPIキー
  collection: "scores",
  TOP_N: 50,
  MAX_SCORE: 1000,
  NAME_MAX: 12,
};
