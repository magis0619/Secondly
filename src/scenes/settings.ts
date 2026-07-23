import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart, setSfxMuted } from "../audio/sfx.ts";
import { setBgm, setBgmMuted } from "../audio/bgm.ts";
import { logEvent } from "../game/analytics.ts";
import { COLORS, LEGAL, ONLINE, VERSION } from "../game/config.ts";
import { t, toggleLang } from "../game/i18n.ts";
import { loadSave, setPlayerName, toggleBgmOff, toggleSfxOff } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";
import { HomeScene } from "./home.ts";
import { HowToModal } from "./howto.ts";

/** ⚙ 設定: 名前変更 / 言語 / あそびかた / プライバシーポリシー / バージョン */
export class SettingsScene implements Scene {
  private t = 0;
  private name = "";
  private bgmOff = false;
  private sfxOff = false;
  private rows: { rect: Rect; action: () => void; label: () => string; sub?: () => string }[] = [];
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private howto: HowToModal;

  constructor(private app: App) {
    this.howto = new HowToModal(app);
  }

  enter(): void {
    setBgm("menu");
    const save = loadSave();
    this.name = save.playerName;
    this.bgmOff = save.bgmOff;
    this.sfxOff = save.sfxOff;
  }

  update(dt: number): void {
    this.t += dt;
    this.howto.update(dt);
  }

  private buildRows(): void {
    const { w, h, unit: u, safeTop } = this.app.vp;
    void h;
    this.rows = [];
    const rw = 300 * u;
    let y = safeTop + 90 * u;
    const add = (label: () => string, action: () => void, sub?: () => string) => {
      const rh = (sub ? 66 : 54) * u;
      this.rows.push({ rect: { x: w / 2 - rw / 2, y, w: rw, h: rh }, action, label, sub });
      y += rh + 14 * u;
    };
    add(
      () => t("changeName"),
      () => {
        const input = window.prompt(t("namePrompt", { n: ONLINE.NAME_MAX }), this.name);
        if (input !== null) {
          this.name = setPlayerName(input).playerName;
          logEvent("name_change");
        }
      },
      () => this.name, // 現在の名前は2行目に表示(長い名前でも崩れない)
    );
    add(
      () => t("languageRow"),
      () => {
        const lang = toggleLang();
        logEvent("lang_change", { lang });
      },
    );
    add(
      () => t("bgmRow", { state: this.bgmOff ? t("stateOff") : t("stateOn") }),
      () => {
        this.bgmOff = toggleBgmOff();
        setBgmMuted(this.bgmOff);
        logEvent("bgm_toggle", { off: this.bgmOff });
      },
    );
    add(
      () => t("sfxRow", { state: this.sfxOff ? t("stateOff") : t("stateOn") }),
      () => {
        this.sfxOff = toggleSfxOff();
        setSfxMuted(this.sfxOff);
        logEvent("sfx_toggle", { off: this.sfxOff });
      },
    );
    add(
      () => t("howtoRow"),
      () => this.howto.show(),
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
      if (r.sub) {
        ctx.fillText(r.label(), r.rect.x + r.rect.w / 2, r.rect.y + 22 * u);
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `700 ${11.5 * u}px ${FONT}`;
        ctx.fillText(r.sub(), r.rect.x + r.rect.w / 2, r.rect.y + 46 * u);
      } else {
        ctx.fillText(r.label(), r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2);
      }
    }

    // バージョン
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${11 * u}px ${FONT}`;
    ctx.fillText(`${t("version")} ${VERSION}`, w / 2, h - safeBottom - 104 * u);

    this.backRect = { x: w / 2 - 100 * u, y: h - safeBottom - 76 * u, w: 200 * u, h: 50 * u };
    drawButton(ctx, u, this.backRect, t("back"), { bg: "#25314f", fg: COLORS.text });
    ctx.restore();
    this.howto.draw(ctx);
  }

  onUp(x: number, y: number): void {
    if (this.howto.onUp(x, y)) return;
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
