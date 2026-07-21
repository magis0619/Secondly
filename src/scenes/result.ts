import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import type { StageDef } from "../game/stages.ts";
import { STAGES } from "../game/stages.ts";
import { drawGemIcon, formatScore } from "../render/hud.ts";
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
  stars: [boolean, boolean, boolean];
  gems: number;
  newBest: boolean;
  totalGems: number;
}

const COUNTUP_TIME = 0.9;
const STAR_LABELS = ["クリア", "ノーダメージ", "ジェム80%"];

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
    const { w, h, unit: u } = vp;
    const p = this.params;
    drawBackground(ctx, vp);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = p.cleared ? "#7dff8a" : COLORS.danger;
    ctx.font = `900 ${28 * u}px -apple-system, system-ui, sans-serif`;
    ctx.shadowColor = p.cleared ? "#7dff8a" : COLORS.danger;
    ctx.shadowBlur = 18 * u;
    ctx.fillText(p.cleared ? "とうちょう!" : "しずんだ…", w / 2, h * 0.13);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${p.stage.id}. ${p.stage.name}`, w / 2, h * 0.13 + 30 * u);

    // 星(順番にポップ)
    for (let i = 0; i < 3; i++) {
      const on = p.stars[i] && this.t > 0.3 + i * 0.25;
      const x = w / 2 + (i - 1) * 74 * u;
      ctx.font = `900 ${(on ? 30 : 24) * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = on ? COLORS.gem : "#2a3352";
      ctx.fillText(on ? "★" : "☆", x, h * 0.24);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${9 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(STAR_LABELS[i], x, h * 0.24 + 26 * u);
    }

    // スコア
    const ratio = Math.min(this.t / COUNTUP_TIME, 1);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${11 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("SCORE", w / 2, h * 0.34);
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${38 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(formatScore(Math.floor(p.score * ratio)), w / 2, h * 0.34 + 30 * u);
    if (ratio >= 1 && p.newBest) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 6);
      ctx.fillStyle = COLORS.gem;
      ctx.font = `800 ${14 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("★ NEW BEST! ★", w / 2, h * 0.34 + 58 * u);
      ctx.globalAlpha = 1;
    }

    // タイム+ジェム
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
    const timeStr = p.cleared ? `タイム ${(p.timeMs / 1000).toFixed(1)}s` : "とうたつできず";
    ctx.fillText(timeStr, w / 2 - 62 * u, h * 0.48);
    drawGemIcon(ctx, w / 2 + 20 * u, h * 0.48, 7 * u);
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.gem;
    ctx.fillText(
      `+${p.cleared ? p.gems : Math.floor(p.gems * 0.5)} (計 ${p.totalGems})`,
      w / 2 + 30 * u,
      h * 0.48,
    );
    ctx.textAlign = "center";
    if (!p.cleared && p.gems > 0) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${10 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("しっぱいでも ジェムの半分は もちかえり!", w / 2, h * 0.48 + 20 * u);
    }

    // ボタン
    this.buttons = [];
    const bw = 230 * u;
    const bh = 48 * u;
    const bx = w / 2 - bw / 2;
    let by = h * 0.57;
    const addBtn = (label: string, action: () => void, bg?: string, fg?: string) => {
      const rect = { x: bx, y: by, w: bw, h: bh };
      this.buttons.push({ rect, action, label, bg, fg });
      by += bh + 14 * u;
    };

    if (p.cleared) {
      const next = STAGES.find((s) => s.id === p.stage.id + 1);
      if (next) {
        addBtn(`つぎへ: ${next.name}`, () => this.app.manager.switchTo(new PlayScene(this.app, next)));
      } else {
        addBtn("ぜんステージ クリア!", () => this.app.manager.switchTo(new StageSelectScene(this.app)), COLORS.gem);
      }
      addBtn("もういちど", () => this.app.manager.switchTo(new PlayScene(this.app, p.stage)), "#25314f", COLORS.text);
    } else {
      addBtn("リトライ", () => this.app.manager.switchTo(new PlayScene(this.app, p.stage)));
      addBtn("マップへ", () => this.app.manager.switchTo(new StageSelectScene(this.app)), "#25314f", COLORS.text);
    }
    addBtn("🔧 アップグレード", () => this.app.manager.switchTo(new ShopScene(this.app)), "#25314f", COLORS.text);

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
