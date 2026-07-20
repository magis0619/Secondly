import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxDenied, sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import type { SaveData } from "../game/save.ts";
import { loadSave } from "../game/save.ts";
import { STAGES } from "../game/stages.ts";
import { drawCoinIcon, formatScore } from "../render/hud.ts";
import { drawBackground } from "../render/renderer.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { PlayScene } from "./play.ts";
import { ShopScene } from "./shop.ts";

/** ステージ選択(進行マップ)。縦に並ぶノード+ショップ導線 */
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
    const { w, h, unit, safeTop, safeBottom } = vp;
    drawBackground(ctx, vp);

    ctx.save();
    ctx.textBaseline = "middle";

    // ヘッダ
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${24 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("ステージ", w / 2, safeTop + 34 * unit);
    drawCoinIcon(ctx, w - 74 * unit, safeTop + 34 * unit, 9 * unit);
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.coin;
    ctx.font = `800 ${15 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(String(this.save.coins), w - 62 * unit, safeTop + 34 * unit);

    // ノード(縦、上から1→3。掘り進むイメージで下ほど深い)
    this.nodeRects = [];
    const startY = safeTop + 90 * unit;
    const gapY = 120 * unit;
    STAGES.forEach((stage, i) => {
      const y = startY + i * gapY;
      const locked = stage.id > this.save.stageUnlocked;
      const rec = this.save.stages[stage.id];
      const r: Rect = { x: w / 2 - 140 * unit, y: y - 40 * unit, w: 280 * unit, h: 84 * unit };
      this.nodeRects.push(r);

      // 接続線
      if (i < STAGES.length - 1) {
        ctx.strokeStyle = COLORS.textDim;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([4 * unit, 6 * unit]);
        ctx.lineWidth = 2 * unit;
        ctx.beginPath();
        ctx.moveTo(w / 2, y + 44 * unit);
        ctx.lineTo(w / 2, y + gapY - 44 * unit);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // カード
      ctx.fillStyle = locked ? "#151d33" : "#1c2743";
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 14 * unit);
      ctx.fill();
      if (!locked && stage.id === this.save.stageUnlocked && !rec?.cleared) {
        // 現在挑戦中のステージを光らせる
        ctx.strokeStyle = COLORS.drill;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 4);
        ctx.lineWidth = 2.5 * unit;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 番号バッジ
      ctx.fillStyle = locked ? "#2a3352" : rec?.cleared ? "#2c8a4f" : COLORS.tier[2];
      ctx.beginPath();
      ctx.arc(r.x + 42 * unit, y, 26 * unit, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = locked ? COLORS.textDim : "#ffffff";
      ctx.textAlign = "center";
      ctx.font = `900 ${20 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(locked ? "🔒" : rec?.cleared ? "✓" : String(stage.id), r.x + 42 * unit, y + 1 * unit);

      // 名前・記録
      ctx.textAlign = "left";
      ctx.fillStyle = locked ? COLORS.textDim : COLORS.text;
      ctx.font = `800 ${16 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`${stage.id}. ${stage.name}`, r.x + 80 * unit, y - 12 * unit);
      ctx.font = `700 ${11 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLORS.textDim;
      if (locked) {
        ctx.fillText("まえのステージをクリアでかいほう", r.x + 80 * unit, y + 12 * unit);
      } else if (rec?.cleared) {
        const sec = (rec.bestTimeMs / 1000).toFixed(1);
        ctx.fillText(`ベスト ${formatScore(rec.bestScore)} ・ ${sec}s`, r.x + 80 * unit, y + 12 * unit);
      } else {
        ctx.fillText(`ふかさ ${stage.rows.length}m ・ めやす ${stage.parTime}s`, r.x + 80 * unit, y + 12 * unit);
      }
    });

    // ショップボタン
    this.shopRect = {
      x: w / 2 - 110 * unit,
      y: h - safeBottom - 78 * unit,
      w: 220 * unit,
      h: 52 * unit,
    };
    drawButton(ctx, unit, this.shopRect, "🔧 アップグレード", { bg: "#25314f", fg: COLORS.text });
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
