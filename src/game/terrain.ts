import type { TileKind } from "./config.ts";
import { GRID } from "./config.ts";

/** タイルグリッド。row 0 が地表直下、下に向かって row が増える */
export interface Terrain {
  cols: number;
  rows: number;
  tiles: TileKind[];
  coreRow: number;
  coreCol: number;
}

export const CHAR_TILES: Record<string, TileKind> = {
  ".": "dirt",
  "_": "empty",
  R: "rock",
  S: "steel",
  o: "ore",
  G: "gem",
  L: "lava",
  g: "gas",
  C: "core",
};

export function parseRows(rows: string[]): Terrain {
  const cols = GRID.COLS;
  const tiles: TileKind[] = [];
  let coreRow = -1;
  let coreCol = -1;
  rows.forEach((line, r) => {
    for (let c = 0; c < cols; c++) {
      const kind = CHAR_TILES[line[c]] ?? "dirt";
      if (kind === "core") {
        coreRow = r;
        coreCol = c;
      }
      tiles.push(kind);
    }
  });
  return { cols, rows: rows.length, tiles, coreRow, coreCol };
}

/**
 * 範囲外の扱い: 上空=empty、左右の壁と最下部より下=steel(破壊不可の壁として振る舞う。
 * 縦ダッシュは横に出ないので、横移動のブロック判定にだけ効く)
 */
export function kindAt(t: Terrain, col: number, row: number): TileKind {
  if (row < 0) return "empty";
  if (col < 0 || col >= t.cols || row >= t.rows) return "steel";
  return t.tiles[row * t.cols + col];
}

export function clearTile(t: Terrain, col: number, row: number): void {
  if (col < 0 || col >= t.cols || row < 0 || row >= t.rows) return;
  t.tiles[row * t.cols + col] = "empty";
}
