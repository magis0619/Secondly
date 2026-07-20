/**
 * ★全チューニング定数の一元管理。バランス調整はこのファイルだけを触る。
 * 座標はタイル単位(col=横列0..6中心値, depth=行の連続値)。速度は 行/秒・列/秒。
 *
 * 【公平性の不変条件】DASHの最大距離(TIERS[2].rows=11) < 画面の先読み行数(約12行)。
 * これを破ると「見えない場所へ突っ込む理不尽」が生まれるので、rows か
 * カメラアンカー(CAMERA.ANCHOR_RATIO)を変えるときは必ず両方を確認すること。
 */

export const COLORS = {
  bg: "#0a0e1a",
  bgGlow: "#141d33",
  sky: "#16213f",
  text: "#eaf6ff",
  textDim: "#7f8db4",
  danger: "#ff3b5c",
  coin: "#ffd166",
  machine: "#eaf6ff",
  drill: "#3ec6ff",
  tier: ["#eaf6ff", "#38e1ff", "#ff4fa3"],
  wall: "#111a30",
  tile: {
    rock: "#6b7694",
    rockDark: "#4a5470",
    steel: "#aebcd8",
    steelDark: "#7d8cb0",
    ore: "#ffd166",
    gem: "#b48cff",
    lava: "#ff5a3c",
    lavaGlow: "#ffb03c",
    gas: "#7dff8a",
    core: "#ffd166",
  },
} as const;

export const GRID = {
  COLS: 7,
  /** タイル1辺 = TILE_UNITS * vp.unit (unit=短辺/400 → 7列で350unit+左右の岩壁帯) */
  TILE_UNITS: 46,
} as const;

export const CAMERA = {
  /** 機体を画面上からこの割合の位置に置く(下に約12行の先読みを確保) */
  ANCHOR_RATIO: 0.3,
  FOLLOW: 8, // damp係数
  FOLLOW_DASH: 16,
} as const;

export const MACHINE = {
  HP: 3,
  INVULN: 1.0,
  /** 自動掘削の降下速度(行/s)。土・鉱石などのソフト地形のみ */
  DRILL_SPEED: 1.6,
  /** 空洞での落下速度(行/s) */
  FALL_SPEED: 7,
  /** 横移動: 空洞・掘削済み空間での追従damp係数 */
  SIDE_FOLLOW: 14,
  /** 横移動: 土を削りながら進む速度(列/s) */
  SIDE_DIG_SPEED: 1.7,
  /** ドラッグ感度(画面上でタイル1枚ぶん動かすと機体が何列動くか) */
  DRAG_SENS: 1.35,
  /** キーボード←→の移動速度(列/s) */
  KEY_SPEED: 5,
  /** 機体の当たり半径(タイル比) */
  HITBOX: 0.34,
  /** 被弾時に押し戻される行数 */
  KNOCKBACK_ROWS: 0.7,
  /** これ未満のチャージで離してもダッシュしない(操縦ドラッグの誤爆防止) */
  CHARGE_T1: 0.22,
  CHARGE_T2: 0.45,
  CHARGE_T3: 0.95,
  /** このフレーム移動量(列)を超えるドラッグを「操縦中」とみなす */
  CHARGE_MOVE_EPS: 0.015,
  /** 最後のドラッグからこの秒数はチャージが増えない(タッチイベントの粒度対策) */
  CHARGE_MOVE_LOCK: 0.18,
  /** ダッシュ3ティア: 最大行数 / 速度(行/s) / 破壊可能硬度(1=岩, 2=鉄骨) */
  TIERS: [
    { rows: 4, speed: 14, power: 1, label: "Lv1" },
    { rows: 7, speed: 16, power: 2, label: "Lv2" },
    { rows: 11, speed: 18, power: 2, label: "MAX" },
  ],
  HURT_TIME: 0.35,
} as const;

export type TileKind =
  | "empty"
  | "dirt"
  | "rock"
  | "steel"
  | "ore"
  | "gem"
  | "lava"
  | "gas"
  | "core";

/** タイル特性。hardness: 0=ソフト(自動掘削可) 1=岩 2=鉄骨 99=破壊不可 */
export const TILE_DEFS: Record<TileKind, { hardness: number; hazard: boolean }> = {
  empty: { hardness: 0, hazard: false },
  dirt: { hardness: 0, hazard: false },
  ore: { hardness: 0, hazard: false },
  gem: { hardness: 0, hazard: false },
  gas: { hardness: 0, hazard: true }, // 触れるとダメージ、ダッシュ中は無害に破壊
  rock: { hardness: 1, hazard: false },
  steel: { hardness: 2, hazard: false },
  lava: { hardness: 99, hazard: true }, // 破壊不可。重なるとダメージ
  core: { hardness: 0, hazard: false }, // 接触=ステージクリア
};

export const SCORE = {
  /** 貫通コンボ: 1ダッシュで壊したタイル数nに対し SMASH_BASE * n * n */
  SMASH_BASE: 30,
  ORE: 50,
  GEM: 250,
  ORE_COINS: 1,
  GEM_COINS: 5,
  /** ダッシュ中の鉱石取得は倍 */
  DASH_PICKUP_MULT: 2,
  TIME_BONUS_PER_SEC: 100,
  HP_BONUS: 500,
  /** 失敗時のコイン持ち帰り率 */
  FAIL_COIN_RATE: 0.5,
} as const;

export interface UpgradeDef {
  key: "chargeSpeed" | "armor";
  name: string;
  desc: string;
  max: number;
  costs: number[]; // レベルごとの価格
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    key: "chargeSpeed",
    name: "ハイスピードバネ",
    desc: "チャージ時間 -12% / Lv",
    max: 2,
    costs: [30, 90],
  },
  {
    key: "armor",
    name: "アーマープレート",
    desc: "HP +1 / Lv",
    max: 2,
    costs: [50, 140],
  },
];

/** chargeSpeed Lv1つきのチャージ閾値短縮率 */
export const CHARGE_SPEED_PER_LV = 0.12;

/** セーブから導出してWorldへ渡す実効値(Worldはストレージを直接読まない) */
export interface RunMods {
  chargeT2: number;
  chargeT3: number;
  maxHp: number;
}

export function modsFromUpgrades(up: { chargeSpeed: number; armor: number }): RunMods {
  const k = 1 - CHARGE_SPEED_PER_LV * up.chargeSpeed;
  return {
    chargeT2: MACHINE.CHARGE_T2 * k,
    chargeT3: MACHINE.CHARGE_T3 * k,
    maxHp: MACHINE.HP + up.armor,
  };
}
