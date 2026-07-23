import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxBest, sfxFanfare, sfxFanfareBig, sfxStart } from "../audio/sfx.ts";
import { setBgm } from "../audio/bgm.ts";
import { TAU, clamp } from "../core/math.ts";
import { Fx } from "../fx/particles.ts";
import { COLORS } from "../game/config.ts";
import { hapticHeavy } from "../game/haptics.ts";
import { t } from "../game/i18n.ts";
import { logEvent } from "../game/analytics.ts";
import { requestReview } from "../game/monetize.ts";
import { shareResult } from "../game/share.ts";
import { loadSave } from "../game/save.ts";
import { drawFx } from "../render/fx.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";
import { startRanked } from "./adgate.ts";
import type { GameMode } from "./game.ts";
import { GameScene } from "./game.ts";
import { HomeScene } from "./home.ts";
import { RankingScene } from "./ranking.ts";

/** 世界ランキングへの送信状態。GameSceneが非同期に書き換え、ここで表示する */
export interface SyncStatus {
  state: "none" | "sending" | "ok" | "fail";
}

export interface ResultParams {
  score: number;
  rank: number; // 1始まり。圏外は-1
  newBest: boolean;
  best: number;
  mode: GameMode;
  sync: SyncStatus;
}

const COUNTUP = 0.8;

export class ResultScene implements Scene {
  private t = 0;
  private celebrated = false;
  private fx = new Fx();
  private confettiAcc = 0;
  private buttons: { rect: Rect; action: () => void; label: string; bg?: string; fg?: string }[] = [];

  constructor(
    private app: App,
    private params: ResultParams,
  ) {}

  enter(): void {
    setBgm("menu");
  }

  update(dt: number): void {
    this.t += dt;
    this.fx.update(dt);
    const p = this.params;
    const { vp } = this.app;
    const u = vp.unit;

    // カウントアップ完了時のお祝い(1〜3位はファンファーレ。音の渋滞を避けてsfxBestは鳴らさない)
    if (!this.celebrated && this.t > COUNTUP) {
      this.celebrated = true;
      if (p.rank === 1) {
        sfxFanfareBig();
        hapticHeavy();
        this.fx.burst(vp.w / 2, vp.h * 0.45, COLORS.gold, 30, 260 * u, 4.5 * u);
        this.fx.ring(vp.w / 2, vp.h * 0.45, COLORS.gold, 150 * u, 4 * u, 0.5);
      } else if (p.rank === 2 || p.rank === 3) {
        sfxFanfare();
        hapticHeavy();
        this.fx.burst(vp.w / 2, vp.h * 0.45, p.rank === 2 ? "#cdd8ee" : "#d9a066", 18, 180 * u, 3.5 * u);
      } else if (p.newBest) {
        sfxBest();
      }
      // 節目のプレイ回数(5/25/60回目)かつ自己ベスト更新時だけレビューを促す(乱発防止)
      if (p.newBest && [5, 25, 60].includes(loadSave().playCount)) {
        logEvent("review_prompt");
        void requestReview();
      }
    }

    // 1位: 紙吹雪が降り続ける
    if (this.celebrated && p.rank === 1) {
      this.confettiAcc += dt;
      if (this.confettiAcc >= 0.22) {
        this.confettiAcc = 0;
        const colors = [COLORS.gold, COLORS.accent, COLORS.accent2, "#6fdc8c", "#fff8ef"];
        const cx = vp.w * (0.12 + Math.random() * 0.76);
        this.fx.burst(cx, vp.h * (0.06 + Math.random() * 0.2), colors[Math.floor(Math.random() * colors.length)], 4, 90 * u, 3.2 * u);
      }
    }
  }

  /** 1〜3位の大袈裟な順位表示(1位は回転光線つき) */
  private drawBigRank(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit: u } = vp;
    const p = this.params;
    const cy = h * 0.455;
    // ぽよんと登場(オーバーシュート付きイージング)
    const at = clamp((this.t - COUNTUP) / 0.45, 0, 1);
    const c1 = 1.70158;
    const pop = 1 + (c1 + 1) * Math.pow(at - 1, 3) + c1 * Math.pow(at - 1, 2);
    const pulse = 1 + 0.035 * Math.sin(this.t * 5);

    ctx.save();
    ctx.translate(w / 2, cy);
    ctx.scale(pop * pulse, pop * pulse);
    if (p.rank === 1) {
      // 回転する放射光線
      ctx.save();
      ctx.rotate(this.t * 0.5);
      ctx.fillStyle = COLORS.gold;
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < 12; i++) {
        ctx.rotate(TAU / 12);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(130 * u, -14 * u);
        ctx.lineTo(130 * u, 14 * u);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.lineJoin = "round";
      ctx.font = `900 ${32 * u}px ${FONT}`;
      ctx.strokeStyle = "#5a3a00";
      ctx.lineWidth = 7 * u;
      ctx.strokeText(t("rankBig1"), 0, 0);
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 18 * u;
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(t("rankBig1"), 0, 0);
      ctx.shadowBlur = 0;
    } else {
      const color = p.rank === 2 ? "#cdd8ee" : "#d9a066";
      const label = `${p.rank === 2 ? "🥈" : "🥉"} ${t(p.rank === 2 ? "rankBig2" : "rankBig3")}`;
      ctx.lineJoin = "round";
      ctx.font = `900 ${25 * u}px ${FONT}`;
      ctx.strokeStyle = "#141c33";
      ctx.lineWidth = 6 * u;
      ctx.strokeText(label, 0, 0);
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 * u;
      ctx.fillStyle = color;
      ctx.fillText(label, 0, 0);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit: u } = vp;
    const p = this.params;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // モードバッジ
    const ranked = p.mode === "ranked";
    ctx.fillStyle = ranked ? COLORS.accent2 : COLORS.textDim;
    ctx.font = `800 ${13 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(ranked ? t("ranked") : t("practice"), w / 2, h * 0.07);

    ctx.fillStyle = COLORS.gold;
    ctx.font = `900 ${30 * u}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 16 * u;
    ctx.fillText(t("resultTitle"), w / 2, h * 0.13);
    ctx.shadowBlur = 0;

    // 高度カウントアップ
    const ratio = Math.min(this.t / COUNTUP, 1);
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${64 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${Math.floor(p.score * ratio)}m`, w / 2, h * 0.28);

    if (ratio >= 1) {
      if (p.newBest) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 6);
        ctx.fillStyle = COLORS.gold;
        ctx.font = `800 ${18 * u}px -apple-system, system-ui, sans-serif`;
        ctx.fillText(t("newBest"), w / 2, h * 0.38);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `700 ${14 * u}px -apple-system, system-ui, sans-serif`;
        ctx.fillText(`${t("bestLabel")} ${p.best}m`, w / 2, h * 0.38);
      }
      if (p.rank > 0 && p.rank <= 3) {
        this.drawBigRank(ctx);
      } else if (p.rank > 0) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = `900 ${20 * u}px -apple-system, system-ui, sans-serif`;
        ctx.fillText(t("rankIn", { n: p.rank }), w / 2, h * 0.45);
      }
      // 世界ランキングへの送信状態(ほんばんのみ)
      if (ranked && p.sync.state !== "none") {
        ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
        if (p.sync.state === "sending") {
          ctx.fillStyle = COLORS.textDim;
          ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 5);
          ctx.fillText(t("syncSending"), w / 2, h * 0.51);
          ctx.globalAlpha = 1;
        } else if (p.sync.state === "ok") {
          ctx.fillStyle = COLORS.accent;
          ctx.fillText(t("syncOk"), w / 2, h * 0.51);
        } else {
          ctx.fillStyle = COLORS.danger;
          ctx.fillText(t("syncFail"), w / 2, h * 0.51);
        }
      }
    }

    // ボタン
    this.buttons = [];
    const bw = 230 * u;
    const bh = 52 * u;
    let by = h * 0.58;
    const add = (label: string, action: () => void, bg?: string, fg?: string) => {
      const rect = { x: w / 2 - bw / 2, y: by, w: bw, h: bh };
      this.buttons.push({ rect, action, label, bg, fg });
      by += bh + 13 * u;
    };
    add(t("again"), () => {
      // ほんばんはチケット消費(切れていれば補充画面へ)
      if (ranked) startRanked(this.app);
      else this.app.manager.switchTo(new GameScene(this.app, "practice"));
    }, COLORS.accent2);
    add(t("shareBtn"), () => void shareResult(p.score, ranked), "#3b74d0", "#fff");
    add(t("rankingBtn"), () => this.app.manager.switchTo(new RankingScene(this.app, this.params.rank)), "#25314f", COLORS.text);
    add(t("toHome"), () => this.app.manager.switchTo(new HomeScene(this.app)), "#25314f", COLORS.text);
    for (const b of this.buttons) drawButton(ctx, u, b.rect, b.label, { bg: b.bg, fg: b.fg });
    drawFx(ctx, vp, this.fx);
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    if (this.t < 0.4) return;
    for (const b of this.buttons) {
      if (inRect(b.rect, x, y)) {
        sfxStart();
        b.action();
        return;
      }
    }
  }
}
