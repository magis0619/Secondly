import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxDenied, sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import type { SaveData } from "../game/save.ts";
import { loadSave } from "../game/save.ts";
import { STAGES } from "../game/stages.ts";
import { drawGemIcon, formatScore } from "../render/hud.ts";
import { drawBackground } from "../render/renderer.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { PlayScene } from "./play.ts";
import { ShopScene } from "./shop.ts";

export class StageSelectScene implements Scene {
  private t = 0;
  private save: SaveData = loadSave();
  private nodeRects: Rect[] = [];
  private shopRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private app: App) {}

  enter(): void {
    this.save = loadSave();
  }

  update(dt: number): void {
    this.t += dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit: u, safeTop, safeBottom } = vp;
    drawBackground(ctx, vp);

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${24 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("ステージ", w / 2, safeTop + 34 * u);
    drawGemIcon(ctx, w - 76 * u, safeTop + 34 * u, 8 * u);
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.gem;
    ctx.font = `800 ${15 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(String(this.save.gems), w - 64 * u, safeTop + 34 * u);

    this.nodeRects = [];
    const startY = safeTop + 96 * u;
    const gapY = 122 * u;
    STAGES.forEach((stage, i) => {
      const y = startY + i * gapY;
      const locked = stage.id > this.save.stageUnlocked;
      const rec = this.save.stages[stage.id];
      const r: Rect = { x: w / 2 - 145 * u, y: y - 42 * u, w: 290 * u, h: 88 * u };
      this.nodeRects.push(r);

      if (i < STAGES.length - 1) {
        ctx.strokeStyle = COLORS.textDim;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([4 * u, 6 * u]);
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.moveTo(w / 2, y + 46 * u);
        ctx.lineTo(w / 2, y + gapY - 46 * u);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = locked ? "#151d33" : "#1c2743";
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 14 * u);
      ctx.fill();
      if (!locked && stage.id === this.save.stageUnlocked && !rec?.stars[0]) {
        ctx.strokeStyle = COLORS.aim;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 4);
        ctx.lineWidth = 2.5 * u;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 番号バッジ
      ctx.fillStyle = locked ? "#2a3352" : rec?.stars[0] ? "#2c8a4f" : COLORS.tier[2];
      ctx.beginPath();
      ctx.arc(r.x + 42 * u, y - 6 * u, 24 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = locked ? COLORS.textDim : "#ffffff";
      ctx.textAlign = "center";
      ctx.font = `900 ${18 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(locked ? "🔒" : String(stage.id), r.x + 42 * u, y - 5 * u);
      // 星
      ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
      const stars = rec?.stars ?? [false, false, false];
      ctx.fillStyle = COLORS.gem;
      ctx.fillText(
        stars.map((s) => (s ? "★" : "☆")).join(""),
        r.x + 42 * u,
        y + 26 * u,
      );

      ctx.textAlign = "left";
      ctx.fillStyle = locked ? COLORS.textDim : COLORS.text;
      ctx.font = `800 ${15 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`${stage.id}. ${stage.name}`, r.x + 82 * u, y - 14 * u);
      ctx.font = `700 ${10.5 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLORS.textDim;
      if (locked) {
        ctx.fillText("まえのステージをクリアでかいほう", r.x + 82 * u, y + 10 * u);
      } else if (rec?.stars[0]) {
        ctx.fillText(
          `ベスト ${formatScore(rec.bestScore)} ・ ${(rec.bestTimeMs / 1000).toFixed(1)}s`,
          r.x + 82 * u,
          y + 10 * u,
        );
      } else {
        ctx.fillText(`たかさ ${buildDepth(stage.id)}m ・ めやす ${stage.parTime}s`, r.x + 82 * u, y + 10 * u);
      }
    });

    this.shopRect = { x: w / 2 - 110 * u, y: h - safeBottom - 78 * u, w: 220 * u, h: 52 * u };
    drawButton(ctx, u, this.shopRect, "🔧 アップグレード", { bg: "#25314f", fg: COLORS.text });
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    if (inRect(this.shopRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new ShopScene(this.app));
      return;
    }
    for (let i = 0; i < this.nodeRects.length; i++) {
      if (!inRect(this.nodeRects[i], x, y)) continue;
      const stage = STAGES[i];
      if (stage.id > this.save.stageUnlocked) {
        sfxDenied();
        return;
      }
      sfxStart();
      this.app.manager.switchTo(new PlayScene(this.app, stage));
      return;
    }
  }
}

function buildDepth(stageId: number): number {
  const def = STAGES.find((s) => s.id === stageId)!;
  return def.chunks.reduce((n, c) => n + c.rows.length, 0);
}
