import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import type { SaveData } from "../game/save.ts";
import { loadSave } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { HomeScene } from "./home.ts";

export class RankingScene implements Scene {
  private t = 0;
  private save: SaveData = loadSave();
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    private app: App,
    /** 直前のプレイの順位(ハイライト用)。なければ-1 */
    private highlightRank = -1,
  ) {}

  enter(): void {
    this.save = loadSave();
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
    ctx.fillText("🏆 ランキング", w / 2, safeTop + 36 * u);

    const list = this.save.ranking;
    if (list.length === 0) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${14 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("まだ きろくが ないよ", w / 2, h * 0.4);
      ctx.fillText("あそんで きろくを つくろう!", w / 2, h * 0.4 + 26 * u);
    }

    const rowH = 46 * u;
    const startY = safeTop + 76 * u;
    list.forEach((e, i) => {
      const y = startY + i * rowH;
      const rank = i + 1;
      const hl = rank === this.highlightRank;
      if (hl) {
        ctx.fillStyle = COLORS.accent2;
        ctx.globalAlpha = 0.16 + 0.08 * Math.sin(this.t * 5);
        ctx.beginPath();
        ctx.roundRect(w / 2 - 160 * u, y - rowH / 2 + 3 * u, 320 * u, rowH - 6 * u, 10 * u);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // 順位
      ctx.textAlign = "center";
      ctx.font = `900 ${(rank <= 3 ? 20 : 15) * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = rank === 1 ? COLORS.gold : rank === 2 ? "#cdd8ee" : rank === 3 ? "#d9a066" : COLORS.textDim;
      ctx.fillText(rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : String(rank), w / 2 - 130 * u, y);
      // スコア
      ctx.textAlign = "right";
      ctx.fillStyle = hl ? COLORS.accent2 : COLORS.text;
      ctx.font = `800 ${18 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`${e.score}m`, w / 2 + 40 * u, y);
      // 日付
      const d = new Date(e.date);
      ctx.textAlign = "right";
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${11 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, w / 2 + 130 * u, y);
    });

    this.backRect = { x: w / 2 - 100 * u, y: h - safeBottom - 76 * u, w: 200 * u, h: 50 * u };
    drawButton(ctx, u, this.backRect, "もどる", { bg: "#25314f", fg: COLORS.text });
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    if (inRect(this.backRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new HomeScene(this.app));
    }
  }
}
