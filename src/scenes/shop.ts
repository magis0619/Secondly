import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxBuy, sfxDenied, sfxStart } from "../audio/sfx.ts";
import { COLORS, SHOTGUN_COST, UPGRADE_DEFS, WEAPONS } from "../game/config.ts";
import type { SaveData } from "../game/save.ts";
import { buyShotgun, buyUpgrade, loadSave, selectWeapon } from "../game/save.ts";
import { drawGemIcon } from "../render/hud.ts";
import { drawBackground } from "../render/renderer.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { StageSelectScene } from "./stageselect.ts";

/** アップグレード2種+ショットガン解放+武器切替(メタ進行の雛形) */
export class ShopScene implements Scene {
  private t = 0;
  private save: SaveData = loadSave();
  private buyRects: { rect: Rect; key: "magazine" | "armor" }[] = [];
  private shotgunRect: Rect | null = null;
  private weaponRects: { rect: Rect; weapon: "machinegun" | "shotgun" }[] = [];
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
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
    const { w, h, unit: u, safeTop, safeBottom } = vp;
    drawBackground(ctx, vp);

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${24 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("🔧 アップグレード", w / 2, safeTop + 32 * u);
    drawGemIcon(ctx, w / 2 - 26 * u, safeTop + 62 * u, 8 * u);
    ctx.fillStyle = COLORS.gem;
    ctx.textAlign = "left";
    ctx.font = `800 ${16 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(String(this.save.gems), w / 2 - 13 * u, safeTop + 62 * u);

    const cardW = 310 * u;
    const cardH = 86 * u;
    let cy = safeTop + 92 * u;
    this.buyRects = [];

    // 恒久強化カード
    for (const def of UPGRADE_DEFS) {
      const cx = w / 2 - cardW / 2;
      const lv = this.save.upgrades[def.key];
      const maxed = lv >= def.max;
      const cost = maxed ? 0 : def.costs[lv];
      const affordable = !maxed && this.save.gems >= cost;

      ctx.fillStyle = "#1c2743";
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 12 * u);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 ${15 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(def.name, cx + 16 * u, cy + 22 * u);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${10.5 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(def.desc, cx + 16 * u, cy + 42 * u);
      for (let pIdx = 0; pIdx < def.max; pIdx++) {
        ctx.fillStyle = pIdx < lv ? COLORS.aim : "#2a3352";
        ctx.beginPath();
        ctx.roundRect(cx + 16 * u + pIdx * 24 * u, cy + 58 * u, 18 * u, 7 * u, 3.5 * u);
        ctx.fill();
      }
      const bRect: Rect = { x: cx + cardW - 100 * u, y: cy + cardH / 2 - 20 * u, w: 86 * u, h: 40 * u };
      this.buyRects.push({ rect: bRect, key: def.key });
      drawButton(ctx, u, bRect, maxed ? "MAX" : `◆${cost}`, {
        bg: maxed || !affordable ? "#2a3352" : COLORS.tier[2],
        fg: maxed || !affordable ? COLORS.textDim : COLORS.bg,
        disabled: maxed,
        fontPx: 13 * u,
      });
      cy += cardH + 14 * u;
    }

    // ショットガン(解放 or 武器切替)
    const cx = w / 2 - cardW / 2;
    ctx.fillStyle = "#1c2743";
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 12 * u);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 ${15 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("ショットガン", cx + 16 * u, cy + 22 * u);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${10.5 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("大反動で大きく跳ぶ+まとめて砕く", cx + 16 * u, cy + 42 * u);

    this.shotgunRect = null;
    this.weaponRects = [];
    if (!this.save.shotgunOwned) {
      const bRect: Rect = { x: cx + cardW - 100 * u, y: cy + cardH / 2 - 20 * u, w: 86 * u, h: 40 * u };
      this.shotgunRect = bRect;
      const affordable = this.save.gems >= SHOTGUN_COST;
      drawButton(ctx, u, bRect, `◆${SHOTGUN_COST}`, {
        bg: affordable ? COLORS.tier[2] : "#2a3352",
        fg: affordable ? COLORS.bg : COLORS.textDim,
        fontPx: 13 * u,
      });
    } else {
      // 武器切替トグル
      const opts: ("machinegun" | "shotgun")[] = ["machinegun", "shotgun"];
      opts.forEach((wid, i) => {
        const bRect: Rect = {
          x: cx + cardW - 196 * u + i * 100 * u,
          y: cy + cardH / 2 - 18 * u,
          w: 92 * u,
          h: 36 * u,
        };
        this.weaponRects.push({ rect: bRect, weapon: wid });
        const selected = this.save.selectedWeapon === wid;
        drawButton(ctx, u, bRect, WEAPONS[wid].name, {
          bg: selected ? COLORS.aim : "#2a3352",
          fg: selected ? COLORS.bg : COLORS.textDim,
          fontPx: 11 * u,
        });
      });
    }
    cy += cardH + 14 * u;

    if (this.boughtFlash > 0) {
      ctx.globalAlpha = this.boughtFlash * 0.25;
      ctx.fillStyle = COLORS.gem;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    this.backRect = { x: w / 2 - 100 * u, y: h - safeBottom - 74 * u, w: 200 * u, h: 48 * u };
    drawButton(ctx, u, this.backRect, "もどる", { bg: "#25314f", fg: COLORS.text });
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
      } else sfxDenied();
      return;
    }
    if (this.shotgunRect && inRect(this.shotgunRect, x, y)) {
      const result = buyShotgun();
      if (result.ok) {
        this.save = result.save;
        this.boughtFlash = 1;
        sfxBuy();
      } else sfxDenied();
      return;
    }
    for (const wr of this.weaponRects) {
      if (!inRect(wr.rect, x, y)) continue;
      this.save = selectWeapon(wr.weapon);
      sfxStart();
      return;
    }
  }
}
