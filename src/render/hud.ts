import type { Viewport } from "../core/viewport.ts";
import { COLORS, MACHINE } from "../game/config.ts";
import type { World } from "../game/world.ts";

function font(px: number, weight = 800): string {
  return `${weight} ${px}px -apple-system, system-ui, sans-serif`;
}

export function formatScore(n: number): string {
  return n.toLocaleString("en-US");
}

/** コインの菱形アイコン */
export function drawCoinIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = COLORS.coin;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = "#fff2c8";
  ctx.fillRect(-s * 0.2, -s * 0.2, s * 0.4, s * 0.4);
  ctx.restore();
}

/** プレイ中HUD: 深度/スコア/コイン/HP/深度メーター/チャージゲージ */
export function drawHud(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const { w, h, unit, safeTop, safeBottom } = vp;
  const topY = safeTop + 14 * unit;
  const m = world.machine;

  ctx.save();

  // 深度(中央上)
  const depthM = Math.max(0, Math.floor(world.machine.depth));
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.text;
  ctx.font = font(34 * unit);
  ctx.fillText(`${depthM}m`, w / 2, topY);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = font(11 * unit, 700);
  ctx.fillText(world.stage.name, w / 2, topY + 38 * unit);

  // スコア+コイン(左上)
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.textDim;
  ctx.font = font(10 * unit, 700);
  ctx.fillText("SCORE", 16 * unit, topY);
  ctx.fillStyle = COLORS.text;
  ctx.font = font(18 * unit);
  ctx.fillText(formatScore(world.score), 16 * unit, topY + 12 * unit);
  drawCoinIcon(ctx, 22 * unit, topY + 44 * unit, 9 * unit);
  ctx.fillStyle = COLORS.coin;
  ctx.font = font(15 * unit);
  ctx.fillText(String(world.coins), 34 * unit, topY + 37 * unit);

  // HP(右上: ◆)
  const maxHp = m.maxHp;
  for (let i = 0; i < maxHp; i++) {
    const x = w - 16 * unit - (maxHp - 1 - i) * 19 * unit;
    const y = topY + 8 * unit;
    const filled = i < m.hp;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    const s = 7 * unit;
    if (filled) {
      ctx.fillStyle = m.hp === 1 ? COLORS.danger : "#7dff8a";
      ctx.fillRect(-s / 2, -s / 2, s, s);
    } else {
      ctx.strokeStyle = COLORS.textDim;
      ctx.lineWidth = 1.5 * unit;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
    }
    ctx.restore();
  }

  // 深度メーター(右端の縦バー: 機体位置とコア位置)
  const meterH = h * 0.44;
  const meterX = w - 10 * unit;
  const meterY = h * 0.28;
  ctx.strokeStyle = COLORS.textDim;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2 * unit;
  ctx.beginPath();
  ctx.moveTo(meterX, meterY);
  ctx.lineTo(meterX, meterY + meterH);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const total = world.depthMax;
  const my = meterY + meterH * Math.min(Math.max(m.depth, 0) / total, 1);
  const cy = meterY + meterH * (world.terrain.coreRow / total);
  // コア
  ctx.fillStyle = COLORS.coin;
  ctx.beginPath();
  ctx.arc(meterX, cy, 4 * unit, 0, Math.PI * 2);
  ctx.fill();
  // 機体
  ctx.fillStyle = COLORS.drill;
  ctx.beginPath();
  ctx.moveTo(meterX - 7 * unit, my - 4 * unit);
  ctx.lineTo(meterX, my);
  ctx.lineTo(meterX - 7 * unit, my + 4 * unit);
  ctx.closePath();
  ctx.fill();

  // チャージゲージ(下中央、3セグメント)
  const gw = 190 * unit;
  const gh = 10 * unit;
  const gx = w / 2 - gw / 2;
  const gy = h - safeBottom - 46 * unit;
  const charging = m.state === "charging";
  const ratio = charging ? m.chargeRatio : 0;
  const tierColor = COLORS.tier[m.chargeTier];
  const maxed = charging && ratio >= 1;

  ctx.globalAlpha = charging ? 1 : 0.4;
  ctx.fillStyle = "#25314f";
  ctx.fillRect(gx, gy, gw, gh);
  if (ratio > 0) {
    ctx.fillStyle = tierColor;
    if (maxed) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(world.elapsed * 18);
    ctx.fillRect(gx, gy, gw * ratio, gh);
  }
  ctx.globalAlpha = charging ? 0.9 : 0.4;
  ctx.fillStyle = COLORS.bg;
  const b1 = MACHINE.CHARGE_T2 / MACHINE.CHARGE_T3;
  ctx.fillRect(gx + gw * b1 - 1 * unit, gy - 1 * unit, 2 * unit, gh + 2 * unit);
  ctx.textAlign = "center";
  ctx.fillStyle = maxed ? tierColor : COLORS.textDim;
  ctx.font = font(10 * unit, 700);
  ctx.fillText(maxed ? "MAX! はなして ぶちぬけ!" : "ながおし = バネをためる", w / 2, gy + gh + 6 * unit);
  ctx.restore();
}
