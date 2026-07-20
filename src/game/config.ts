/**
 * ★全チューニング定数の一元管理。バランス調整はこのファイルだけを触る。
 * 距離は「文字盤半径R = 1.0」の相対値、速度は R/秒、角度は度(deg)で記す。
 */

export const COLORS = {
  bg: "#0a0e1a",
  bgGlow: "#141d33",
  dial: "#25314f",
  dialBright: "#3a4a75",
  tickLit: "#3ec6ff",
  hand: "#eaf6ff",
  core: "#ffd166",
  danger: "#ff3b5c",
  enemy: {
    tick: "#38e1ff",
    rush: "#ff4fa3",
    chime: "#ffb84d",
  } as Record<string, string>,
  bullet: "#ffde7a",
  tier: ["#eaf6ff", "#38e1ff", "#ff4fa3"],
  text: "#eaf6ff",
  textDim: "#7f8db4",
};

export const HAND = {
  ROT_PERIOD: 3.0, // 1周にかかる秒数
  ROT_PERIOD_FAST: 2.5,
  ROT_FAST_AT: 45, // この経過秒から回転が速くなる
  IDLE_LEN: 0.88,
  SHRINK_LEN: 0.3,
  SHRINK_RATE: 20, // 縮み追従の速さ(damp係数)
  GROW_RATE: 12,
  CHARGE_T2: 0.45, // このホールド秒数でLv2
  CHARGE_T3: 0.95, // このホールド秒数でLv3(MAX)
  TIERS: [
    { len: 1.0, arcDeg: 22, power: 1, mult: 1 },
    { len: 1.06, arcDeg: 32, power: 2, mult: 1.5 },
    { len: 1.18, arcDeg: 45, power: 3, mult: 2 },
  ],
  HIT_TIME: 0.1, // 解放後、攻撃判定が生きている時間
  ANIM_TIME: 0.18, // 伸び→戻りのアニメ時間
  RECOVERY: 0.15, // 再チャージ不可時間
  AIM_OFFSET_DEG: 10, // 進行方向への判定オフセット(先読み補正)
  CRIT_BAND: 0.22, // 針の先端この割合の帯に当たるとクリティカル
  THICK: 0.022, // 弾との当たり判定に使う針の太さ(R比)
} as const;

export const CORE = {
  HP: 3,
  RADIUS: 0.09,
  INVULN: 1.0, // 被弾後の無敵秒数
} as const;

export const STAGE = {
  TIME: 60,
} as const;

export type EnemyKind = "tick" | "rush" | "chime";

export interface EnemyDef {
  hp: number;
  speed: number; // R/s(中心へ向かう速度)
  score: number;
  size: number; // 当たり半径(R比)
  telegraph: number; // スポーン予告の秒数
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  tick: { hp: 1, speed: 0.11, score: 100, size: 0.05, telegraph: 0.9 },
  rush: { hp: 1, speed: 0.242, score: 150, size: 0.045, telegraph: 1.2 },
  chime: { hp: 2, speed: 0.11, score: 300, size: 0.06, telegraph: 0.9 },
};

export const CHIME = {
  STOP_DIST: 0.95, // ここまで侵入して停止
  FIRE_INTERVAL: 2.2,
} as const;

export const BULLET = {
  SPEED: 0.28,
  SIZE: 0.02,
} as const;

export const SPAWN_DIST = 1.15;
export const CHIME_RESPAWN = 6; // Chime撃破後の再配置クールダウン
export const SPAWN_MIN_SEP_DEG = 90; // 直前スポーンとの最低角度差

export interface Phase {
  until: number; // この経過秒まで有効
  interval: number; // 通常スポーン間隔(Infinity=停止)
  weights: [EnemyKind, number][];
  chime: number; // 常時維持するChime数
  dual: boolean; // 対角同時スポーンを混ぜる
}

export const PHASES: Phase[] = [
  { until: 12, interval: 2.0, weights: [["tick", 1]], chime: 0, dual: false },
  { until: 24, interval: 1.4, weights: [["tick", 4], ["rush", 1]], chime: 0, dual: false },
  { until: 36, interval: 1.1, weights: [["tick", 3], ["rush", 2]], chime: 1, dual: false },
  { until: 48, interval: 0.85, weights: [["tick", 3], ["rush", 2]], chime: 2, dual: false },
  { until: 57, interval: 0.65, weights: [["tick", 1], ["rush", 1]], chime: 2, dual: true },
  { until: 999, interval: Infinity, weights: [["tick", 1]], chime: 0, dual: false },
];

export const SCORE = {
  CHAIN_WINDOW: 2.5, // この秒数以内の連続撃破でチェーン継続
  CHAIN_STEP: 0.1, // コンボ1につき+0.1倍
  CHAIN_MAX: 3.0,
  CRIT_MULT: 2,
  CLEAR_BONUS_PER_HP: 1000,
} as const;
