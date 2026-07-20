import type { App } from "../app.ts";
import { TAU } from "../core/math.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import { loadSave } from "../game/save.ts";
import { drawDecoDial } from "../render/clock.ts";
import { drawBackground } from "../render/renderer.ts";
import { formatScore } from "../render/hud.ts";
import { PlayScene } from "./play.ts";

export class TitleScene implements Scene {
  private t = 0;
  private demoAngle = -Math.PI / 2;
  private best = 0;

  constructor(private app: App) {}

  enter(): void {
    this.best = loadSave().bestScore;
  }

  update(dt: number): void {
    this.t += dt;
    this.demoAngle += (TAU / 3) * dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, cx, cy, R, unit } = vp;
    drawBackground(ctx, vp);

    // 背景の装飾文字盤+回るデモ針
    drawDecoDial(ctx, cx, cy, R, unit, (this.t / 60) % 1);
    ctx.save();
    ctx.strokeStyle = COLORS.hand;
    ctx.globalAlpha = 0.85;
    ctx.lineCap = "round";
    ctx.lineWidth = 3.5 * unit;
    ctx.shadowColor = COLORS.tickLit;
    ctx.shadowBlur = 14 * unit;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.demoAngle) * R * 0.85, cy + Math.sin(this.demoAngle) * R * 0.85);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = COLORS.core;
    ctx.beginPath();
    ctx.arc(cx, cy, 5 * unit, 0, TAU);
    ctx.fill();
    ctx.restore();

    // ロゴ
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${46 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = COLORS.tickLit;
    ctx.shadowBlur = 24 * unit;
    ctx.fillText("SECONDLY", w / 2, h * 0.16);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${15 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("― きみは、秒針。―", w / 2, h * 0.16 + 40 * unit);

    // 操作説明
    ctx.font = `700 ${14 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = COLORS.tier[1];
    ctx.fillText("おす = ゼンマイをまく（ちぢんで かわす）", w / 2, h * 0.76);
    ctx.fillStyle = COLORS.tier[2];
    ctx.fillText("はなす = なぎはらう！ためるほど 強い", w / 2, h * 0.76 + 24 * unit);

    // スタート(点滅)
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 4);
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 ${18 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("TAP TO START", w / 2, h * 0.87);
    ctx.globalAlpha = 1;

    if (this.best > 0) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${12 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`BEST ${formatScore(this.best)}`, w / 2, h * 0.92);
    }
    ctx.restore();
  }

  onUp(): void {
    sfxStart();
    this.app.manager.switchTo(new PlayScene(this.app));
  }
}
