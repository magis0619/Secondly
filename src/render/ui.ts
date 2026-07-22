import { COLORS } from "../game/config.ts";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** 丸ピルのボタン。ヒットテスト用に同じRectを使うこと */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  unit: number,
  r: Rect,
  label: string,
  opts: { bg?: string; fg?: string; disabled?: boolean; fontPx?: number } = {},
): void {
  ctx.save();
  ctx.globalAlpha = opts.disabled ? 0.35 : 1;
  ctx.fillStyle = opts.bg ?? COLORS.accent2;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.fillStyle = opts.fg ?? COLORS.bg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${opts.fontPx ?? 16 * unit}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1 * unit);
  ctx.restore();
}
