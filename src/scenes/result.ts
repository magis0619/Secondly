import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import { drawDecoDial } from "../render/clock.ts";
import { formatScore } from "../render/hud.ts";
import { drawBackground } from "../render/renderer.ts";
import { PlayScene } from "./play.ts";

export interface ResultParams {
  score: number;
  maxCombo: number;
  cleared: boolean;
  newBest: boolean;
  best: number;
}

const COUNTUP_TIME = 0.9;

export class ResultScene implements Scene {
  private t = 0;

  constructor(
    private app: App,
    private params: ResultParams,
  ) {}

  update(dt: number): void {
    this.t += dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, cx, cy, R, unit } = vp;
    const p = this.params;
    drawBackground(ctx, vp);
    ctx.save();
    ctx.globalAlpha = 0.35;
    drawDecoDial(ctx, cx, cy, R, unit, p.cleared ? 1 : 0.5);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 見出し
    ctx.fillStyle = p.cleared ? COLORS.tickLit : COLORS.danger;
    ctx.font = `900 ${30 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = p.cleared ? COLORS.tickLit : COLORS.danger;
    ctx.shadowBlur = 18 * unit;
    ctx.fillText(p.cleared ? "STAGE CLEAR!" : "CORE DOWN…", w / 2, h * 0.2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${13 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(p.cleared ? "60秒を守りきった！" : "コアが砕けた……", w / 2, h * 0.2 + 34 * unit);

    // スコア(カウントアップ)
    const ratio = Math.min(this.t / COUNTUP_TIME, 1);
    const shown = Math.floor(p.score * ratio);
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${44 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(formatScore(shown), w / 2, h * 0.42);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${12 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("SCORE", w / 2, h * 0.42 - 36 * unit);

    if (ratio >= 1 && p.newBest) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 6);
      ctx.fillStyle = COLORS.core;
      ctx.font = `800 ${16 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("★ NEW BEST! ★", w / 2, h * 0.42 + 40 * unit);
      ctx.globalAlpha = 1;
    }

    // サブ情報
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${13 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`BEST ${formatScore(p.best)}    MAX CHAIN ×${p.maxCombo}`, w / 2, h * 0.55);

    // リトライ
    const btnY = h * 0.7;
    const bw = 200 * unit;
    const bh = 52 * unit;
    ctx.fillStyle = COLORS.tier[2];
    ctx.beginPath();
    ctx.roundRect(w / 2 - bw / 2, btnY - bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = "#0a0e1a";
    ctx.font = `900 ${18 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("もういちど", w / 2, btnY);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${11 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 3);
    ctx.fillText("画面のどこでもタップでリトライ", w / 2, btnY + 46 * unit);
    ctx.restore();
  }

  onUp(): void {
    if (this.t < 0.5) return; // 終了直後の誤タップ防止
    sfxStart();
    this.app.manager.switchTo(new PlayScene(this.app));
  }
}
