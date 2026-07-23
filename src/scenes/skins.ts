import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxBest, sfxStart } from "../audio/sfx.ts";
import { setBgm } from "../audio/bgm.ts";
import { logEvent } from "../game/analytics.ts";
import { CHARAS, COLORS, SKINS } from "../game/config.ts";
import { charaCond, charaName, skinCond, skinName, t } from "../game/i18n.ts";
import type { SaveData } from "../game/save.ts";
import { isUnlocked, loadSave, setChara, setSkin } from "../game/save.ts";
import { drawChara } from "../render/chara.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";
import { HomeScene } from "./home.ts";

type Tab = "chara" | "skin";

/** 👕 きせかえ: キャラ/バンダナの2タブ。解放条件はプレイ実績から自動判定 */
export class SkinsScene implements Scene {
  private t = 0;
  private save: SaveData = loadSave();
  private tab: Tab = "chara";
  private cells: { rect: Rect; id: string }[] = [];
  private tabRects: { rect: Rect; tab: Tab }[] = [];
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private app: App) {}

  enter(): void {
    setBgm("menu");
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

    // タブ(キャラ / バンダナ)
    this.tabRects = [];
    const tabW = 120 * u;
    const tabH = 34 * u;
    const tabs: { tab: Tab; label: string }[] = [
      { tab: "chara", label: t("tabChara") },
      { tab: "skin", label: t("tabBandana") },
    ];
    tabs.forEach(({ tab, label }, i) => {
      const rect: Rect = { x: w / 2 - tabW - 6 * u + i * (tabW + 12 * u), y: safeTop + 76 * u, w: tabW, h: tabH };
      this.tabRects.push({ rect, tab });
      const active = this.tab === tab;
      ctx.fillStyle = active ? "#243a5e" : "#161f36";
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12 * u);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = COLORS.accent;
        ctx.lineWidth = 2 * u;
        ctx.stroke();
      }
      ctx.fillStyle = active ? COLORS.text : COLORS.textDim;
      ctx.font = `800 ${13 * u}px ${FONT}`;
      ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
    });

    // 2列グリッド(行数が多い時はセルを縮めて1画面に収める)
    this.cells = [];
    const items =
      this.tab === "chara"
        ? CHARAS.map((c) => ({ id: c.id, name: charaName(c.id, c.name), cond: charaCond(c.id, c.condText), condRaw: c.cond }))
        : SKINS.map((s) => ({ id: s.id, name: skinName(s.id, s.name), cond: skinCond(s.id, s.condText), condRaw: s.cond }));
    const rows = Math.ceil(items.length / 2);
    const cw = 160 * u;
    const gap = 10 * u;
    const y0 = safeTop + 122 * u;
    const availH = h - safeBottom - 88 * u - y0;
    const chh = Math.min(118 * u, (availH - (rows - 1) * gap) / rows);
    const x0 = w / 2 - cw - gap / 2;
    const scale = chh / (118 * u); // セルが縮んだ分だけ中身も縮める

    items.forEach((it, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rect: Rect = { x: x0 + col * (cw + gap), y: y0 + row * (chh + gap), w: cw, h: chh };
      this.cells.push({ rect, id: it.id });
      const unlocked = isUnlocked(it.condRaw, this.save);
      const selected = this.tab === "chara" ? this.save.chara === it.id : this.save.skin === it.id;

      ctx.fillStyle = selected ? "#243a5e" : "#1c2743";
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14 * u);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = COLORS.accent;
        ctx.lineWidth = 2.5 * u;
        ctx.stroke();
      }

      // ミニキャラ(キャラタブ=各キャラ+今のバンダナ / バンダナタブ=今のキャラ+各色)
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + 42 * u * scale;
      const r = 17 * u * scale;
      ctx.save();
      ctx.globalAlpha = unlocked ? 1 : 0.35;
      ctx.translate(cx, cy);
      drawChara(ctx, {
        r,
        u: u * scale,
        t: this.t,
        chara: this.tab === "chara" ? it.id : this.save.chara,
        skin: this.tab === "chara" ? this.save.skin : it.id,
      });
      ctx.restore();

      ctx.textAlign = "center";
      ctx.fillStyle = unlocked ? COLORS.text : COLORS.textDim;
      ctx.font = `800 ${12.5 * u * scale}px ${FONT}`;
      ctx.fillText(unlocked ? it.name : `🔒 ${it.name}`, cx, rect.y + 82 * u * scale);
      ctx.fillStyle = selected ? COLORS.accent : COLORS.textDim;
      ctx.font = `700 ${9.5 * u * scale}px ${FONT}`;
      ctx.fillText(selected ? t("equipped") : it.cond, cx, rect.y + 101 * u * scale);
    });

    this.backRect = { x: w / 2 - 100 * u, y: h - safeBottom - 76 * u, w: 200 * u, h: 50 * u };
    drawButton(ctx, u, this.backRect, t("back"), { bg: "#25314f", fg: COLORS.text });
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    for (const tr of this.tabRects) {
      if (inRect(tr.rect, x, y) && this.tab !== tr.tab) {
        this.tab = tr.tab;
        sfxStart();
        return;
      }
    }
    for (const c of this.cells) {
      if (inRect(c.rect, x, y)) {
        if (this.tab === "chara") {
          const chara = CHARAS.find((k) => k.id === c.id)!;
          if (isUnlocked(chara.cond, this.save) && this.save.chara !== c.id) {
            this.save = setChara(c.id);
            logEvent("chara_select", { id: c.id });
            sfxBest();
          }
        } else {
          const skin = SKINS.find((s) => s.id === c.id)!;
          if (isUnlocked(skin.cond, this.save) && this.save.skin !== c.id) {
            this.save = setSkin(c.id);
            logEvent("skin_select", { id: c.id });
            sfxBest();
          }
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
