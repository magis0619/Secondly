import type { Viewport } from "../core/viewport.ts";
import { COLORS, HAND, SCORE } from "../game/config.ts";
import type { World } from "../game/world.ts";

function font(px: number, weight = 800): string {
  return `${weight} ${px}px -apple-system, system-ui, sans-serif`;
}

export function formatScore(n: number): string {
  return n.toLocaleString("en-US");
}

/** プレイ中HUD: 残り秒数/スコア/HP/コンボ/ゼンマイゲージ */
export function drawHud(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const { w, h, unit, safeTop, safeBottom } = vp;
  const topY = safeTop + 14 * unit;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // 残り秒数(中央上)
  const left = Math.ceil(world.timeLeft);
  const danger = world.timeLeft <= 10 && world.status === "playing";
  const pulse = danger ? 1 + 0.06 * Math.sin(world.elapsed * 10) : 1;
  ctx.fillStyle = danger ? COLORS.danger : COLORS.text;
  ctx.font = font(44 * unit * pulse);
  ctx.fillText(String(left), w / 2, topY);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = font(11 * unit, 700);
  ctx.fillText("SECONDS", w / 2, topY + 48 * unit);

  // スコア(左上)
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.textDim;
  ctx.font = font(11 * unit, 700);
  ctx.fillText("SCORE", 16 * unit, topY);
  ctx.fillStyle = COLORS.text;
  ctx.font = font(20 * unit);
  ctx.fillText(formatScore(world.score), 16 * unit, topY + 14 * unit);

  // HP(左上スコアの下: ◆◆◆)
  for (let i = 0; i < 3; i++) {
    const x = (22 + i * 20) * unit;
    const y = topY + 52 * unit;
    const filled = i < world.coreHp;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    const s = 6.5 * unit;
    if (filled) {
      ctx.fillStyle = world.coreHp === 1 ? COLORS.danger : COLORS.core;
      ctx.fillRect(-s / 2, -s / 2, s, s);
    } else {
      ctx.strokeStyle = COLORS.textDim;
      ctx.lineWidth = 1.5 * unit;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
    }
    ctx.restore();
  }

  // コンボ(右上)
  if (world.combo >= 2) {
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.tier[2];
    ctx.font = font(26 * unit);
    ctx.fillText(`×${world.combo}`, w - 16 * unit, topY);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = font(10 * unit, 700);
    ctx.fillText("CHAIN", w - 16 * unit, topY + 28 * unit);
    // チェーン残り時間バー
    const bw = 64 * unit;
    const ratio = Math.max(world.chainT / SCORE.CHAIN_WINDOW, 0);
    ctx.fillStyle = COLORS.dial;
    ctx.fillRect(w - 16 * unit - bw, topY + 42 * unit, bw, 3 * unit);
    ctx.fillStyle = COLORS.tier[2];
    ctx.fillRect(w - 16 * unit - bw * ratio, topY + 42 * unit, bw * ratio, 3 * unit);
  }

  // ゼンマイゲージ(下中央、3セグメント)
  const hand = world.hand;
  const gw = 190 * unit;
  const gh = 10 * unit;
  const gx = w / 2 - gw / 2;
  const gy = h - safeBottom - 46 * unit;
  const charging = hand.state === "charging";
  const ratio = charging ? hand.chargeRatio : 0;
  const tierColor = COLORS.tier[hand.chargeTier];
  const maxed = charging && ratio >= 1;

  ctx.globalAlpha = charging ? 1 : 0.4;
  ctx.fillStyle = COLORS.dial;
  ctx.fillRect(gx, gy, gw, gh);
  if (ratio > 0) {
    ctx.fillStyle = tierColor;
    if (maxed) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(world.elapsed * 18);
    ctx.fillRect(gx, gy, gw * ratio, gh);
  }
  // ティア境界線
  ctx.globalAlpha = charging ? 0.9 : 0.4;
  ctx.fillStyle = COLORS.bg;
  const b1 = HAND.CHARGE_T2 / HAND.CHARGE_T3;
  ctx.fillRect(gx + gw * b1 - 1 * unit, gy - 1 * unit, 2 * unit, gh + 2 * unit);
  ctx.textAlign = "center";
  ctx.fillStyle = maxed ? tierColor : COLORS.textDim;
  ctx.font = font(10 * unit, 700);
  ctx.fillText(maxed ? "MAX WIND!" : "HOLD = WIND", w / 2, gy + gh + 6 * unit);
  ctx.restore();
}
