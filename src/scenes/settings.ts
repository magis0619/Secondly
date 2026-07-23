import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { logEvent } from "../game/analytics.ts";
import { COLORS, LEGAL, ONLINE, VERSION } from "../game/config.ts";
import { t, toggleLang } from "../game/i18n.ts";
import { loadSave, setPlayerName } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";
import { HomeScene } from "./home.ts";

/** ⚙ 設定: 名前変更 / 言語 / プライバシーポリシー / バージョン */
export class SettingsScene implements Scene {
  private t = 0;
  private name = "";
  private rows: { rect: Rect; action: () => void; label: () => string }[] = [];
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private app: App) {}

  enter(): void {
    this.name = loadSave().playerName;
  }

  update(dt: number): void {
    this.t += dt;
  }

  private buildRows(): void {
    const { w, h, unit: u, safeTop } = this.app.vp;
    void h;
    this.rows = [];
    const rw = 300 * u;
    const rh = 54 * u;
    let y = safeTop + 90 * u;
    const add = (label: () => string, action: () => void) => {
      this.rows.push({ rect: { x: w / 2 - rw / 2, y, w: rw, h: rh }, action, label });
      y += rh + 14 * u;
    };
    add(
      () => `${t("changeName")}(${this.name})`,
      () => {
        const input = window.prompt(t("namePrompt", { n: ONLINE.NAME_MAX }), this.name);
        if (input !== null) {
          this.name = setPlayerName(input).playerName;
          logEvent("name_change");
        }
      },
    );
    add(
      () => t("languageRow"),
      () => {
        const lang = toggleLang();
        logEvent("lang_change", { lang });
      },
    );
    if (LEGAL.privacyUrl) {
      add(
        () => t("privacy"),
        () => window.open(LEGAL.privacyUrl, "_blank"),
      );
    }
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
    ctx.fillText(t("settingsTitle"), w / 2, safeTop + 40 * u);

    this.buildRows();
    for (const r of this.rows) {
      ctx.fillStyle = "#1c2743";
      ctx.beginPath();
      ctx.roundRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h, 13 * u);
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 ${13.5 * u}px ${FONT}`;
      ctx.fillText(r.label(), r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2);
    }

    // バージョン
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${11 * u}px ${FONT}`;
    ctx.fillText(`${t("version")} ${VERSION}`, w / 2, h - safeBottom - 104 * u);

    this.backRect = { x: w / 2 - 100 * u, y: h - safeBottom - 76 * u, w: 200 * u, h: 50 * u };
    drawButton(ctx, u, this.backRect, t("back"), { bg: "#25314f", fg: COLORS.text });
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    for (const r of this.rows) {
      if (inRect(r.rect, x, y)) {
        sfxStart();
        r.action();
        return;
      }
    }
    if (inRect(this.backRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new HomeScene(this.app));
    }
  }
}
