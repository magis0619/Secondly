import type { App } from "../app.ts";
import { TAU } from "../core/math.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import { STAGES } from "../game/stages.ts";
import { loadSave } from "../game/save.ts";
import { drawCoinIcon } from "../render/hud.ts";
import { drawBackground } from "../render/renderer.ts";
import { StageSelectScene } from "./stageselect.ts";

export class TitleScene implements Scene {
  private t = 0;
  private coins = 0;
  private clearedCount = 0;

  constructor(private app: App) {}

  enter(): void {
    const save = loadSave();
    this.coins = save.coins;
    this.clearedCount = Object.values(save.stages).filter((s) => s.cleared).length;
  }

  update(dt: number): void {
    this.t += dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit } = vp;
    drawBackground(ctx, vp);

    // 背景: 地層のバンド
    const bands = ["#141d33", "#20283f", "#3a2f2a", "#57422f", "#6b4a35"];
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(0, h * (0.42 + i * 0.13), w, h * 0.14);
    });
    ctx.globalAlpha = 1;

    // デモ機体(ゆっくり上下, ドリル回転)
    const mx = w / 2;
    const my = h * 0.46 + Math.sin(this.t * 1.4) * 6 * unit;
    const s = 34 * unit;
    ctx.save();
    ctx.translate(mx, my);
    // バネ
    ctx.strokeStyle = COLORS.tier[1];
    ctx.lineWidth = 3 * unit;
    ctx.beginPath();
    const squash = 0.75 + 0.25 * Math.sin(this.t * 2.2);
    for (let i = 0; i <= 8; i++) {
      const yy = -s * 0.9 - s * 0.7 * squash * (1 - i / 8);
      ctx.lineTo((i % 2 === 0 ? -1 : 1) * s * 0.4, yy);
    }
    ctx.stroke();
    // 本体
    ctx.fillStyle = COLORS.machine;
    ctx.beginPath();
    ctx.roundRect(-s * 0.75, -s * 0.85, s * 1.5, s * 1.15, s * 0.4);
    ctx.fill();
    ctx.fillStyle = COLORS.drill;
    ctx.beginPath();
    ctx.arc(0, -s * 0.32, s * 0.28, 0, TAU);
    ctx.fill();
    // ドリル
    ctx.fillStyle = COLORS.tier[2];
    ctx.shadowColor = COLORS.tier[2];
    ctx.shadowBlur = 16 * unit;
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, s * 0.3);
    ctx.lineTo(s * 0.65, s * 0.3);
    ctx.lineTo(0, s * 1.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ロゴ
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${44 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = COLORS.drill;
    ctx.shadowBlur = 24 * unit;
    ctx.fillText("SPRING DRILL", w / 2, h * 0.15);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${16 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("― ためて、ぶちぬけ。―", w / 2, h * 0.15 + 40 * unit);

    // 進行サマリ
    if (this.coins > 0 || this.clearedCount > 0) {
      drawCoinIcon(ctx, w / 2 - 52 * unit, h * 0.25, 10 * unit);
      ctx.fillStyle = COLORS.coin;
      ctx.textAlign = "left";
      ctx.font = `800 ${14 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(String(this.coins), w / 2 - 40 * unit, h * 0.25);
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(`クリア ${this.clearedCount}/${STAGES.length}`, w / 2 + 10 * unit, h * 0.25);
      ctx.textAlign = "center";
    }

    // スタート(点滅)
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 4);
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 ${18 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("TAP TO START", w / 2, h * 0.87);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  onUp(): void {
    sfxStart();
    this.app.manager.switchTo(new StageSelectScene(this.app));
  }
}
