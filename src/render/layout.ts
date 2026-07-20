import type { Viewport } from "../core/viewport.ts";
import { CAMERA, GRID } from "../game/config.ts";

/** タイル座標⇔画面座標の変換。全描画がこれを共有する */
export interface Layout {
  tile: number; // タイル1辺(px)
  originX: number; // グリッド左端(px)
  anchorY: number; // 機体を置く基準Y(px)
}

export function getLayout(vp: Viewport): Layout {
  const tile = GRID.TILE_UNITS * vp.unit;
  return {
    tile,
    originX: (vp.w - GRID.COLS * tile) / 2,
    anchorY: vp.safeTop + vp.h * CAMERA.ANCHOR_RATIO,
  };
}

/** col(連続値)→画面X。タイル列cの中心は colX(l, c + 0.5) */
export function colX(l: Layout, col: number): number {
  return l.originX + col * l.tile;
}

/** depth(連続値)→画面Y */
export function depthY(l: Layout, camDepth: number, depth: number): number {
  return l.anchorY + (depth - camDepth) * l.tile;
}
