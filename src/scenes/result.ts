import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxBest, sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import { loadSave } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { AdGateScene } from "./adgate.ts";
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
  private bestPlayed = false;
  private buttons: { rect: Rect; action: () => void; label: string; bg?: string; fg?: string }[] = [];

  constructor(
    private app: App,
    private params: ResultParams,
  ) {}

  update(dt: number): void {
    this.t += dt;
    if (this.params.newBest && !this.bestPlayed && this.t > COUNTUP) {
      this.bestPlayed = true;
      sfxBest();
    }
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
    ctx.fillText(ranked ? "🌏 ほんばん" : "れんしゅう", w / 2, h * 0.07);

    ctx.fillStyle = COLORS.gold;
    ctx.font = `900 ${30 * u}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 16 * u;
    ctx.fillText("けっか", w / 2, h * 0.13);
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
        ctx.fillText("★ じこベスト こうしん! ★", w / 2, h * 0.38);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `700 ${14 * u}px -apple-system, system-ui, sans-serif`;
        ctx.fillText(`ベスト ${p.best}m`, w / 2, h * 0.38);
      }
      if (p.rank > 0) {
        ctx.fillStyle = p.rank <= 3 ? COLORS.accent2 : COLORS.accent;
        ctx.font = `900 ${20 * u}px -apple-system, system-ui, sans-serif`;
        ctx.fillText(`ランキング ${p.rank}い!`, w / 2, h * 0.45);
      }
      // 世界ランキングへの送信状態(ほんばんのみ)
      if (ranked && p.sync.state !== "none") {
        ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
        if (p.sync.state === "sending") {
          ctx.fillStyle = COLORS.textDim;
          ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 5);
          ctx.fillText("🌏 せかいランキングへ そうしんちゅう…", w / 2, h * 0.51);
          ctx.globalAlpha = 1;
        } else if (p.sync.state === "ok") {
          ctx.fillStyle = COLORS.accent;
          ctx.fillText("🌏 せかいランキングに そうしんしました!", w / 2, h * 0.51);
        } else {
          ctx.fillStyle = COLORS.danger;
          ctx.fillText("そうしんできませんでした(つぎに じどうで さいそう)", w / 2, h * 0.51);
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
      by += bh + 15 * u;
    };
    add("もういちど", () => {
      // ほんばんの再挑戦も広告ゲートを通る(広告除去済みなら直行)
      const next = ranked
        ? loadSave().adFree
          ? new GameScene(this.app, "ranked")
          : new AdGateScene(this.app)
        : new GameScene(this.app, "practice");
      this.app.manager.switchTo(next);
    }, COLORS.accent2);
    add("🏆 ランキング", () => this.app.manager.switchTo(new RankingScene(this.app, this.params.rank)), "#25314f", COLORS.text);
    add("ホームへ", () => this.app.manager.switchTo(new HomeScene(this.app)), "#25314f", COLORS.text);
    for (const b of this.buttons) drawButton(ctx, u, b.rect, b.label, { bg: b.bg, fg: b.fg });
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
