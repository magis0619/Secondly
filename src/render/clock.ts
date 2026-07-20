import { TAU, degToRad } from "../core/math.ts";
import type { Viewport } from "../core/viewport.ts";
import { COLORS, CORE, HAND, STAGE } from "../game/config.ts";
import type { World } from "../game/world.ts";

/** 文字盤(外周リング+60目盛り)。経過秒ぶんの目盛りが点灯していく */
export function drawDial(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const { cx, cy, R, unit } = vp;
  const sec = Math.floor(world.elapsed);
  const danger = world.timeLeft <= 10 && world.status === "playing";
  const dangerPulse = 0.5 + 0.5 * Math.sin(world.elapsed * 9);

  // 外周リング(ここだけ本物のグローを使う)
  ctx.save();
  ctx.strokeStyle = danger ? COLORS.danger : COLORS.dialBright;
  ctx.globalAlpha = danger ? 0.35 + 0.4 * dangerPulse : 0.9;
  ctx.lineWidth = 1.5 * unit;
  ctx.shadowColor = danger ? COLORS.danger : COLORS.tickLit;
  ctx.shadowBlur = 14 * unit;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // 60目盛り
  for (let i = 0; i < 60; i++) {
    const a = -Math.PI / 2 + (i / 60) * TAU;
    const quarter = i % 15 === 0;
    const major = i % 5 === 0;
    const lit = i < sec;
    const inner = R * (quarter ? 0.9 : major ? 0.925 : 0.945);
    const outer = R * 0.975;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    if (lit) {
      ctx.strokeStyle = danger ? COLORS.danger : COLORS.tickLit;
      ctx.globalAlpha = danger ? 0.5 + 0.5 * dangerPulse : 0.9;
    } else {
      ctx.strokeStyle = COLORS.dial;
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = (quarter ? 3 : major ? 2.2 : 1.2) * unit;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** チャージ中の攻撃範囲プレビュー(敵の下に薄く) */
export function drawChargePreview(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const hand = world.hand;
  if (hand.state !== "charging") return;
  const { cx, cy, R } = vp;
  const tier = HAND.TIERS[hand.chargeTier];
  const aim = hand.angle + degToRad(HAND.AIM_OFFSET_DEG);
  const half = degToRad(tier.arcDeg);
  const color = COLORS.tier[hand.chargeTier];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, tier.len * R, aim - half, aim + half);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.06 + 0.03 * Math.sin(world.elapsed * 12);
  ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

/** 中心コア。毎秒脈動し、被弾無敵中は点滅 */
export function drawCore(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const { cx, cy, R, unit } = vp;
  const frac = world.elapsed % 1;
  const pulse = 1 + 0.1 * Math.exp(-frac * 6);
  const r = CORE.RADIUS * R * pulse;
  const blink = world.invulnT > 0 && Math.sin(world.elapsed * 45) > 0;

  ctx.save();
  ctx.globalAlpha = blink ? 0.35 : 1;
  // 吸収シールドの薄いリング
  ctx.strokeStyle = COLORS.core;
  ctx.globalAlpha *= 0.35;
  ctx.lineWidth = 1 * unit;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5 * unit, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = blink ? 0.35 : 1;
  // 本体(グロー)
  ctx.fillStyle = COLORS.core;
  ctx.shadowColor = COLORS.core;
  ctx.shadowBlur = 18 * unit;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff8e6";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** 秒針本体+カウンターウェイト+チャージ中のゼンマイ渦 */
export function drawHand(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const { cx, cy, R, unit } = vp;
  const hand = world.hand;
  const len = hand.visLen * R;
  const a = hand.angle;
  const tipX = cx + Math.cos(a) * len;
  const tipY = cy + Math.sin(a) * len;
  const charging = hand.state === "charging";
  const attacking = hand.state === "attacking";
  const color = charging
    ? COLORS.tier[hand.chargeTier]
    : attacking
      ? COLORS.tier[hand.attackTier]
      : COLORS.hand;
  const blink = world.invulnT > 0 && Math.sin(world.elapsed * 45) > 0;

  ctx.save();
  ctx.globalAlpha = blink ? 0.35 : 1;

  // ゼンマイ渦(チャージ中、溜めに応じて巻きが増える)
  if (charging) {
    const turns = 1.5 + hand.chargeRatio * 2.5;
    const steps = Math.ceil(turns * 24);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = a + Math.PI + t * turns * TAU;
      const rad = (0.06 + 0.13 * (1 - t)) * R;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6 * unit;
    ctx.globalAlpha *= 0.55 + 0.25 * Math.sin(world.elapsed * 16);
    ctx.stroke();
    ctx.globalAlpha = blink ? 0.35 : 1;
  }

  // カウンターウェイト(針の反対側の短い尾)
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = 4.5 * unit;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - Math.cos(a) * 0.12 * R, cy - Math.sin(a) * 0.12 * R);
  ctx.stroke();

  // 針本体(根元→先端のグラデ+グロー)
  const grad = ctx.createLinearGradient(cx, cy, tipX, tipY);
  grad.addColorStop(0, "rgba(234,246,255,0.15)");
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, "#ffffff");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3.5 * unit;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16 * unit;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // 先端チップ
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(tipX, tipY, (attacking ? 4.2 : 3) * unit, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 軸
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 4 * unit, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** リザルト/タイトル装飾用: 進行に依存しない軽量の文字盤 */
export function drawDecoDial(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  unit: number,
  litRatio: number,
): void {
  ctx.save();
  ctx.strokeStyle = COLORS.dialBright;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.2 * unit;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = -Math.PI / 2 + (i / 60) * TAU;
    const major = i % 5 === 0;
    const lit = i / 60 < litRatio;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * (major ? 0.92 : 0.95), cy + Math.sin(a) * R * (major ? 0.92 : 0.95));
    ctx.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98);
    ctx.strokeStyle = lit ? COLORS.tickLit : COLORS.dial;
    ctx.globalAlpha = lit ? 0.8 : 0.6;
    ctx.lineWidth = (major ? 2 : 1) * unit;
    ctx.stroke();
  }
  ctx.restore();
}

/** ステージ終盤の残り秒数に合わせた進行率(0..1)。HUD以外でも使う */
export function stageProgress(world: World): number {
  return Math.min(world.elapsed / STAGE.TIME, 1);
}
