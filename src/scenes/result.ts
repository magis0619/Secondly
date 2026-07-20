import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import type { StageDef } from "../game/stages.ts";
import { STAGES } from "../game/stages.ts";
import { drawCoinIcon, formatScore } from "../render/hud.ts";
import { drawBackground } from "../render/renderer.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { PlayScene } from "./play.ts";
import { ShopScene } from "./shop.ts";
import { StageSelectScene } from "./stageselect.ts";

export interface ResultParams {
  stage: StageDef;
  score: number;
  timeMs: number;
  cleared: boolean;
  coinsAdded: number;
  newBest: boolean;
  totalCoins: number;
}

const COUNTUP_TIME = 0.9;

export class ResultScene implements Scene {
  private t = 0;
  private buttons: { rect: Rect; action: () => void; label: string; bg?: string; fg?: string }[] = [];

  constructor(
    private app: App,
    private params: ResultParams,
  ) {}

  update(dt: number): void {
    this.t += dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit } = vp;
    const p = this.params;
    drawBackground(ctx, vp);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 見出し
    ctx.fillStyle = p.cleared ? COLORS.coin : COLORS.danger;
    ctx.font = `900 ${30 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = p.cleared ? COLORS.coin : COLORS.danger;
    ctx.shadowBlur = 18 * unit;
    ctx.fillText(p.cleared ? "ステージクリア!" : "きたい たいは…", w / 2, h * 0.16);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${13 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${p.stage.id}. ${p.stage.name}`, w / 2, h * 0.16 + 32 * unit);

    // スコア(カウントアップ)
    const ratio = Math.min(this.t / COUNTUP_TIME, 1);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${12 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("SCORE", w / 2, h * 0.3);
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${42 * unit}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(formatScore(Math.floor(p.score * ratio)), w / 2, h * 0.3 + 34 * unit);

    if (ratio >= 1 && p.newBest) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 6);
      ctx.fillStyle = COLORS.coin;
      ctx.font = `800 ${15 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("★ NEW BEST! ★", w / 2, h * 0.3 + 66 * unit);
      ctx.globalAlpha = 1;
    }

    // サブ情報: タイム+獲得コイン
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${13 * unit}px -apple-system, system-ui, sans-serif`;
    const timeStr = p.cleared ? `タイム ${(p.timeMs / 1000).toFixed(1)}s` : "とうたつできず";
    ctx.fillText(timeStr, w / 2 - 60 * unit, h * 0.47);
    drawCoinIcon(ctx, w / 2 + 26 * unit, h * 0.47, 8 * unit);
    ctx.fillStyle = COLORS.coin;
    ctx.textAlign = "left";
    ctx.fillText(`+${p.coinsAdded}  (計 ${p.totalCoins})`, w / 2 + 36 * unit, h * 0.47);
    ctx.textAlign = "center";
    if (!p.cleared && p.coinsAdded > 0) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${11 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("しっぱいでも コインの半分は もちかえり!", w / 2, h * 0.47 + 22 * unit);
    }

    // ボタン
    this.buttons = [];
    const bw = 230 * unit;
    const bh = 50 * unit;
    const bx = w / 2 - bw / 2;
    let by = h * 0.58;
    const addBtn = (label: string, action: () => void, bg?: string, fg?: string) => {
      const rect = { x: bx, y: by, w: bw, h: bh };
      this.buttons.push({ rect, action, label, bg, fg });
      by += bh + 16 * unit;
    };

    if (p.cleared) {
      const next = STAGES.find((s) => s.id === p.stage.id + 1);
      if (next) {
        addBtn(`つぎへ: ${next.name}`, () => this.app.manager.switchTo(new PlayScene(this.app, next)));
      } else {
        addBtn("ぜんステージ クリア!", () => this.app.manager.switchTo(new StageSelectScene(this.app)), COLORS.coin);
      }
      addBtn("もういちど", () => this.app.manager.switchTo(new PlayScene(this.app, p.stage)), "#25314f", COLORS.text);
    } else {
      addBtn("リトライ", () => this.app.manager.switchTo(new PlayScene(this.app, p.stage)));
      addBtn("マップへ", () => this.app.manager.switchTo(new StageSelectScene(this.app)), "#25314f", COLORS.text);
    }
    addBtn("🔧 アップグレード", () => this.app.manager.switchTo(new ShopScene(this.app)), "#25314f", COLORS.text);

    for (const b of this.buttons) drawButton(ctx, unit, b.rect, b.label, { bg: b.bg, fg: b.fg });
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    if (this.t < 0.4) return; // 終了直後の誤タップ防止
    for (const b of this.buttons) {
      if (inRect(b.rect, x, y)) {
        sfxStart();
        b.action();
        return;
      }
    }
  }
}
