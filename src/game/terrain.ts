import type { TileKind } from "./config.ts";
import { GRID, TILE_HP } from "./config.ts";

/**
 * タイル地形。row 0が地表、下へ増える。列0..COLS-1、外側は壁扱い。
 * 破壊可能タイルはhpを持つ(hps配列、0=無傷からの残り耐久)。
 */
export interface Terrain {
  cols: number;
  rows: number;
  tiles: TileKind[];
  hps: Int8Array;
  padRow: number;
  /** チェックポイントの行(通過で発動) */
  checkpoints: number[];
  /** 風ゾーン: [開始行, 終了行, 横加速度] */
  winds: [number, number, number][];
}

export function kindAt(t: Terrain, col: number, row: number): TileKind {
  if (row < 0) return "empty";
  if (col < 0 || col >= t.cols || row >= t.rows) return "wall";
  return t.tiles[row * t.cols + col];
}

/** 実体として衝突するタイルか(足場になる) */
export function isSolid(k: TileKind): boolean {
  return k === "wall" || k === "rock" || k === "hard" || k === "ore" || k === "glass" || k === "pad";
}

/** 射撃で破壊できるタイルか */
export function isShootable(k: TileKind): boolean {
  return k === "rock" || k === "hard" || k === "ore" || k === "glass";
}

export function hpAt(t: Terrain, col: number, row: number): number {
  return t.hps[row * t.cols + col];
}

/** ダメージを与える。破壊されたらtrue */
export function damageTile(t: Terrain, col: number, row: number, dmg: number): boolean {
  const i = row * t.cols + col;
  const k = t.tiles[i];
  const max = TILE_HP[k];
  if (max === undefined) return false;
  t.hps[i] += dmg;
  if (t.hps[i] >= max) {
    t.tiles[i] = "empty";
    t.hps[i] = 0;
    return true;
  }
  return false;
}

export function clearTile(t: Terrain, col: number, row: number): void {
  if (col < 0 || col >= t.cols || row < 0 || row >= t.rows) return;
  t.tiles[row * t.cols + col] = "empty";
}

export const CHAR_TILES: Record<string, TileKind> = {
  ".": "empty",
  "#": "wall",
  r: "rock",
  h: "hard",
  o: "ore",
  g: "glass",
  "^": "spike",
  L: "lava",
  P: "pad",
  // 敵アンカー(タイルとしてはempty。stages.tsが拾う)
  "1": "empty",
  "2": "empty",
  "3": "empty",
  c: "empty", // チェックポイント行マーカー
};

export interface EnemySpawn {
  kind: "fuwari" | "togemaru" | "houdai";
  col: number;
  row: number;
}

export interface CompiledStage {
  terrain: Terrain;
  enemies: EnemySpawn[];
}

/** 文字列行(各13文字)から地形+敵配置をコンパイル */
export function compileRows(rows: string[], winds: [number, number, number][]): CompiledStage {
  const cols = GRID.COLS;
  const tiles: TileKind[] = [];
  const enemies: EnemySpawn[] = [];
  const checkpoints: number[] = [];
  let padRow = -1;
  rows.forEach((line, r) => {
    let isCp = false;
    for (let c = 0; c < cols; c++) {
      const ch = line[c] ?? ".";
      const kind = CHAR_TILES[ch] ?? "empty";
      if (ch === "1") enemies.push({ kind: "fuwari", col: c + 0.5, row: r + 0.5 });
      if (ch === "2") enemies.push({ kind: "togemaru", col: c + 0.5, row: r + 0.5 });
      if (ch === "3") enemies.push({ kind: "houdai", col: c + 0.5, row: r + 0.5 });
      if (ch === "c") isCp = true;
      if (kind === "pad" && padRow < 0) padRow = r;
      tiles.push(kind);
    }
    if (isCp) checkpoints.push(r);
  });
  return {
    terrain: {
      cols,
      rows: rows.length,
      tiles,
      hps: new Int8Array(rows.length * cols),
      padRow,
      checkpoints,
      winds,
    },
    enemies,
  };
}
