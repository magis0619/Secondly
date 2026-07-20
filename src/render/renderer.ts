import type { Viewport } from "../core/viewport.ts";
import type { Fx } from "../fx/particles.ts";
import type { Juice } from "../fx/juice.ts";
import { COLORS } from "../game/config.ts";
import type { World } from "../game/world.ts";
import { drawChargePreview, drawCore, drawDial, drawHand } from "./clock.ts";
import { drawBullets, drawEnemies, drawTelegraphs } from "./enemies.ts";
import { drawFx } from "./fx.ts";
import { drawHud } from "./hud.ts";

/** 背景(全画面クリア+中心の淡い放射グロー) */
export function drawBackground(ctx: CanvasRenderingContext2D, vp: Viewport): void {
  const { w, h, cx, cy, R } = vp;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  const grad = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.6);
  grad.addColorStop(0, COLORS.bgGlow);
  grad.addColorStop(1, COLORS.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/** プレイ画面の1フレーム描画(レイヤ順の統括) */
export function renderPlay(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  world: World,
  fx: Fx,
  juice: Juice,
): void {
  drawBackground(ctx, vp);

  ctx.save();
  ctx.translate(juice.offX, juice.offY);
  drawDial(ctx, vp, world);
  drawChargePreview(ctx, vp, world);
  drawTelegraphs(ctx, vp, world);
  drawBullets(ctx, vp, world);
  drawEnemies(ctx, vp, world);
  drawCore(ctx, vp, world);
  drawHand(ctx, vp, world);
  drawFx(ctx, vp, fx);
  ctx.restore();

  drawHud(ctx, vp, world);

  if (juice.flash > 0) {
    ctx.save();
    ctx.globalAlpha = juice.flash;
    ctx.fillStyle = juice.flashColor;
    ctx.fillRect(0, 0, vp.w, vp.h);
    ctx.restore();
  }
}
