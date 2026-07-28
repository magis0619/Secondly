import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxGo, sfxStart } from "../audio/sfx.ts";
import { setBgm } from "../audio/bgm.ts";
import { logEvent, logScreen } from "../game/analytics.ts";
import { COLORS, TICKETS } from "../game/config.ts";
import { t } from "../game/i18n.ts";
import { AD_STUB, STUB_AD_SEC, showNativeAd } from "../game/monetize.ts";
import { cancelTicketReminder, scheduleTicketReminder } from "../game/notify.ts";
import { addTickets, getTickets, loadSave, useTicket } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";
import { GameScene } from "./game.ts";
import { HomeScene } from "./home.ts";
import { StoreScene } from "./store.ts";

/**
 * ほんばん開始の共通フロー(ホーム/リザルトの両方から呼ぶ):
 * 広告除去済み → 無制限で即開始 / チケットあり → 1枚消費して即開始 /
 * チケット0 → 補充画面(AdGateScene)へ。
 */
export function startRanked(app: App): void {
  if (loadSave().adFree) {
    void cancelTicketReminder();
    app.manager.switchTo(new GameScene(app, "ranked"));
    return;
  }
  if (getTickets(TICKETS.DAILY) > 0) {
    useTicket();
    void cancelTicketReminder(); // ちゃんと遊べたので回復リマインドは不要
    app.manager.switchTo(new GameScene(app, "ranked"));
    return;
  }
  app.manager.switchTo(new AdGateScene(app));
}

/**
 * チケット切れ時の補充画面。広告視聴で+3回ぶん補充し、そのまま1枚使って開始する。
 */
export class AdGateScene implements Scene {
  private t = 0;
  private mode: "confirm" | "ad" = "confirm";
  private adLeft = STUB_AD_SEC;
  private started = false;
  /** 計測用: 何らかの形でこの画面を「決着」させたか(完了 or 明示的な離脱) */
  private exited = false;
  private watchRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private storeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private app: App) {}

  enter(): void {
    logScreen("adgate");
    // 収益ファネルの起点。adgate_view → ad_start → ad_result → ad_shown の差分が離脱
    logEvent("adgate_view");
    setBgm("menu");
    void scheduleTicketReminder(); // チケット切れを見せた=明日の回復を通知でリマインド
  }

  /** 広告を見ずにこの画面を離れた=収益機会の損失。行き先も添えて記録する */
  private logExit(to: string): void {
    if (this.exited) return;
    this.exited = true;
    logEvent("adgate_exit", { to });
  }

  private grantAndStart(): void {
    if (this.started) return;
    this.started = true;
    logEvent("ad_shown");
    logEvent("ticket_refill", { n: TICKETS.AD_REWARD });
    this.exited = true; // 正常完了。exit()での離脱計上を防ぐ
    addTickets(TICKETS.AD_REWARD);
    useTicket(); // このまま1回ぶん使って開始
    sfxGo();
    this.app.manager.switchTo(new GameScene(this.app, "ranked"));
  }

  update(dt: number): void {
    this.t += dt;
    if (this.mode === "ad") {
      this.adLeft -= dt;
      if (this.adLeft <= 0) this.grantAndStart();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit: u } = vp;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (this.mode === "confirm") {
      ctx.fillStyle = COLORS.accent2;
      ctx.font = `900 ${30 * u}px ${FONT}`;
      ctx.shadowColor = COLORS.accent2;
      ctx.shadowBlur = 16 * u;
      ctx.fillText(t("ranked"), w / 2, h * 0.18);
      ctx.shadowBlur = 0;

      // チケット切れの表示
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 ${16 * u}px ${FONT}`;
      ctx.fillText(t("gateUsedUp"), w / 2, h * 0.28);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${13 * u}px ${FONT}`;
      ctx.fillText(t("gateAdInfo", { n: TICKETS.AD_REWARD }), w / 2, h * 0.335);
      // チケットアイコン(からっぽ)
      ctx.font = `800 ${13 * u}px ${FONT}`;
      ctx.fillText(t("gateNone"), w / 2, h * 0.39);

      const bw = 250 * u;
      this.watchRect = { x: w / 2 - bw / 2, y: h * 0.46, w: bw, h: 56 * u };
      this.storeRect = { x: w / 2 - bw / 2, y: h * 0.46 + 72 * u, w: bw, h: 48 * u };
      this.backRect = { x: w / 2 - bw / 2, y: h * 0.46 + 134 * u, w: bw, h: 48 * u };
      drawButton(ctx, u, this.watchRect, t("gateWatch", { n: TICKETS.AD_REWARD }), { bg: COLORS.accent2, fg: "#fff", fontPx: 15 * u });
      drawButton(ctx, u, this.storeRect, t("gateStore"), { bg: "#25314f", fg: COLORS.text, fontPx: 12.5 * u });
      drawButton(ctx, u, this.backRect, t("back"), { bg: "#25314f", fg: COLORS.text, fontPx: 14 * u });
    } else {
      // 擬似広告(iOSではここがAdMobリワード広告に置き換わる)
      ctx.fillStyle = "#10131f";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2a3350";
      ctx.beginPath();
      ctx.roundRect(w / 2 - 130 * u, h * 0.3 - 90 * u, 260 * u, 180 * u, 14 * u);
      ctx.fill();
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `900 ${58 * u}px ${FONT}`;
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(this.t * 2.4);
      ctx.fillText("AD", w / 2, h * 0.3);
      ctx.globalAlpha = 1;

      const left = Math.max(this.adLeft, 0);
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 ${17 * u}px ${FONT}`;
      ctx.fillText(t("adLeft", { n: Math.ceil(left) }), w / 2, h * 0.48);
      const bw = 220 * u;
      ctx.fillStyle = "#25314f";
      ctx.beginPath();
      ctx.roundRect(w / 2 - bw / 2, h * 0.53, bw, 8 * u, 4 * u);
      ctx.fill();
      ctx.fillStyle = COLORS.accent;
      ctx.beginPath();
      ctx.roundRect(w / 2 - bw / 2, h * 0.53, bw * (1 - left / STUB_AD_SEC), 8 * u, 4 * u);
      ctx.fill();

      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${11 * u}px ${FONT}`;
      ctx.fillText(t("adStubNote1"), w / 2, h * 0.62);
      ctx.fillText(t("adStubNote2"), w / 2, h * 0.62 + 18 * u);
    }
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    if (this.mode !== "confirm") return;
    if (inRect(this.watchRect, x, y)) {
      sfxStart();
      logEvent("ad_start"); // 視聴の意思あり。ad_resultとの差分が「見ようとしたが出なかった」
      if (AD_STUB) {
        this.mode = "ad";
        this.adLeft = STUB_AD_SEC;
      } else {
        void showNativeAd().then((ok) => {
          // okは「広告が実際に表示できたか」。読み込み失敗でもゲームは進める設計だが、
          // 計測上は区別しないとフィルレート(在庫不足)が見えなくなる
          logEvent("ad_result", { ok });
          this.grantAndStart();
        });
      }
    } else if (inRect(this.storeRect, x, y)) {
      sfxStart();
      this.logExit("store");
      this.app.manager.switchTo(new StoreScene(this.app));
    } else if (inRect(this.backRect, x, y)) {
      sfxStart();
      this.logExit("home");
      this.app.manager.switchTo(new HomeScene(this.app));
    }
  }
}
