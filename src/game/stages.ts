import type { EnemyKind, TileKind } from "./config.ts";
import { GRID, TILE_DROPS, PLAYER } from "./config.ts";
import type { CompiledStage } from "./terrain.ts";
import { CHAR_TILES, compileRows } from "./terrain.ts";

/**
 * ステージは「チャンク(数行の設計パーツ)」を縦に並べて合成する。
 * チャンク行は幅13文字。記号: # 壁 / . 空 / r 岩 / h 硬岩 / o 鉱石 / g ガラス床
 * ^ トゲ / L 溶岩 / P 着地パッド / c CP行 / 1 フワリ / 2 トゲマル / 3 砲台貝
 */
interface Chunk {
  rows: string[];
  /** 横風: -1=左, +1=右(このチャンクの行範囲に適用) */
  wind?: number;
}

const C: Record<string, Chunk> = {
  intro: {
    rows: [
      "#...........#",
      "#...........#",
      "#....r.r....#",
      "#...........#",
      "#..r......r.#",
      "#...........#",
    ],
  },
  rocksA: {
    rows: [
      "#...........#",
      "#..r...r....#",
      "#...........#",
      "#....rr.....#",
      "#.r.......r.#",
      "#......r....#",
      "#...........#",
    ],
  },
  rocksB: {
    rows: [
      "#...........#",
      "#....r...r..#",
      "#.r.........#",
      "#.....rr....#",
      "#..r......r.#",
      "#...........#",
    ],
  },
  oreL: {
    rows: [
      "#...........#",
      "#oo.........#",
      "#ro..r......#",
      "#...........#",
      "#......ro...#",
      "#.........oo#",
      "#...........#",
    ],
  },
  oreR: {
    rows: [
      "#...........#",
      "#.........oo#",
      "#......r..or#",
      "#...........#",
      "#...or......#",
      "#oo.........#",
      "#...........#",
    ],
  },
  fuwari1: {
    rows: [
      "#...........#",
      "#....1......#",
      "#...........#",
      "#.r.......r.#",
      "#........1..#",
      "#...........#",
    ],
  },
  fuwari2: {
    rows: [
      "#...........#",
      "#..1....1...#",
      "#...........#",
      "#.....r.....#",
      "#...........#",
    ],
  },
  ledges: {
    rows: [
      "#...........#",
      "#.^^^.......#",
      "#.###.......#",
      "#...........#",
      "#.......^^^.#",
      "#.......###.#",
      "#...........#",
    ],
  },
  narrow: {
    rows: [
      "#...........#",
      "##.........##",
      "###...r...###",
      "####......###",
      "###.......###",
      "##.....r...##",
      "#...........#",
    ],
  },
  hardGate: {
    rows: [
      "#...........#",
      "#..hhh......#",
      "#...........#",
      "#......hhh..#",
      "#...........#",
    ],
  },
  toge: {
    rows: [
      "#...........#",
      "#....2......#",
      "#...........#",
      "#..r.....r..#",
      "#.......2...#",
      "#...........#",
    ],
  },
  glass: {
    rows: [
      "#...........#",
      "#..ggggg....#",
      "#...........#",
      "#....ggggg..#",
      "#...........#",
    ],
  },
  houdaiL: {
    rows: [
      "#...........#",
      "#3..........#",
      "#...........#",
      "#......r....#",
      "#...........#",
    ],
  },
  houdaiR: {
    rows: [
      "#...........#",
      "#..........3#",
      "#...........#",
      "#...r.......#",
      "#...........#",
    ],
  },
  lavaPool: {
    rows: [
      "#...........#",
      "#...........#",
      "#LLL.....LLL#",
      "#####...#####",
      "#...........#",
    ],
  },
  cavern: {
    rows: [
      "#...........#",
      "#...........#",
      "#.....1.....#",
      "#...........#",
      "#...........#",
      "#..1.....1..#",
      "#...........#",
      "#...........#",
    ],
  },
  cp: {
    rows: [
      "#...........#",
      "#c..........#",
      "#...........#",
    ],
  },
  pad: {
    rows: [
      "#...........#",
      "#...........#",
      "#...........#",
      "####PPPPP####",
      "#############",
    ],
  },
};

const windL = (name: string): Chunk => ({ rows: C[name].rows, wind: -1 });
const windR = (name: string): Chunk => ({ rows: C[name].rows, wind: 1 });

export interface StageDef {
  id: number;
  name: string;
  parTime: number;
  /** 地層の基調色(浅→深) */
  palette: string[];
  chunks: Chunk[];
}

export const STAGES: StageDef[] = [
  {
    id: 1,
    name: "採掘孔イントロ",
    parTime: 45,
    palette: ["#233150", "#1e2a46", "#19233c"],
    chunks: [
      C.intro, C.rocksA, C.fuwari1, C.oreL, C.cp,
      C.rocksB, C.fuwari2, C.ledges, C.oreR, C.cp,
      C.rocksA, C.fuwari1, C.rocksB, C.pad,
    ],
  },
  {
    id: 2,
    name: "風の断層",
    parTime: 70,
    palette: ["#1e3242", "#192c3e", "#142536"],
    chunks: [
      C.intro, C.rocksA, C.toge, C.cp,
      windR("rocksB"), windR("fuwari2"), windR("oreL"), C.cp,
      C.narrow, C.toge, C.ledges, C.cp,
      windL("rocksA"), windL("oreR"), C.fuwari1, C.hardGate, C.pad,
    ],
  },
  {
    id: 3,
    name: "溶岩大空洞",
    parTime: 95,
    palette: ["#33202e", "#2b1b28", "#221520"],
    chunks: [
      C.intro, C.rocksB, C.houdaiL, C.cp,
      C.glass, C.lavaPool, C.fuwari2, C.cp,
      C.cavern, C.houdaiR, C.glass, C.cp,
      C.toge, C.lavaPool, C.hardGate, C.houdaiL, C.pad,
    ],
  },
];

/** チャンクを連結してステージをコンパイル */
export function buildStage(def: StageDef): CompiledStage {
  const rows: string[] = [];
  const winds: [number, number, number][] = [];
  for (const ch of def.chunks) {
    if (ch.wind) winds.push([rows.length, rows.length + ch.rows.length, ch.wind * 5.5]);
    rows.push(...ch.rows);
  }
  return compileRows(rows, winds);
}

/**
 * devバリデータ。理不尽・詰みの機械検出:
 *  1) 全行が13文字・未知文字なし・パッドあり
 *  2) パッドより上の全行に「通行可能な連続2マス以上の隙間」がある(通行=壁/トゲ/溶岩以外。破壊可含む)
 *  3) 弾収支ヒューリスティック: CP区間ごとの入手可能弾 ≥ 想定消費(行数×1.2)
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
  if (t.padRow < 0) errors.push("着地パッドがない");
  if (errors.length > 0) return errors;

  // 通行可能ギャップ
  const passable = (k: TileKind) => k !== "wall" && k !== "spike" && k !== "lava";
  for (let r = 0; r < t.padRow; r++) {
    let best = 0;
    let run = 0;
    for (let c2 = 0; c2 < t.cols; c2++) {
      run = passable(t.tiles[r * t.cols + c2]) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    if (best < 2) errors.push(`row ${r}: 通行可能な隙間(2マス)がない`);
  }

  // 弾収支(CP区間ごと)
  const cps = [0, ...t.checkpoints, t.rows];
  for (let s = 0; s < cps.length - 1; s++) {
    const [a, b] = [cps[s], cps[s + 1]];
    let supply = s === 0 ? PLAYER.AMMO_START : PLAYER.CP_AMMO;
    for (let r = a; r < b; r++) {
      for (let c2 = 0; c2 < t.cols; c2++) {
        const k = t.tiles[r * t.cols + c2];
        const drop = TILE_DROPS[k];
        if (drop) supply += drop.ammoShards * 2;
      }
    }
    for (const e of compiled.enemies) {
      if (e.row >= a && e.row < b) supply += 6; // 踏み/撃破ドロップの概算
    }
    const need = (b - a) * 1.2;
    if (supply < need) {
      errors.push(`CP区間${s}(${a}-${b}m): 弾収支不足 供給${supply} < 想定消費${Math.round(need)}`);
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
