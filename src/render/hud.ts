import type { Viewport } from "../core/viewport.ts";
import { COLORS, COMBO } from "../game/config.ts";
import type { World } from "../game/world.ts";

function font(px: number, weight = 800): string {
  return `${weight} ${px}px -apple-system, system-ui, sans-serif`;
}

export function formatScore(n: number): string {
  return n.toLocaleString("en-US");
}

export function drawGemIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = COLORS.gem;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.8, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff2c8";
  ctx.fillRect(-s * 0.2, -s * 0.42, s * 0.4, s * 0.4);
  ctx.restore();
}

/** プレイ中HUD。最重要=AMMO */
export function drawHud(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const { w, h, unit: u, safeTop, safeBottom } = vp;
  const topY = safeTop + 12 * u;
  const p = world.player;

  ctx.save();

  // AMMO(左上・最大表示)
  const low = p.ammo <= 10 && p.overdriveT <= 0;
  const flash = low && Math.sin(world.elapsed * 10) > 0;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.textDim;
  ctx.font = font(10 * u, 700);
  ctx.fillText("AMMO", 16 * u, topY);
  // 弾アイコン
  ctx.fillStyle = flash ? COLORS.danger : COLORS.ammo;
  ctx.fillRect(16 * u, topY + 16 * u, 7 * u, 15 * u);
  ctx.beginPath();
  ctx.arc(19.5 * u, topY + 16 * u, 3.5 * u, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = flash ? COLORS.danger : p.overdriveT > 0 ? COLORS.overdrive : COLORS.text;
  ctx.font = font(30 * u, 900);
  ctx.fillText(p.overdriveT > 0 ? "∞" : String(p.ammo), 30 * u, topY + 8 * u);
  // ジェム
  drawGemIcon(ctx, 22 * u, topY + 52 * u, 6.5 * u);
  ctx.fillStyle = COLORS.gem;
  ctx.font = font(14 * u);
  ctx.fillText(String(world.gems), 33 * u, topY + 45 * u);

  // 深度(中央)
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.text;
  ctx.font = font(26 * u, 900);
  ctx.fillText(`${Math.max(0, Math.floor(p.y))}m`, w / 2, topY);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = font(10 * u, 700);
  ctx.fillText(`${world.stage.name} / ${world.terrain.rows}m`, w / 2, topY + 30 * u);

  // HP(右上)
  const maxHp = p.maxHp;
  for (let i = 0; i < maxHp; i++) {
    const x = w - 16 * u - (maxHp - 1 - i) * 18 * u;
    const y = topY + 8 * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    const s = 6.5 * u;
    if (i < p.hp) {
      ctx.fillStyle = p.hp === 1 ? COLORS.danger : "#7dff8a";
      ctx.fillRect(-s / 2, -s / 2, s, s);
    } else {
      ctx.strokeStyle = COLORS.textDim;
      ctx.lineWidth = 1.5 * u;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
    }
    ctx.restore();
  }

  // エアコンボ(右・中段)
  if (world.combo >= 2) {
    ctx.textAlign = "right";
    ctx.fillStyle = world.combo >= COMBO.PRAISE_AT ? COLORS.overdrive : COLORS.aim;
    ctx.font = font(22 * u, 900);
    ctx.fillText(`×${world.combo}`, w - 14 * u, topY + 40 * u);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = font(9 * u, 700);
    ctx.fillText("AIR COMBO", w - 14 * u, topY + 64 * u);
  }
  if (p.overdriveT > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.overdrive;
    ctx.font = font(14 * u, 900);
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(world.elapsed * 16);
    ctx.fillText("OVERDRIVE! 弾消費なし", w / 2, topY + 52 * u);
    ctx.globalAlpha = 1;
  }

  // 深度メーター(右端)
  const meterH = h * 0.42;
  const meterX = w - 8 * u;
  const meterY = h * 0.3;
  ctx.strokeStyle = COLORS.textDim;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(meterX, meterY);
  ctx.lineTo(meterX, meterY + meterH);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const total = world.terrain.rows;
  // CP
  for (const row of world.terrain.checkpoints) {
    ctx.fillStyle = world.cpPassed(row) ? "#7dff8a" : COLORS.aim;
    ctx.fillRect(meterX - 3 * u, meterY + meterH * (row / total) - u, 6 * u, 2 * u);
  }
  // パッド
  ctx.fillStyle = COLORS.tile.pad;
  ctx.beginPath();
  ctx.arc(meterX, meterY + meterH * (world.terrain.padRow / total), 4 * u, 0, Math.PI * 2);
  ctx.fill();
  // 自機
  ctx.fillStyle = COLORS.aim;
  const my = meterY + meterH * Math.min(Math.max(p.y, 0) / total, 1);
  ctx.beginPath();
  ctx.moveTo(meterX - 7 * u, my - 4 * u);
  ctx.lineTo(meterX, my);
  ctx.lineTo(meterX - 7 * u, my + 4 * u);
  ctx.closePath();
  ctx.fill();

  // 序盤ヒント
  if (world.stage.id === 1 && world.elapsed < 6 && world.status === "playing") {
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.textDim;
    ctx.font = font(12 * u, 700);
    ctx.globalAlpha = 0.9;
    ctx.fillText("タッチした方向に射撃 — 反動で逆へ飛ぶ", w / 2, h - safeBottom - 52 * u);
    ctx.fillText("下を撃ってブレーキ / 岩を壊すと弾が出る", w / 2, h - safeBottom - 34 * u);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
