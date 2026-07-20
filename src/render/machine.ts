import { TAU } from "../core/math.ts";
import type { Viewport } from "../core/viewport.ts";
import { COLORS } from "../game/config.ts";
import type { World } from "../game/world.ts";
import type { Layout } from "./layout.ts";
import { colX, depthY } from "./layout.ts";

/** ドリル機体。チャージで縦に潰れ(バネ圧縮)、ダッシュで縦に伸びる */
export function drawMachine(ctx: CanvasRenderingContext2D, vp: Viewport, l: Layout, world: World): void {
  const m = world.machine;
  const { tile } = l;
  const x = colX(l, m.col);
  const y = depthY(l, world.camera.depth, m.depth);
  const u = vp.unit;

  const charging = m.state === "charging";
  const dashing = m.state === "dashing";
  const tierColor = charging
    ? COLORS.tier[m.chargeTier]
    : dashing
      ? COLORS.tier[m.attackTier]
      : COLORS.drill;

  // squash & stretch
  let sx = 1;
  let sy = 1;
  if (charging) {
    sy = 1 - 0.28 * m.chargeRatio;
    sx = 1 + 0.18 * m.chargeRatio;
  } else if (dashing) {
    sy = 1.28;
    sx = 0.82;
  } else if (m.state === "hurt") {
    sx = 1.15;
    sy = 0.9;
  }

  const blink = m.invulnT > 0 && Math.sin(world.elapsed * 45) > 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.globalAlpha = blink ? 0.35 : 1;

  const bw = tile * 0.62;
  const bh = tile * 0.52;

  // ダッシュ中のスピードライン
  if (dashing) {
    ctx.strokeStyle = tierColor;
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = 2 * u;
    for (const ox of [-bw * 0.42, 0, bw * 0.42]) {
      ctx.beginPath();
      ctx.moveTo(ox, -tile * 0.9);
      ctx.lineTo(ox, -tile * 0.45);
      ctx.stroke();
    }
    ctx.globalAlpha = blink ? 0.35 : 1;
  }

  // チャージ中のバネコイル(頭上でぎゅっと潰れていく)
  if (charging) {
    const coils = 4;
    const coilH = tile * 0.34 * (1 - 0.55 * m.chargeRatio);
    const top = -bh / 2 - coilH;
    ctx.strokeStyle = COLORS.tier[m.chargeTier];
    ctx.lineWidth = 2.2 * u;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= coils * 2; i++) {
      const yy = top + (coilH * i) / (coils * 2);
      const xx = (i % 2 === 0 ? -1 : 1) * bw * 0.34;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }

  // 本体(カプセル)
  ctx.fillStyle = COLORS.machine;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.28);
  ctx.fill();
  // 窓
  ctx.fillStyle = tierColor;
  ctx.beginPath();
  ctx.arc(0, -bh * 0.08, bw * 0.17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-bw * 0.05, -bh * 0.13, bw * 0.06, 0, TAU);
  ctx.fill();

  // ドリルコーン(下向き)。回転ストライプで回っている感を出す
  const dw = bw * 0.68;
  const dh = tile * 0.42;
  ctx.save();
  ctx.translate(0, bh / 2);
  ctx.fillStyle = tierColor;
  if (charging || dashing) {
    ctx.shadowColor = tierColor;
    ctx.shadowBlur = 12 * u;
  }
  ctx.beginPath();
  ctx.moveTo(-dw / 2, 0);
  ctx.lineTo(dw / 2, 0);
  ctx.lineTo(0, dh);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // 回転ストライプ
  ctx.clip();
  ctx.strokeStyle = "rgba(10,14,26,0.45)";
  ctx.lineWidth = 2.4 * u;
  const spin = (world.elapsed * (dashing ? 16 : 6)) % 1;
  for (let i = -1; i < 4; i++) {
    const yy = ((i + spin) * dh) / 3;
    ctx.beginPath();
    ctx.moveTo(-dw / 2, yy - 3 * u);
    ctx.lineTo(dw / 2, yy + 3 * u);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();

  // チャージゲージリング(機体の周り)
  if (charging) {
    ctx.save();
    ctx.strokeStyle = COLORS.tier[m.chargeTier];
    ctx.lineWidth = 3 * u;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, tile * 0.72, -Math.PI / 2, -Math.PI / 2 + m.chargeRatio * TAU);
    ctx.stroke();
    if (m.chargeRatio >= 1) {
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(world.elapsed * 18);
      ctx.beginPath();
      ctx.arc(x, y, tile * 0.82, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}
