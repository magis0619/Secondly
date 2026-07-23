import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { TAU } from "../core/math.ts";
import { sfxBest, sfxStart } from "../audio/sfx.ts";
import { logEvent } from "../game/analytics.ts";
import { COLORS, SKINS, skinColor } from "../game/config.ts";
import { skinCond, skinName, t } from "../game/i18n.ts";
import type { SaveData } from "../game/save.ts";
import { isSkinUnlocked, loadSave, setSkin } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";
import { HomeScene } from "./home.ts";

/** 👕 きせかえ: バンダナ色の選択。解放条件はプレイ実績から自動判定 */
export class SkinsScene implements Scene {
  private t = 0;
  private save: SaveData = loadSave();
  private cells: { rect: Rect; id: string }[] = [];
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

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
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.textBaseline = "middle";

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${26 * u}px ${FONT}`;
    ctx.fillText(t("skinsTitle"), w / 2, safeTop + 34 * u);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${11.5 * u}px ${FONT}`;
    ctx.fillText(t("skinsSub"), w / 2, safeTop + 60 * u);

    // 2列グリッド
    this.cells = [];
    const cw = 160 * u;
    const chh = 118 * u;
    const gap = 12 * u;
    const x0 = w / 2 - cw - gap / 2;
    const y0 = safeTop + 84 * u;
    SKINS.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rect: Rect = { x: x0 + col * (cw + gap), y: y0 + row * (chh + gap), w: cw, h: chh };
      this.cells.push({ rect, id: s.id });
      const unlocked = isSkinUnlocked(s, this.save);
      const selected = this.save.skin === s.id;

      ctx.fillStyle = selected ? "#243a5e" : "#1c2743";
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14 * u);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = COLORS.accent;
        ctx.lineWidth = 2.5 * u;
        ctx.stroke();
      }

      // ミニキャラ(バンダナ色つき)
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + 46 * u;
      const r = 20 * u;
      ctx.globalAlpha = unlocked ? 1 : 0.35;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.82, cy - r, r * 1.64, r * 2, r * 0.72);
      ctx.fill();
      ctx.fillStyle = skinColor(s.id, this.t);
      ctx.fillRect(cx - r * 0.82, cy - r * 0.72, r * 1.64, r * 0.3);
      ctx.fillStyle = "#1c2743";
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + sd * r * 0.28, cy - r * 0.22, r * 0.14, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.textAlign = "center";
      ctx.fillStyle = unlocked ? COLORS.text : COLORS.textDim;
      ctx.font = `800 ${12.5 * u}px ${FONT}`;
      const dispName = skinName(s.id, s.name);
      ctx.fillText(unlocked ? dispName : `🔒 ${dispName}`, cx, rect.y + 82 * u);
      ctx.fillStyle = selected ? COLORS.accent : COLORS.textDim;
      ctx.font = `700 ${9.5 * u}px ${FONT}`;
      ctx.fillText(selected ? t("equipped") : skinCond(s.id, s.condText), cx, rect.y + 101 * u);
    });

    this.backRect = { x: w / 2 - 100 * u, y: h - safeBottom - 76 * u, w: 200 * u, h: 50 * u };
    drawButton(ctx, u, this.backRect, t("back"), { bg: "#25314f", fg: COLORS.text });
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    for (const c of this.cells) {
      if (inRect(c.rect, x, y)) {
        const skin = SKINS.find((s) => s.id === c.id)!;
        if (isSkinUnlocked(skin, this.save) && this.save.skin !== c.id) {
          this.save = setSkin(c.id);
          logEvent("skin_select", { id: c.id });
          sfxBest();
        }
        return;
      }
    }
    if (inRect(this.backRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new HomeScene(this.app));
    }
  }
}
