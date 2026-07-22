import { COLORS } from "../game/config.ts";

/** 丸ゴシック優先のフォントスタック(iOS実機では丸ゴになりポップな見た目になる) */
export const FONT = `"Hiragino Maru Gothic ProN", "Hiragino Sans", -apple-system, system-ui, sans-serif`;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** #rrggbb を暗く/明るくする(ボタンの厚み用) */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
}

/** 丸ピルのボタン(下に厚みの影+上面ツヤでぷっくり)。ヒットテスト用に同じRectを使うこと */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  unit: number,
  r: Rect,
  label: string,
  opts: { bg?: string; fg?: string; disabled?: boolean; fontPx?: number; depth?: number } = {},
): void {
  const depth = (opts.depth ?? 4) * unit;
  const bg = opts.bg ?? COLORS.accent2;
  ctx.save();
  ctx.globalAlpha = opts.disabled ? 0.35 : 1;
  // 下の厚み
  ctx.fillStyle = bg.startsWith("#") ? shade(bg, 0.5) : "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + depth, r.w, r.h, r.h / 2);
  ctx.fill();
  // 本体
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  // 上面のツヤ
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.roundRect(r.x + r.h * 0.35, r.y + r.h * 0.12, r.w - r.h * 0.7, r.h * 0.26, r.h * 0.13);
  ctx.fill();
  ctx.fillStyle = opts.fg ?? COLORS.bg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${opts.fontPx ?? 16 * unit}px ${FONT}`;
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1 * unit);
  ctx.restore();
}
