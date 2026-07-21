import type { EnemyKind, TileKind } from "./config.ts";
import { GRID, TILE_DROPS, PLAYER } from "./config.ts";
import type { CompiledStage } from "./terrain.ts";
import { CHAR_TILES, compileRows } from "./terrain.ts";

/**
 * 上昇型ステージ。チャンク(数行の設計パーツ)を縦に並べて合成する。
 * 配列は上から下の順(=先頭が頂上、末尾が底のスタート足場)。
 * 記号: # 壁 / . 空 / r 岩 / h 硬岩 / o 鉱石 / g ガラス床 / ^ トゲ / P 脱出パッド
 * c CP行 / 1 フワリ / 2 トゲマル / 3 砲台貝
 */
interface Chunk {
  rows: string[];
  /** 横風: -1=左, +1=右 */
  wind?: number;
}

const C: Record<string, Chunk> = {
  // 頂上: 脱出パッド(左右の隙間から上へ抜けて、上から着地する)
  exitTop: {
    rows: [
      "#...........#",
      "#...........#",
      "####PPPPP####",
      "#...........#",
      "#...........#",
    ],
  },
  // 底: スタート足場
  startBottom: {
    rows: [
      "#...........#",
      "#...........#",
      "#...........#",
      "#############",
    ],
  },
  air2: { rows: ["#...........#", "#...........#"] },
  cp: { rows: ["#...........#", "#c..........#", "#...........#"] },
  // 休憩足場(着地=フルリロード)。ギャップから上へ抜ける
  restL: { rows: ["#...........#", "#########...#", "#...........#"] },
  restR: { rows: ["#...........#", "#...#########", "#...........#"] },
  restMid: { rows: ["#...........#", "#####...#####", "#...........#"] },
  glassRest: { rows: ["#...........#", "#..ggggggg..#", "#...........#"] },
  // 岩盤天井: 上に撃って貫くか(反動で押し下げられる)、横の隙間へ回るか
  ceilRock: { rows: ["#...........#", "#..rrrrrr...#", "#...........#"] },
  ceilRockR: { rows: ["#...........#", "#...rrrrrr..#", "#...........#"] },
  ceilHard: { rows: ["#...........#", "#...hhhhhh..#", "#...........#"] },
  // 煙突(細い縦道)
  chimney: {
    rows: [
      "#...........#",
      "####.....####",
      "####..o..####",
      "####.....####",
      "#...........#",
    ],
  },
  oreVein: {
    rows: [
      "#..o........#",
      "#.oo....r...#",
      "#.......o...#",
      "#...........#",
    ],
  },
  rocksAir: {
    rows: [
      "#....r......#",
      "#.r......r..#",
      "#......r....#",
      "#...........#",
    ],
  },
  fuwariAir: { rows: ["#...........#", "#...1...1...#", "#...........#"] },
  fuwariOne: { rows: ["#...........#", "#.....1.....#", "#...........#"] },
  togePlat: {
    rows: [
      "#...........#",
      "#....2......#",
      "#########...#",
      "#...........#",
    ],
  },
  togePlatR: {
    rows: [
      "#...........#",
      "#......2....#",
      "#...#########",
      "#...........#",
    ],
  },
  houdaiL: { rows: ["#...........#", "#3..........#", "#...........#"] },
  houdaiR: { rows: ["#...........#", "#..........3#", "#...........#"] },
  spikeCeil: {
    rows: [
      "#...........#",
      "#.###.......#",
      "#.^^^.......#",
      "#...........#",
    ],
  },
};

const windL = (name: string): Chunk => ({ rows: C[name].rows, wind: -1 });
const windR = (name: string): Chunk => ({ rows: C[name].rows, wind: 1 });

export interface StageDef {
  id: number;
  name: string;
  parTime: number;
  /** 溶岩の上昇速度(行/s) */
  lavaSpeed: number;
  /** 地層の基調色(上→下) */
  palette: string[];
  chunks: Chunk[];
}

export const STAGES: StageDef[] = [
  {
    id: 1,
    name: "大噴火イントロ",
    parTime: 60,
    lavaSpeed: 0.85,
    palette: ["#233150", "#1e2a46", "#19233c"],
    chunks: [
      C.exitTop, C.fuwariOne, C.restMid, C.oreVein, C.cp,
      C.restL, C.rocksAir, C.fuwariAir, C.restR, C.oreVein, C.cp,
      C.restMid, C.rocksAir, C.fuwariOne, C.restL, C.air2,
      C.startBottom,
    ],
  },
  {
    id: 2,
    name: "風の煙突",
    parTime: 85,
    lavaSpeed: 1.05,
    palette: ["#1e3242", "#192c3e", "#142536"],
    chunks: [
      C.exitTop, C.ceilRock, C.restMid, C.cp,
      windR("rocksAir"), windR("fuwariAir"), C.restL, windR("oreVein"), C.cp,
      C.chimney, C.togePlat, C.air2, C.restR, C.cp,
      windL("rocksAir"), windL("fuwariOne"), C.restMid, C.oreVein, C.air2,
      C.startBottom,
    ],
  },
  {
    id: 3,
    name: "崩れる大空洞",
    parTime: 110,
    lavaSpeed: 1.2,
    palette: ["#33202e", "#2b1b28", "#221520"],
    chunks: [
      C.exitTop, C.ceilHard, C.glassRest, C.cp,
      C.houdaiL, C.rocksAir, C.glassRest, C.fuwariAir, C.cp,
      C.spikeCeil, C.togePlatR, C.ceilRockR, C.restL, C.cp,
      C.houdaiR, C.chimney, C.glassRest, C.oreVein, C.fuwariOne, C.air2,
      C.startBottom,
    ],
  },
];

/** チャンクを連結してステージをコンパイル */
export function buildStage(def: StageDef): CompiledStage {
  const rows: string[] = [];
  const winds: [number, number, number][] = [];
  for (const ch of def.chunks) {
    if (ch.wind) winds.push([rows.length, rows.length + ch.rows.length, ch.wind * 4]);
    rows.push(...ch.rows);
  }
  return compileRows(rows, winds);
}

/**
 * devバリデータ(理不尽・詰みの機械検出):
 *  1) 全行13文字・未知文字なし・脱出パッドが上部にある
 *  2) 通行可能性: パッドより下の全行(底の床を除く)に通行可能な連続2マス以上の隙間
 *  3) 足場間隔: 連続する「着地可能行」の間隔 ≤ 14行(弾タンクで登り切れる距離)
 *  4) 弾収支: CP区間ごとの入手可能弾 ≥ 想定消費(行数×1.2)
 */
export function validateStage(def: StageDef): string[] {
  const errors: string[] = [];
  const compiled = buildStage(def);
  const t = compiled.terrain;
  const rows: string[] = def.chunks.flatMap((c) => c.rows);

  rows.forEach((line, r) => {
    if (line.length !== GRID.COLS) errors.push(`row ${r}: 幅${line.length}(13必要)`);
    for (const ch of line) if (!(ch in CHAR_TILES)) errors.push(`row ${r}: 未知の文字 "${ch}"`);
  });
  if (t.padRow < 0) errors.push("脱出パッドがない");
  else if (t.padRow > 8) errors.push(`脱出パッドが上部にない(row ${t.padRow})`);
  if (errors.length > 0) return errors;

  const passable = (k: TileKind) => k !== "wall" && k !== "spike" && k !== "lava";

  // 通行可能ギャップ(底の床行は除く)
  for (let r = t.padRow + 1; r < t.rows - 1; r++) {
    let best = 0;
    let run = 0;
    for (let c2 = 0; c2 < t.cols; c2++) {
      run = passable(t.tiles[r * t.cols + c2]) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    if (best < 2) errors.push(`row ${r}: 通行可能な隙間(2マス)がない`);
  }

  // 足場間隔(着地可能行 = 固体タイルが4つ以上ある行)
  const landable: number[] = [];
  for (let r = t.padRow; r < t.rows; r++) {
    let solids = 0;
    for (let c2 = 0; c2 < t.cols; c2++) {
      const k = t.tiles[r * t.cols + c2];
      if (k !== "empty" && k !== "spike" && k !== "lava") solids++;
    }
    if (solids >= 4) landable.push(r);
  }
  for (let i = 0; i + 1 < landable.length; i++) {
    const gap = landable[i + 1] - landable[i];
    if (gap > 14) errors.push(`row ${landable[i]}〜${landable[i + 1]}: 足場間隔${gap}行(>14)`);
  }

  // 弾収支(CP区間ごと)
  const cps = [0, ...t.checkpoints, t.rows];
  for (let s = 0; s < cps.length - 1; s++) {
    const [a, b] = [cps[s], cps[s + 1]];
    let supply = PLAYER.CP_AMMO + PLAYER.AMMO_START * (s === cps.length - 2 ? 1 : 0);
    for (let r = a; r < b; r++) {
      for (let c2 = 0; c2 < t.cols; c2++) {
        const drop = TILE_DROPS[t.tiles[r * t.cols + c2]];
        if (drop) supply += drop.ammoShards * 2;
      }
    }
    for (const e of compiled.enemies) {
      if (e.row >= a && e.row < b) supply += 6;
    }
    const need = (b - a) * 1.2;
    if (supply < need) {
      errors.push(`CP区間${s}(${a}-${b}): 弾収支不足 供給${supply} < 想定消費${Math.round(need)}`);
    }
  }
  return errors;
}

export function validateAllStages(): void {
  for (const s of STAGES) {
    for (const e of validateStage(s)) console.error(`[stage ${s.id} ${s.name}] ${e}`);
  }
}

export type { EnemyKind };
