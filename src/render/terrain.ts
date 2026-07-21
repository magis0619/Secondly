import { TAU, clamp, lerp } from "../core/math.ts";
import type { Viewport } from "../core/viewport.ts";
import { COLORS, TILE_HP } from "../game/config.ts";
import type { World } from "../game/world.ts";
import type { Layout } from "./layout.ts";
import { colX, depthY } from "./layout.ts";

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
function paletteRgb(palette: string[], row: number, rows: number): Rgb {
  const t = clamp(row / Math.max(rows - 1, 1), 0, 0.999);
  const seg = t * (palette.length - 1);
  const i = Math.floor(seg);
  const f = seg - i;
  const a = hexToRgb(palette[i]);
  const b = hexToRgb(palette[i + 1]);
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

/** 地形+チェックポイント+着地パッドの描画 */
export function drawTerrain(ctx: CanvasRenderingContext2D, vp: Viewport, l: Layout, world: World): void {
  const { tile } = l;
  const cam = world.camera.y;
  const t = world.terrain;
  const u = vp.unit;
  const surfaceY = depthY(l, cam, 0);

  // 空(地表より上)
  if (surfaceY > 0) {
    const sky = ctx.createLinearGradient(0, 0, 0, surfaceY);
    sky.addColorStop(0, COLORS.sky);
    sky.addColorStop(1, COLORS.bgGlow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, vp.w, surfaceY);
    ctx.fillStyle = "#2c8a4f";
    ctx.fillRect(0, surfaceY - 3 * u, vp.w, 3 * u);
  }

  const r0 = Math.max(0, Math.floor(cam - l.anchorY / tile) - 1);
  const r1 = Math.min(t.rows - 1, r0 + Math.ceil(vp.h / tile) + 3);

  for (let row = r0; row <= r1; row++) {
    const y = depthY(l, cam, row);
    const wallBase = paletteRgb(world.stage.palette, row, t.rows);
    for (let col = 0; col < t.cols; col++) {
      const kind = t.tiles[row * t.cols + col];
      if (kind === "empty") continue;
      const x = colX(l, col);
      const h01 = hash(col, row);

      switch (kind) {
        case "wall": {
          ctx.fillStyle = rgbStr(wallBase, 0.95 + h01 * 0.12);
          ctx.fillRect(x, y, tile + 0.5, tile + 0.5);
          ctx.fillStyle = rgbStr(wallBase, 1.35);
          ctx.fillRect(x, y, tile, 1.5 * u);
          break;
        }
        case "rock":
        case "hard":
        case "ore": {
          const base = kind === "hard" ? hexToRgb(COLORS.tile.hard) : hexToRgb(COLORS.tile.rock);
          const pad = 1 * u;
          ctx.fillStyle = rgbStr(base, 0.9 + h01 * 0.2);
          ctx.beginPath();
          ctx.roundRect(x + pad, y + pad, tile - pad * 2, tile - pad * 2, 3.5 * u);
          ctx.fill();
          // ダメージヒビ
          const hp = t.hps[row * t.cols + col];
          const maxHp = TILE_HP[kind] ?? 1;
          if (hp > 0) {
            ctx.strokeStyle = "rgba(10,14,26,0.65)";
            ctx.lineWidth = 1.5 * u;
            ctx.beginPath();
            for (let i = 0; i <= hp; i++) {
              const sx = x + tile * (0.2 + 0.25 * i + h01 * 0.1);
              ctx.moveTo(sx, y + tile * 0.2);
              ctx.lineTo(sx + tile * 0.14, y + tile * 0.5);
              ctx.lineTo(sx - tile * 0.05, y + tile * 0.82);
            }
            ctx.stroke();
          }
          if (kind === "hard" && maxHp > 1) {
            ctx.fillStyle = COLORS.tile.hardDark;
            ctx.beginPath();
            ctx.arc(x + tile * 0.28, y + tile * 0.3, 1.6 * u, 0, TAU);
            ctx.arc(x + tile * 0.72, y + tile * 0.3, 1.6 * u, 0, TAU);
            ctx.fill();
          }
          if (kind === "ore") {
            ctx.fillStyle = COLORS.tile.ore;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(x + tile / 2, y + tile / 2, tile * 0.4, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(x + tile * 0.42, y + tile * 0.45, tile * 0.13, 0, TAU);
            ctx.arc(x + tile * 0.65, y + tile * 0.62, tile * 0.09, 0, TAU);
            ctx.fill();
          }
          break;
        }
        case "glass": {
          ctx.fillStyle = COLORS.tile.glass;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(x + 0.5 * u, y + tile * 0.25, tile - u, tile * 0.5);
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = COLORS.tile.glass;
          ctx.lineWidth = 1.5 * u;
          ctx.strokeRect(x + 0.5 * u, y + tile * 0.25, tile - u, tile * 0.5);
          ctx.globalAlpha = 1;
          break;
        }
        case "spike": {
          ctx.fillStyle = COLORS.tile.spike;
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const sx = x + tile * (0.17 + i * 0.33);
            ctx.moveTo(sx - tile * 0.13, y + tile);
            ctx.lineTo(sx, y + tile * 0.15);
            ctx.lineTo(sx + tile * 0.13, y + tile);
          }
          ctx.fill();
          break;
        }
        case "lava": {
          const pulse = 0.7 + 0.3 * Math.sin(world.elapsed * 3 + h01 * TAU);
          ctx.fillStyle = COLORS.tile.lava;
          ctx.fillRect(x, y + tile * 0.25, tile + 0.5, tile * 0.75);
          ctx.fillStyle = COLORS.tile.lavaGlow;
          ctx.globalAlpha = 0.6 * pulse;
          ctx.beginPath();
          ctx.arc(x + tile * (0.3 + h01 * 0.4), y + tile * 0.5, tile * 0.2, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case "pad": {
          const pulse = 0.6 + 0.4 * Math.sin(world.elapsed * 4);
          ctx.fillStyle = COLORS.tile.pad;
          ctx.shadowColor = COLORS.tile.pad;
          ctx.shadowBlur = 10 * u * pulse;
          ctx.fillRect(x + u, y + tile * 0.35, tile - 2 * u, tile * 0.4);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#0a0e1a";
          ctx.font = `900 ${9 * u}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("▼", x + tile / 2, y + tile * 0.66);
          break;
        }
      }
    }
  }

  // チェックポイントライン
  for (const row of t.checkpoints) {
    if (row < r0 || row > r1) continue;
    const y = depthY(l, cam, row + 0.5);
    const passed = world.cpPassed(row);
    ctx.save();
    ctx.strokeStyle = passed ? "#7dff8a" : "#38e1ff";
    ctx.globalAlpha = passed ? 0.35 : 0.6 + 0.3 * Math.sin(world.elapsed * 5);
    ctx.lineWidth = 2 * u;
    ctx.setLineDash([8 * u, 8 * u]);
    ctx.beginPath();
    ctx.moveTo(colX(l, 1), y);
    ctx.lineTo(colX(l, t.cols - 1), y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "left";
    ctx.font = `700 ${8 * u}px sans-serif`;
    ctx.fillStyle = passed ? "#7dff8a" : "#38e1ff";
    ctx.fillText(passed ? "✓ CP" : "CP", colX(l, 1) + 2 * u, y - 4 * u);
    ctx.restore();
  }

  // 風の可視化(ゾーン内に流線)
  for (const [a, b, ax] of t.winds) {
    if (b < r0 || a > r1) continue;
    ctx.save();
    ctx.strokeStyle = "#8fd8ff";
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.5 * u;
    const dir = Math.sign(ax);
    for (let i = 0; i < 8; i++) {
      const yy = depthY(l, cam, a + ((b - a) * ((i * 0.13 + (world.elapsed * 0.07) % 0.13) % 1)));
      const phase = ((world.elapsed * 60 * dir + i * 53) % (vp.w + 80)) - 40;
      const sx = dir > 0 ? phase : vp.w - phase;
      ctx.beginPath();
      ctx.moveTo(sx, yy);
      ctx.lineTo(sx + 26 * u * dir, yy);
      ctx.stroke();
    }
    ctx.restore();
  }
}
