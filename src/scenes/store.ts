import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxBest, sfxStart } from "../audio/sfx.ts";
import { setBgm } from "../audio/bgm.ts";
import { logEvent } from "../game/analytics.ts";
import { COLORS, LEGAL } from "../game/config.ts";
import { hapticHeavy } from "../game/haptics.ts";
import { productDesc, productLabel, t } from "../game/i18n.ts";
import type { Product } from "../game/monetize.ts";
import { PRODUCTS, purchase, restorePurchases } from "../game/monetize.ts";
import type { SaveData } from "../game/save.ts";
import { addSupport, loadSave, setAdFree } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { HomeScene } from "./home.ts";
import { ThankYouOverlay } from "./thanks.ts";

/** 🛒 ストア: 広告除去(かいきり)+開発者支援(なんどでも)。購入処理はmonetize.tsに集約 */
export class StoreScene implements Scene {
  private t = 0;
  private save: SaveData = loadSave();
  private busy = false;
  private toast: { text: string; t: number } | null = null;
  private rows: { rect: Rect; p: Product }[] = [];
  private restoreRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private privacyRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private thanks: ThankYouOverlay;

  constructor(private app: App) {
    this.thanks = new ThankYouOverlay(app);
  }

  enter(): void {
    setBgm("menu");
    this.save = loadSave();
    // 開発ビルドのみ: 御礼オーバーレイの見た目確認用フック(web版purchase()はfalseを返すため)
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__thanks = (id = "tip_m", first = false) =>
        this.thanks.show(id, this.save.supporter + 1, first);
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.thanks.update(dt);
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
  }

  private buy(p: Product): void {
    if (this.busy) return;
    if (p.id === "noads" && this.save.adFree) return;
    this.busy = true;
    void purchase(p).then((ok) => {
      this.busy = false;
      if (!ok) return;
      logEvent("purchase", { id: p.id });
      if (p.id === "noads") {
        this.save = setAdFree();
        this.toast = { text: t("noadsToast"), t: 2.8 };
      } else {
        const before = this.save.supporter;
        this.save = addSupport();
        // 手厚い御礼オーバーレイ(初回=⭐スキン解放も告知)
        this.thanks.show(p.id, this.save.supporter, before === 0);
      }
      sfxBest();
      hapticHeavy();
    });
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
    ctx.font = `900 ${26 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(t("storeTitle"), w / 2, safeTop + 34 * u);

    this.rows = [];
    const cw = 330 * u;
    const cx0 = w / 2 - cw / 2;
    let y = safeTop + 72 * u;

    const card = (p: Product, ch: number, owned: boolean) => {
      const rect: Rect = { x: cx0, y, w: cw, h: ch };
      this.rows.push({ rect, p });
      ctx.fillStyle = owned ? "#1a2c22" : "#1c2743";
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12 * u);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 ${14 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(productLabel(p.id, p.label), rect.x + 14 * u, rect.y + 20 * u);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${10.5 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(productDesc(p.id, p.desc), rect.x + 14 * u, rect.y + ch - 16 * u);
      // 価格ピル
      const pw = 76 * u;
      const pr: Rect = { x: rect.x + rect.w - pw - 12 * u, y: rect.y + ch / 2 - 16 * u, w: pw, h: 32 * u };
      if (owned) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#6fdc8c";
        ctx.font = `800 ${12 * u}px -apple-system, system-ui, sans-serif`;
        ctx.fillText(t("owned"), pr.x + pr.w / 2, pr.y + pr.h / 2);
      } else {
        drawButton(ctx, u, pr, p.price, { bg: COLORS.gold, fg: "#3a2c00", fontPx: 12.5 * u });
      }
      y += ch + 12 * u;
    };

    // 広告除去(かいきり)
    card(PRODUCTS[0], 60 * u, this.save.adFree);

    // 開発者支援(なんどでも)
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
    y += 8 * u;
    ctx.fillText(t("supportHeader"), w / 2, y + 6 * u);
    y += 22 * u;
    for (let i = 1; i < PRODUCTS.length; i++) card(PRODUCTS[i], 56 * u, false);

    if (this.save.supporter > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.gold;
      ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(t("supportCount", { n: this.save.supporter }), w / 2, y + 8 * u);
      y += 24 * u;
    }

    // リストア+注記
    ctx.textAlign = "center";
    this.restoreRect = { x: w / 2 - 120 * u, y: y + 6 * u, w: 240 * u, h: 30 * u };
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${11 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(t("restore"), w / 2, this.restoreRect.y + 15 * u);
    ctx.font = `700 ${10 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(t("devPurchaseNote"), w / 2, this.restoreRect.y + 40 * u);
    // プライバシーポリシー(URL設定時のみ。広告/課金ありアプリの審査必須要件)
    if (LEGAL.privacyUrl) {
      this.privacyRect = { x: w / 2 - 120 * u, y: this.restoreRect.y + 54 * u, w: 240 * u, h: 26 * u };
      ctx.fillStyle = COLORS.accent;
      ctx.font = `700 ${11 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(t("privacy"), w / 2, this.privacyRect.y + 13 * u);
    } else {
      this.privacyRect = { x: 0, y: 0, w: 0, h: 0 };
    }

    this.backRect = { x: w / 2 - 100 * u, y: h - safeBottom - 76 * u, w: 200 * u, h: 50 * u };
    drawButton(ctx, u, this.backRect, t("back"), { bg: "#25314f", fg: COLORS.text });

    // トースト
    if (this.toast) {
      const a = Math.min(this.toast.t / 0.3, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(20,28,50,0.92)";
      ctx.beginPath();
      ctx.roundRect(w / 2 - 160 * u, h * 0.8 - 22 * u, 320 * u, 44 * u, 12 * u);
      ctx.fill();
      ctx.fillStyle = COLORS.gold;
      ctx.textAlign = "center";
      ctx.font = `800 ${12.5 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(this.toast.text, w / 2, h * 0.8);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    this.thanks.draw(ctx); // 最前面
  }

  onUp(x: number, y: number): void {
    if (this.thanks.onUp(x, y)) return; // 御礼オーバーレイが最優先でタップ吸収
    for (const row of this.rows) {
      if (inRect(row.rect, x, y)) {
        sfxStart();
        this.buy(row.p);
        return;
      }
    }
    if (inRect(this.restoreRect, x, y)) {
      logEvent("restore");
      void restorePurchases().then((ids) => {
        if (ids.includes("noads")) this.save = setAdFree();
        this.toast = { text: ids.length > 0 ? t("restoreDone") : t("restoreNone"), t: 2.2 };
      });
      return;
    }
    if (LEGAL.privacyUrl && inRect(this.privacyRect, x, y)) {
      window.open(LEGAL.privacyUrl, "_blank");
      return;
    }
    if (inRect(this.backRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new HomeScene(this.app));
    }
  }
}
