/**
 * ★全チューニング定数の一元管理(RECOIL DIVER)。バランス調整はこのファイルだけを触る。
 * 座標系: タイル単位。x=列(0..COLS-1)、y=行(下が正)。1行=深度1m。速度は タイル/秒。
 */

export const COLORS = {
  bg: "#0a0e1a",
  bgGlow: "#141d33",
  sky: "#16213f",
  text: "#eaf6ff",
  textDim: "#7f8db4",
  danger: "#ff3b5c",
  warn: "#ffb03c",
  gem: "#ffd166",
  ammo: "#ffde7a",
  player: "#eaf6ff",
  aim: "#38e1ff",
  tier: ["#eaf6ff", "#38e1ff", "#ff4fa3"],
  wall: "#1c2743",
  wallEdge: "#2c3a63",
  tile: {
    rock: "#6d5138",
    rockDark: "#523b28",
    hard: "#6b7694",
    hardDark: "#4a5470",
    ore: "#ffd166",
    glass: "#8fd8ff",
    spike: "#ff3b5c",
    lava: "#ff5a3c",
    lavaGlow: "#ffb03c",
    pad: "#7dff8a",
  },
  enemy: {
    fuwari: "#e8f4ff", // 白=踏める
    hane: "#d8e8ff",
    togemaru: "#ff4fa3", // 赤=踏めない
    houdai: "#ff6a5c",
  } as Record<string, string>,
  overdrive: "#ff4fa3",
} as const;

export const GRID = {
  COLS: 13,
  /** タイル1辺 = TILE_UNITS * vp.unit(unit=短辺/400 → 13列で390units) */
  TILE_UNITS: 30,
} as const;

export const CAMERA = {
  /** 進行方向=上を広く見せる(プレイヤーは画面のこの割合の位置。下は溶岩監視用) */
  ANCHOR_RATIO: 0.6,
  FOLLOW_DOWN: 10,
  FOLLOW_UP: 8,
} as const;

export const PHYS = {
  // 「世界を約35%減速+1発の反動を重く」のチューニング(操作過負荷対策)
  GRAVITY: 17, // タイル/s²
  TERMINAL: 10.5, // 最大落下速度
  AIR_DRAG: 0.7, // 横速度の減衰(/s)。低め=横の勢いが残る
  PLAYER_R: 0.36, // プレイヤー半サイズ(AABB半幅、タイル)
  /** この落下速度以下で接地=無傷。超過は激突ダメージ */
  SAFE_LAND: 8,
  STOMP_BOUNCE: -8.5, // 踏みつけ後の跳ね上がり
  KNOCKBACK: 6,
} as const;

export const LAVA = {
  /** プレイヤーがこの行数以上先行したら追い上げ加速(追いつくまで) */
  CATCHUP_LEAD: 12,
  CATCHUP_MULT: 2.2,
  /** 接触時: 1ダメージ+この速度で上に打ち上げ(リカバリー可能) */
  BOUNCE_VY: -14,
  /** この距離(行)以内で警告演出 */
  WARN_ROWS: 3.5,
} as const;

export const PLAYER = {
  HP: 3,
  INVULN: 1.2,
  AMMO_START: 30,
  CP_AMMO: 15, // チェックポイント通過時にこの値まで無条件回復
  MAGNET_R: 2.4, // 破片吸引半径(タイル)
} as const;

export type WeaponId = "machinegun" | "shotgun";

export interface WeaponDef {
  name: string;
  rate: number; // 発/s
  impulse: number; // 1発の反動(タイル/s)
  cost: number; // 弾消費
  dmg: number;
  speed: number; // 弾速
  range: number; // 射程(タイル)
  spreadDeg: number;
  pellets: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // 1発の反動を重く(下1発でふわっと1〜2行浮く)。持続推力 = rate×impulse ≈ 36 > 重力17
  machinegun: { name: "マシンガン", rate: 5.5, impulse: 6.5, cost: 1, dmg: 1, speed: 42, range: 12, spreadDeg: 4, pellets: 1 },
  shotgun: { name: "ショットガン", rate: 2.2, impulse: 14, cost: 3, dmg: 1, speed: 38, range: 6.5, spreadDeg: 24, pellets: 5 },
};

export type TileKind =
  | "empty"
  | "wall" // 破壊不可
  | "rock" // 1発。弾ドロップ
  | "hard" // 3発。弾ドロップ多め
  | "ore" // 1発。ジェム+弾
  | "glass" // 乗ると割れる足場(射撃でも割れる)
  | "spike" // 静的ハザード(すり抜けるがダメージ)
  | "lava" // 静的ハザード
  | "pad"; // ゴール

export const TILE_HP: Partial<Record<TileKind, number>> = {
  rock: 1,
  hard: 3,
  ore: 1,
  glass: 1,
};

export const GLASS_BREAK_DELAY = 0.45; // 乗ってから割れるまで

/** タイル破壊時のドロップ(破片個数) */
export const TILE_DROPS: Partial<Record<TileKind, { ammoShards: number; gems: number }>> = {
  rock: { ammoShards: 2, gems: 0 }, // 1個+2発 → 岩1つで+4発(採掘1発消費→純益+3)
  hard: { ammoShards: 4, gems: 1 },
  ore: { ammoShards: 2, gems: 2 },
  glass: { ammoShards: 0, gems: 0 },
};

export const PICKUP = {
  AMMO_PER_SHARD: 2,
  GRAVITY_K: 0.55, // 破片にかかる重力の係数
  BOUNCE: 0.45,
  LIFE: 9,
  MAGNET_ACCEL: 60,
  COLLECT_R: 0.5,
} as const;

export type EnemyKind = "fuwari" | "togemaru" | "houdai";

export interface EnemyDef {
  hp: number;
  r: number;
  stompable: boolean; // 白=true / 赤=false
  gems: number;
  ammoShards: number;
  score: number;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  fuwari: { hp: 1, r: 0.42, stompable: true, gems: 1, ammoShards: 1, score: 100 },
  togemaru: { hp: 2, r: 0.44, stompable: false, gems: 2, ammoShards: 2, score: 150 },
  houdai: { hp: 3, r: 0.5, stompable: false, gems: 4, ammoShards: 3, score: 300 },
};

export const ENEMY_AI = {
  FUWARI_AMP: 0.9, // 上下浮遊の振幅(タイル)
  FUWARI_SPEED: 1.4,
  TOGE_SPEED: 1.3, // 左右パトロール速度(世界減速に同調)
  HOUDAI_IDLE: 1.6,
  HOUDAI_AIM: 0.9, // レーザーサイト予告時間
  HOUDAI_SHOT_SPEED: 4.5,
  HOUDAI_RANGE: 11, // この距離(タイル)以内かつ画面内でのみ起動
  ENEMY_BULLET_R: 0.18,
} as const;

export const COMBO = {
  /** 接地せず破壊・撃破を続けると+1。接地で確定しジェムボーナス化 */
  BANK_GEM_PER: 0.5, // 確定時: combo × これ(端数切捨)をジェム加算
  OVERDRIVE_AT: 10,
  OVERDRIVE_TIME: 4, // 弾消費ゼロの秒数
  PRAISE_AT: 8,
} as const;

export const SCORE = {
  TILE: 20,
  /** クリア時、溶岩との距離1行につき加点(余裕クリアボーナス) */
  LAVA_MARGIN: 50,
  HP_BONUS: 500,
  TIME_BONUS_PER_SEC: 100,
  GEM_SCORE: 30,
} as const;

export interface UpgradeDef {
  key: "magazine" | "armor";
  name: string;
  desc: string;
  max: number;
  costs: number[];
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  { key: "magazine", name: "拡張弾倉", desc: "弾の上限 +10 / Lv", max: 2, costs: [40, 100] },
  { key: "armor", name: "アーマープレート", desc: "HP +1 / Lv", max: 2, costs: [60, 150] },
];

export const SHOTGUN_COST = 120;

/** セーブから導出してWorldへ渡す実効値(Worldはストレージを直接読まない) */
export interface RunMods {
  maxHp: number;
  maxAmmo: number;
  weapon: WeaponId;
}

export function modsFrom(up: { magazine: number; armor: number }, weapon: WeaponId): RunMods {
  return {
    maxHp: PLAYER.HP + up.armor,
    maxAmmo: PLAYER.AMMO_START + up.magazine * 10,
    weapon,
  };
}
