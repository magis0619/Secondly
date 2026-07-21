import type { App } from "../app.ts";
import { TAU } from "../core/math.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import { STAGES } from "../game/stages.ts";
import { loadSave } from "../game/save.ts";
import { drawGemIcon } from "../render/hud.ts";
import { drawBackground } from "../render/renderer.ts";
import { StageSelectScene } from "./stageselect.ts";

export class TitleScene implements Scene {
  private t = 0;
  private gems = 0;
  private starCount = 0;

  constructor(private app: App) {}

  enter(): void {
    const save = loadSave();
    this.gems = save.gems;
    this.starCount = Object.values(save.stages).reduce(
      (s, r) => s + r.stars.filter(Boolean).length,
      0,
    );
  }

  update(dt: number): void {
    this.t += dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit: u } = vp;
    drawBackground(ctx, vp);

    // 背景: 縦穴イメージ(左右の壁)
    ctx.fillStyle = "#141d33";
    ctx.fillRect(0, h * 0.3, w * 0.16, h);
    ctx.fillRect(w * 0.84, h * 0.3, w * 0.16, h);

    // デモ機体: 下に射撃しながらホバー
    const mx = w / 2 + Math.sin(this.t * 1.1) * 24 * u;
    const my = h * 0.5 + Math.sin(this.t * 2.3) * 10 * u;
    const r = 15 * u;
    // トレーサー
    if (Math.sin(this.t * 14) > -0.3) {
      ctx.strokeStyle = COLORS.ammo;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2.5 * u;
      ctx.beginPath();
      ctx.moveTo(mx, my + r);
      ctx.lineTo(mx + Math.sin(this.t * 7) * 12 * u, my + r + 90 * u);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff3c4";
      ctx.beginPath();
      ctx.moveTo(mx - 5 * u, my + r);
      ctx.lineTo(mx, my + r + 14 * u);
      ctx.lineTo(mx + 5 * u, my + r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.save();
    ctx.translate(mx, my);
    ctx.fillStyle = COLORS.player;
    ctx.shadowColor = COLORS.aim;
    ctx.shadowBlur = 16 * u;
    ctx.beginPath();
    ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.55);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.aim;
    ctx.beginPath();
    ctx.arc(0, -r * 0.15, r * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#4a5470";
    ctx.fillRect(-2.6 * u, r * 0.3, 5.2 * u, r * 1.3);
    ctx.restore();

    // ロゴ
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${42 * u}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = COLORS.aim;
    ctx.shadowBlur = 22 * u;
    ctx.fillText("RECOIL RISER", w / 2, h * 0.15);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${15 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("― 撃て。反動で、登れ。―", w / 2, h * 0.15 + 38 * u);

    // 進行サマリ
    if (this.gems > 0 || this.starCount > 0) {
      drawGemIcon(ctx, w / 2 - 60 * u, h * 0.24, 8 * u);
      ctx.fillStyle = COLORS.gem;
      ctx.textAlign = "left";
      ctx.font = `800 ${14 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(String(this.gems), w / 2 - 48 * u, h * 0.24);
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(`★ ${this.starCount}/${STAGES.length * 3}`, w / 2 + 12 * u, h * 0.24);
      ctx.textAlign = "center";
    }

    // 操作説明
    ctx.fillStyle = COLORS.aim;
    ctx.font = `700 ${13 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("下を撃つと反動でのぼれる / 足場でリロード", w / 2, h * 0.76);
    ctx.fillStyle = COLORS.gem;
    ctx.fillText("せまりくる溶岩より先に、頂上へ!", w / 2, h * 0.76 + 22 * u);

    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 4);
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 ${18 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("TAP TO START", w / 2, h * 0.88);
    ctx.restore();
  }

  onUp(): void {
    sfxStart();
    this.app.manager.switchTo(new StageSelectScene(this.app));
  }
}
