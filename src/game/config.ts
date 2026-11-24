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
  HOP_TIME: 0.10,
  /** ホップ中でもこの時刻以降なら次のタップを受け付ける(テンポ優先) */
  HOP_BUFFER: 0.04,
  /** 落下: 基本+1段ごとの加算(上限) */
  FALL_BASE: 0.16,
  FALL_PER_STEP: 0.05,
  FALL_MAX: 0.7,
  /** 試験: 今乗っている足場と同じ側をタップしても(間違いでも)落下させず無視する */
  SAFE_SAME_SIDE: true,
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
  deco: "dusk" | "night" | "clouds" | "space" | "galaxy";
}

export const ZONES: Zone[] = [
  { from: 0, name: "ゆうぐれ", skyTop: "#41295e", skyBottom: "#c8613c", tint: "#c8613c", deco: "dusk" },
  { from: 35, name: "よぞら", skyTop: "#141d3e", skyBottom: "#233060", tint: "#38e1ff", deco: "night" },
  { from: 75, name: "くものうえ", skyTop: "#2b2558", skyBottom: "#54418c", tint: "#b48cff", deco: "clouds" },
  { from: 120, name: "うちゅう", skyTop: "#0a0f24", skyBottom: "#131a38", tint: "#ff4fa3", deco: "space" },
  { from: 170, name: "ぎんが", skyTop: "#050416", skyBottom: "#241046", tint: "#c774ff", deco: "galaxy" },
];

/** ゾーン境界の色ブレンド幅(m) */
export const ZONE_BLEND = 8;

/**
 * フィーバーコンボ: ノーミスでREQ回登るとTIME秒間フィーバー。
 * フィーバー中は足場が中央1本になり、どちらをタップしても登れる(=連打で登る)。
 * ホップも速くなる(HOP_TIME)。スコアボーナスはなし(高さがそのまま伸びる)。
 */
export const FEVER = {
  REQ: 20,
  TIME: 4,
  HOP_TIME: 0.04,
} as const;

/** アプリバージョン(設定画面に表示) */
export const VERSION = "1.0.0";

/** ほんばんのチケット: 1日DAILY回無料、広告1回でAD_REWARD回ぶん補充 */
export const TICKETS = {
  DAILY: 3,
  AD_REWARD: 3,
} as const;

/**
 * 連続ログインボーナス。毎日1回起動すると連続日数が伸び(1日でも空くと1に戻る)、
 * 2日目以降はほんばんチケットがもらえる。WEEK日ごと(7,14,…日目)は大きめ。
 * 最長記録が7日に届くときせかえ(ほのお)が解放される(config.SKINSのstreak条件)。
 */
export const STREAK = {
  DAILY_BONUS: 1,
  WEEK: 7,
  WEEK_BONUS: 3,
} as const;

/** きせかえの解放条件(スキン/キャラ共通)。実績から自動判定なので解放状態の保存は不要 */
export interface UnlockCond {
  type: "free" | "plays" | "best" | "support" | "rankedBest" | "totalM" | "fever" | "streak";
  n: number;
}

/** きせかえ(バンダナ) */
export interface Skin {
  id: string;
  name: string;
  /** バンダナ色。"rainbow"は特別扱い(時間で色相回転) */
  color: string;
  cond: UnlockCond;
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
  { id: "gold", name: "ゴールド", color: "#ffd166", cond: { type: "best", n: 70 }, condText: "ベスト70mいじょう" },
  { id: "rainbow", name: "レインボー", color: "rainbow", cond: { type: "best", n: 120 }, condText: "うちゅうに とうたつ(120m)" },
  { id: "star", name: "⭐しろ", color: "#f4f7ff", cond: { type: "support", n: 1 }, condText: "かいはつしゃを おうえん" },
  { id: "sakura", name: "さくら", color: "#ffc7dd", cond: { type: "rankedBest", n: 50 }, condText: "ほんばんベスト50m" },
  { id: "silver", name: "シルバー", color: "#cdd6e4", cond: { type: "totalM", n: 500 }, condText: "つうさん500m のぼる" },
  { id: "midnight", name: "ミッドナイト", color: "#31408f", cond: { type: "fever", n: 10 }, condText: "フィーバー10かい" },
  { id: "black", name: "くろ", color: "#3a4152", cond: { type: "plays", n: 100 }, condText: "100かい あそぶ" },
  { id: "flame", name: "ほのお", color: "#ff7a2f", cond: { type: "streak", n: 7 }, condText: "7にち れんぞくログイン" },
];

/** キャラクター(体型・パーツが変わる)。バンダナ(SKINS)とは独立に選べる */
export interface Chara {
  id: string;
  name: string;
  cond: UnlockCond;
  condText: string;
}

export const CHARAS: Chara[] = [
  { id: "pico", name: "ピコ", cond: { type: "free", n: 0 }, condText: "さいしょから" },
  { id: "pengin", name: "ペンギン", cond: { type: "rankedBest", n: 60 }, condText: "ほんばんベスト60m" },
  { id: "obake", name: "おばけ", cond: { type: "best", n: 90 }, condText: "ベスト90m(くものうえ とっぱ)" },
  { id: "neko", name: "ネコ", cond: { type: "totalM", n: 1000 }, condText: "つうさん1000m のぼる" },
];

/**
 * オンラインランキング(Firebase Firestore REST)。
 * projectId/apiKeyが空の間はオフラインモード(ローカルのみ)。
 * 設定手順はREADME参照。Sparkプラン無料枠で動作する。
 */
/**
 * 法務系リンク。privacyUrlを設定するとストア画面に「プライバシーポリシー」リンクが出る。
 * 広告/課金ありアプリの審査ではプライバシーポリシーURLが必須(docs/release-checklist.md参照)。
 * テンプレは docs/privacy-policy.md — Firebase Hosting等で公開してURLをここに貼る(手順は7章)。
 */
export const LEGAL = {
  privacyUrl: "https://climb30-privacy.web.app/",
  // SNSシェアに載せるURL。当面はマーケサイト。App Store公開後はストアURLに差し替え可
  marketingUrl: "https://climb30-marketing.web.app/",
};

export const ONLINE = {
  projectId: "climb30-6f201", // 例: "climb30-xxxxx"
  apiKey: "AIzaSyAXuC6n6oFKJGVnJY0aTD7L5qAHbGF6oUk", // FirebaseコンソールのウェブAPIキー
  collection: "scores",
  TOP_N: 50,
  // 理論上の最速連打でも30秒で300段強が限度。1000のままだと改ざん値が紛れ込みやすいため
  // 実際に届きうる上限より少し余裕を持たせた400に制限する(Firestoreルールも合わせて更新すること)。
  MAX_SCORE: 400,
  NAME_MAX: 12,
  /** ゴーストの最大キー数(これ以上は保存/送信しない。実プレイの上限は300強) */
  GHOST_MAX_KEYS: 450,
};
