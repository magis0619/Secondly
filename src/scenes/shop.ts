import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxBuy, sfxDenied, sfxStart } from "../audio/sfx.ts";
import { COLORS, UPGRADE_DEFS } from "../game/config.ts";
import type { SaveData } from "../game/save.ts";
import { buyUpgrade, loadSave } from "../game/save.ts";
import { drawCoinIcon } from "../render/hud.ts";
import { drawBackground } from "../render/renderer.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { StageSelectScene } from "./stageselect.ts";

/** ステージ間の簡易アップグレードショップ(メタ進行の雛形) */
export class ShopScene implements Scene {
  private t = 0;
  private save: SaveData = loadSave();
  private buyRects: { rect: Rect; key: "chargeSpeed" | "armor" }[] = [];
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** 購入直後のフラッシュ演出用 */
  private boughtFlash = 0;

  constructor(private app: App) {}

  enter(): void {
    this.save = loadSave();
  }

  update(dt: number): void {
    this.t += dt;
    this.boughtFlash = Math.max(this.boughtFlash - dt * 2, 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit, safeTop, safeBottom } = vp;
    drawBackground(ctx, vp);

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${24 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("🔧 アップグレード", w / 2, safeTop + 34 * unit);

    // コイン残高
    drawCoinIcon(ctx, w / 2 - 30 * unit, safeTop + 68 * unit, 9 * unit);
    ctx.fillStyle = COLORS.coin;
    ctx.textAlign = "left";
    ctx.font = `800 ${17 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(String(this.save.coins), w / 2 - 16 * unit, safeTop + 68 * unit);

    // カード
    this.buyRects = [];
    const cardW = 300 * unit;
    const cardH = 108 * unit;
    UPGRADE_DEFS.forEach((def, i) => {
      const cx = w / 2 - cardW / 2;
      const cy = safeTop + 100 * unit + i * (cardH + 18 * unit);
      const lv = this.save.upgrades[def.key];
      const maxed = lv >= def.max;
      const cost = maxed ? 0 : def.costs[lv];
      const affordable = !maxed && this.save.coins >= cost;

      ctx.fillStyle = "#1c2743";
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 14 * unit);
      ctx.fill();

      ctx.textAlign = "left";
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 ${16 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(def.name, cx + 18 * unit, cy + 24 * unit);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${11 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(def.desc, cx + 18 * unit, cy + 46 * unit);

      // レベルピップ
      for (let p = 0; p < def.max; p++) {
        const px = cx + 18 * unit + p * 24 * unit;
        const py = cy + 72 * unit;
        ctx.fillStyle = p < lv ? COLORS.drill : "#2a3352";
        ctx.beginPath();
        ctx.roundRect(px, py, 18 * unit, 8 * unit, 4 * unit);
        ctx.fill();
      }

      // 購入ボタン
      const bRect: Rect = { x: cx + cardW - 108 * unit, y: cy + cardH / 2 - 22 * unit, w: 92 * unit, h: 44 * unit };
      this.buyRects.push({ rect: bRect, key: def.key });
      drawButton(ctx, unit, bRect, maxed ? "MAX" : `◆${cost}`, {
        bg: maxed ? "#2a3352" : affordable ? COLORS.tier[2] : "#2a3352",
        fg: maxed || !affordable ? COLORS.textDim : COLORS.bg,
        disabled: maxed,
        fontPx: 14 * unit,
      });
    });

    if (this.boughtFlash > 0) {
      ctx.globalAlpha = this.boughtFlash * 0.25;
      ctx.fillStyle = COLORS.coin;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    // もどる
    this.backRect = { x: w / 2 - 100 * unit, y: h - safeBottom - 78 * unit, w: 200 * unit, h: 50 * unit };
    drawButton(ctx, unit, this.backRect, "もどる", { bg: "#25314f", fg: COLORS.text });
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    if (inRect(this.backRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new StageSelectScene(this.app));
      return;
    }
    for (const b of this.buyRects) {
      if (!inRect(b.rect, x, y)) continue;
      const result = buyUpgrade(b.key);
      if (result.ok) {
        this.save = result.save;
        this.boughtFlash = 1;
        sfxBuy();
      } else {
        sfxDenied();
      }
      return;
    }
  }
}
