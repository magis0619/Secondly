import type { Viewport } from "../core/viewport.ts";
import type { Fx } from "../fx/particles.ts";
import type { Juice } from "../fx/juice.ts";
import { COLORS } from "../game/config.ts";
import type { World } from "../game/world.ts";
import { drawFx } from "./fx.ts";
import { drawHud } from "./hud.ts";
import { getLayout } from "./layout.ts";
import { drawMachine } from "./machine.ts";
import { drawTerrain } from "./terrain.ts";

/** 背景(全画面クリア) */
export function drawBackground(ctx: CanvasRenderingContext2D, vp: Viewport): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, vp.w, vp.h);
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
  const l = getLayout(vp);

  ctx.save();
  ctx.translate(juice.offX, juice.offY);
  drawTerrain(ctx, vp, l, world);
  drawMachine(ctx, vp, l, world);
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
