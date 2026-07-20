import { TAU, clamp, lerp } from "../core/math.ts";
import type { Viewport } from "../core/viewport.ts";
import { COLORS, GRID } from "../game/config.ts";
import type { World } from "../game/world.ts";
import type { Layout } from "./layout.ts";
import { colX, depthY } from "./layout.ts";

/** タイルごとの決定論的なゆらぎ(0..1)。ノイズ模様・点滅位相に使う */
function hash(col: number, row: number): number {
  let h = (col * 73856093) ^ (row * 19349663);
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbStr([r, g, b]: Rgb, k = 1): string {
  return `rgb(${clamp(Math.round(r * k), 0, 255)},${clamp(Math.round(g * k), 0, 255)},${clamp(Math.round(b * k), 0, 255)})`;
}

/** 地層パレットを深度で補間した土色(RGB成分で返す。明度係数はrgbStrでかける) */
function dirtRgb(palette: string[], row: number, rows: number): Rgb {
  const t = clamp(row / Math.max(rows - 1, 1), 0, 0.999);
  const seg = t * (palette.length - 1);
  const i = Math.floor(seg);
  const f = seg - i;
  const a = hexToRgb(palette[i]);
  const b = hexToRgb(palette[i + 1]);
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

export function drawTerrain(ctx: CanvasRenderingContext2D, vp: Viewport, l: Layout, world: World): void {
  const { tile, originX } = l;
  const cam = world.camera.depth;
  const t = world.terrain;
  const surfaceY = depthY(l, cam, 0);

  // 空(地表より上)
  if (surfaceY > 0) {
    const sky = ctx.createLinearGradient(0, 0, 0, surfaceY);
    sky.addColorStop(0, COLORS.sky);
    sky.addColorStop(1, COLORS.bgGlow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, vp.w, surfaceY);
    // 地表ライン
    ctx.fillStyle = "#2c8a4f";
    ctx.fillRect(0, surfaceY - 3 * vp.unit, vp.w, 3 * vp.unit);
  }

  // 地下の背景(洞窟色)と左右の岩壁帯
  const underY = Math.max(surfaceY, 0);
  ctx.fillStyle = "#0c1224";
  ctx.fillRect(0, underY, vp.w, vp.h - underY);
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, underY, originX, vp.h - underY);
  ctx.fillRect(originX + GRID.COLS * tile, underY, vp.w, vp.h - underY);

  // 可視範囲のタイルだけ走査
  const r0 = Math.max(0, Math.floor(cam - l.anchorY / tile) - 1);
  const r1 = Math.min(t.rows - 1, r0 + Math.ceil(vp.h / tile) + 2);

  for (let row = r0; row <= r1; row++) {
    const y = depthY(l, cam, row);
    for (let col = 0; col < t.cols; col++) {
      const kind = t.tiles[row * t.cols + col];
      if (kind === "empty") continue;
      const x = colX(l, col);
      const h01 = hash(col, row);
      const pad = 0.6 * vp.unit;

      switch (kind) {
        case "dirt":
        case "ore":
        case "gem": {
          const base = dirtRgb(world.stage.palette, row, t.rows);
          ctx.fillStyle = rgbStr(base, 0.9 + h01 * 0.2);
          ctx.fillRect(x + pad, y + pad, tile - pad * 2, tile - pad * 2);
          // 粒感
          ctx.fillStyle = rgbStr(base, 0.75);
          const gx = x + tile * (0.25 + h01 * 0.5);
          const gy = y + tile * (0.25 + hash(row, col) * 0.5);
          ctx.fillRect(gx, gy, 3 * vp.unit, 3 * vp.unit);
          if (kind === "ore") {
            ctx.fillStyle = COLORS.tile.ore;
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.arc(x + tile / 2, y + tile / 2, tile * 0.36, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(x + tile / 2, y + tile / 2, tile * 0.17, 0, TAU);
            ctx.fill();
          } else if (kind === "gem") {
            const cx = x + tile / 2;
            const cy = y + tile / 2;
            const s = tile * 0.26;
            ctx.fillStyle = COLORS.tile.gem;
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.arc(cx, cy, tile * 0.4, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy - s);
            ctx.lineTo(cx + s * 0.8, cy);
            ctx.lineTo(cx, cy + s);
            ctx.lineTo(cx - s * 0.8, cy);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#e6d8ff";
            ctx.fillRect(cx - s * 0.18, cy - s * 0.5, s * 0.36, s * 0.36);
          }
          break;
        }
        case "rock": {
          ctx.fillStyle = rgbStr(hexToRgb(COLORS.tile.rock), 0.92 + h01 * 0.16);
          ctx.beginPath();
          ctx.roundRect(x + pad, y + pad, tile - pad * 2, tile - pad * 2, 4 * vp.unit);
          ctx.fill();
          ctx.strokeStyle = COLORS.tile.rockDark;
          ctx.lineWidth = 1.5 * vp.unit;
          ctx.beginPath();
          ctx.moveTo(x + tile * 0.28, y + tile * (0.3 + h01 * 0.2));
          ctx.lineTo(x + tile * 0.55, y + tile * 0.55);
          ctx.lineTo(x + tile * (0.4 + h01 * 0.2), y + tile * 0.78);
          ctx.stroke();
          break;
        }
        case "steel": {
          ctx.fillStyle = COLORS.tile.steelDark;
          ctx.fillRect(x + pad, y + pad, tile - pad * 2, tile - pad * 2);
          ctx.fillStyle = COLORS.tile.steel;
          ctx.fillRect(x + pad, y + pad, tile - pad * 2, tile * 0.18);
          // リベット
          ctx.fillStyle = "#5f6d92";
          const rr = 2.2 * vp.unit;
          ctx.beginPath();
          ctx.arc(x + tile * 0.25, y + tile * 0.6, rr, 0, TAU);
          ctx.arc(x + tile * 0.75, y + tile * 0.6, rr, 0, TAU);
          ctx.fill();
          break;
        }
        case "lava": {
          const pulse = 0.75 + 0.25 * Math.sin(world.elapsed * 3 + h01 * TAU);
          ctx.fillStyle = COLORS.tile.lava;
          ctx.fillRect(x, y, tile, tile);
          ctx.fillStyle = COLORS.tile.lavaGlow;
          ctx.globalAlpha = 0.55 * pulse;
          ctx.beginPath();
          ctx.arc(x + tile * (0.3 + h01 * 0.4), y + tile * 0.5, tile * 0.3, 0, TAU);
          ctx.arc(x + tile * 0.7, y + tile * (0.25 + h01 * 0.4), tile * 0.18, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case "gas": {
          const pulse = 0.6 + 0.4 * Math.sin(world.elapsed * 4 + h01 * TAU);
          ctx.fillStyle = COLORS.tile.gas;
          ctx.globalAlpha = 0.16 + 0.1 * pulse;
          ctx.fillRect(x + pad, y + pad, tile - pad * 2, tile - pad * 2);
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          ctx.arc(x + tile * 0.35, y + tile * 0.6, tile * 0.1 * pulse + tile * 0.06, 0, TAU);
          ctx.arc(x + tile * 0.65, y + tile * 0.35, tile * 0.08 * pulse + tile * 0.05, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case "core": {
          const pulse = 1 + 0.08 * Math.sin(world.elapsed * 4);
          ctx.save();
          ctx.fillStyle = COLORS.tile.core;
          ctx.shadowColor = COLORS.tile.core;
          ctx.shadowBlur = 18 * vp.unit;
          ctx.beginPath();
          ctx.arc(x + tile / 2, y + tile / 2, tile * 0.38 * pulse, 0, TAU);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff6dc";
          ctx.beginPath();
          ctx.arc(x + tile / 2, y + tile / 2, tile * 0.16 * pulse, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
      }
    }
  }
}
