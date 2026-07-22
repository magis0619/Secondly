import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS, LAYOUT, ONLINE } from "../game/config.ts";
import { ensureIdentity, setPlayerName } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { AdGateScene } from "./adgate.ts";
import { GameScene } from "./game.ts";
import { RankingScene } from "./ranking.ts";
import { StoreScene } from "./store.ts";

export class HomeScene implements Scene {
  private t = 0;
  private best = 0;
  private name = "";
  private adFree = false;
  private supporter = 0;
  private practiceRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private rankedRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private rankRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private storeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private nameRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private app: App) {}

  enter(): void {
    const save = ensureIdentity();
    this.best = save.best;
    this.name = save.playerName;
    this.adFree = save.adFree;
    this.supporter = save.supporter;
  }

  update(dt: number): void {
    this.t += dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit: u } = vp;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // デコ: ジグザグの足場と跳ねるキャラ
    const cx = w / 2;
    const baseY = h * 0.52;
    const hop = Math.abs(Math.sin(this.t * 2.4));
    const step = Math.floor(this.t * 2.4 / Math.PI) % 4; // 今いる段
    for (let i = 0; i < 4; i++) {
      const px = cx + (i % 2 === 0 ? -1 : 1) * LAYOUT.COL_OFFSET * u * 0.8;
      const py = baseY - i * 48 * u;
      ctx.fillStyle = COLORS.platform;
      ctx.beginPath();
      ctx.roundRect(px - 48 * u, py, 96 * u, 13 * u, 6 * u);
      ctx.fill();
      ctx.fillStyle = COLORS.platformTop;
      ctx.fillRect(px - 48 * u, py, 96 * u, 4 * u);
      if (i === step) {
        const r = 14 * u;
        ctx.fillStyle = COLORS.player;
        ctx.shadowColor = COLORS.accent;
        ctx.shadowBlur = 10 * u;
        ctx.beginPath();
        ctx.roundRect(px - r * 0.8, py - r * 2 - 4 * u - hop * 18 * u, r * 1.6, r * 2, r * 0.7);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.accent2;
        ctx.fillRect(px - r * 0.8, py - r * 2 - 4 * u - hop * 18 * u + r * 0.25, r * 1.6, r * 0.28);
      }
    }

    // ロゴ
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${52 * u}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 22 * u;
    ctx.fillText("CLIMB 30", w / 2, h * 0.14);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${15 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("30びょうで どこまで のぼれる?", w / 2, h * 0.14 + 42 * u);

    if (this.best > 0) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = `800 ${16 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`ベスト ${this.best}m`, w / 2, h * 0.23);
    }

    // プレイヤー名(タップで変更)。支援者は⭐
    this.nameRect = { x: w / 2 - 110 * u, y: h * 0.265, w: 220 * u, h: 30 * u };
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${13 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${this.supporter > 0 ? "⭐ " : ""}${this.name} ✏️`, w / 2, this.nameRect.y + 15 * u);

    // ボタン: れんしゅう / ほんばん(+広告の明示) / ランキング・ストア
    const bw = 250 * u;
    const bx = w / 2 - bw / 2;
    this.practiceRect = { x: bx, y: h * 0.6, w: bw, h: 50 * u };
    this.rankedRect = { x: bx, y: h * 0.6 + 64 * u, w: bw, h: 56 * u };
    drawButton(ctx, u, this.practiceRect, "れんしゅう", { bg: COLORS.accent, fontPx: 17 * u });
    drawButton(ctx, u, this.rankedRect, "🌏 ほんばん", { bg: COLORS.accent2, fontPx: 19 * u });
    let rowY = this.rankedRect.y + this.rankedRect.h + 12 * u;
    if (!this.adFree) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${10.5 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("▶ ほんばんは プレイまえに こうこくが ながれます", w / 2, rowY);
      rowY += 20 * u;
    }
    const half = (bw - 10 * u) / 2;
    this.rankRect = { x: bx, y: rowY, w: half, h: 44 * u };
    this.storeRect = { x: bx + half + 10 * u, y: rowY, w: half, h: 44 * u };
    drawButton(ctx, u, this.rankRect, "🏆 ランキング", { bg: "#25314f", fg: COLORS.text, fontPx: 12.5 * u });
    drawButton(ctx, u, this.storeRect, "🛒 ストア", { bg: "#25314f", fg: COLORS.text, fontPx: 12.5 * u });
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    if (inRect(this.practiceRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new GameScene(this.app, "practice"));
    } else if (inRect(this.rankedRect, x, y)) {
      sfxStart();
      // 広告除去済みなら即スタート、そうでなければ広告ゲート(広告が流れることを明示)
      this.app.manager.switchTo(this.adFree ? new GameScene(this.app, "ranked") : new AdGateScene(this.app));
    } else if (inRect(this.rankRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new RankingScene(this.app));
    } else if (inRect(this.storeRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new StoreScene(this.app));
    } else if (inRect(this.nameRect, x, y)) {
      const input = window.prompt(`なまえ(${ONLINE.NAME_MAX}もじまで)`, this.name);
      if (input !== null) {
        this.name = setPlayerName(input).playerName;
      }
    }
  }
}
