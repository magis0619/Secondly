import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { setBgm } from "../audio/bgm.ts";
import { logEvent } from "../game/analytics.ts";
import { COLORS } from "../game/config.ts";
import { t } from "../game/i18n.ts";
import type { WorldEntry } from "../game/online.ts";
import { fetchTop, onlineEnabled, syncBest } from "../game/online.ts";
import type { SaveData } from "../game/save.ts";
import { ensureIdentity } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { HomeScene } from "./home.ts";

type Tab = "world" | "local";

export class RankingScene implements Scene {
  private t = 0;
  private save: SaveData = ensureIdentity();
  private tab: Tab = "local";
  private world: WorldEntry[] | null = null;
  private worldState: "idle" | "loading" | "ok" | "error" = "idle";
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private tabRects: { rect: Rect; tab: Tab }[] = [];

  constructor(
    private app: App,
    /** 直前のプレイの順位(ローカルタブのハイライト用)。なければ-1 */
    private highlightRank = -1,
  ) {}

  enter(): void {
    setBgm("menu");
    this.save = ensureIdentity();
    if (onlineEnabled()) {
      this.tab = "world";
      this.loadWorld();
    }
    logEvent("ranking_view", { tab: this.tab });
  }

  private loadWorld(): void {
    this.worldState = "loading";
    // 未送信のほんばんベストがあれば先に送信してから取得(旧セーブもここで自動送信される)
    void syncBest()
      .then(() => fetchTop())
      .then((list) => {
        if (list === null) {
          this.worldState = "error";
        } else {
          this.world = list;
          this.worldState = "ok";
        }
      });
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
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${26 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(t("rankingTitle"), w / 2, safeTop + 34 * u);

    // タブ
    this.tabRects = [];
    const tabs: { tab: Tab; label: string }[] = [
      { tab: "world", label: t("tabWorld") },
      { tab: "local", label: t("tabLocal") },
    ];
    tabs.forEach((tb, i) => {
      const rect: Rect = { x: w / 2 - 150 * u + i * 155 * u, y: safeTop + 58 * u, w: 145 * u, h: 38 * u };
      this.tabRects.push({ rect, tab: tb.tab });
      const sel = this.tab === tb.tab;
      drawButton(ctx, u, rect, tb.label, {
        bg: sel ? COLORS.accent : "#1c2743",
        fg: sel ? COLORS.bg : COLORS.textDim,
        fontPx: 13 * u,
      });
    });

    const listTop = safeTop + 116 * u;
    const rowH = 42 * u;

    if (this.tab === "local") {
      const list = this.save.ranking;
      if (list.length === 0) this.drawEmpty(ctx, t("noRecords"));
      list.forEach((e, i) => {
        const d = new Date(e.date);
        this.drawRow(ctx, listTop + i * rowH, i + 1, "", e.score, i + 1 === this.highlightRank, `${d.getMonth() + 1}/${d.getDate()}`);
      });
    } else {
      if (!onlineEnabled()) {
        this.drawEmpty(ctx, t("offline"), t("offlineHint"));
      } else if (this.worldState === "loading") {
        // スピナー
        ctx.strokeStyle = COLORS.accent;
        ctx.lineWidth = 3 * u;
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.4, 16 * u, this.t * 5, this.t * 5 + 4.2);
        ctx.stroke();
      } else if (this.worldState === "error") {
        this.drawEmpty(ctx, t("netError"), t("netErrorHint"));
      } else if (this.world && this.world.length === 0) {
        this.drawEmpty(ctx, t("worldEmpty"), t("worldEmptyHint"));
      } else if (this.world) {
        const maxRows = Math.floor((h - safeBottom - 100 * u - listTop) / rowH);
        this.world.slice(0, maxRows).forEach((e, i) => {
          this.drawRow(ctx, listTop + i * rowH, i + 1, e.name, e.score, e.id === this.save.playerId, "");
        });
      }
    }

    this.backRect = { x: w / 2 - 100 * u, y: h - safeBottom - 76 * u, w: 200 * u, h: 50 * u };
    drawButton(ctx, u, this.backRect, t("back"), { bg: "#25314f", fg: COLORS.text });
    ctx.restore();
  }

  private drawEmpty(ctx: CanvasRenderingContext2D, line1: string, line2 = t("playToRecord")): void {
    const { w, h, unit: u } = this.app.vp;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${14 * u}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(line1, w / 2, h * 0.4);
    ctx.fillText(line2, w / 2, h * 0.4 + 26 * u);
  }

  private drawRow(
    ctx: CanvasRenderingContext2D,
    y: number,
    rank: number,
    name: string,
    score: number,
    highlight: boolean,
    date: string,
  ): void {
    const { w, unit: u } = this.app.vp;
    if (highlight) {
      ctx.fillStyle = COLORS.accent2;
      ctx.globalAlpha = 0.16 + 0.08 * Math.sin(this.t * 5);
      ctx.beginPath();
      ctx.roundRect(w / 2 - 165 * u, y - 18 * u, 330 * u, 36 * u, 9 * u);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "center";
    ctx.font = `900 ${(rank <= 3 ? 19 : 14) * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = rank === 1 ? COLORS.gold : rank === 2 ? "#cdd8ee" : rank === 3 ? "#d9a066" : COLORS.textDim;
    ctx.fillText(rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : String(rank), w / 2 - 140 * u, y);
    if (name) {
      ctx.textAlign = "left";
      ctx.fillStyle = highlight ? COLORS.accent2 : COLORS.text;
      ctx.font = `700 ${13 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(name.slice(0, 12), w / 2 - 112 * u, y);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = highlight ? COLORS.accent2 : COLORS.text;
    ctx.font = `800 ${17 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${score}m`, w / 2 + (date ? 60 : 140) * u, y);
    if (date) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${11 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(date, w / 2 + 140 * u, y);
    }
  }

  onUp(x: number, y: number): void {
    for (const tr of this.tabRects) {
      if (inRect(tr.rect, x, y) && this.tab !== tr.tab) {
        sfxStart();
        this.tab = tr.tab;
        logEvent("ranking_view", { tab: tr.tab });
        if (tr.tab === "world" && this.worldState === "idle") this.loadWorld();
        return;
      }
    }
    if (inRect(this.backRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new HomeScene(this.app));
    }
  }
}
