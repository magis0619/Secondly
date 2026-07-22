import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { sfxGo, sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import { AD_STUB, STUB_AD_SEC, showNativeAd } from "../game/monetize.ts";
import type { Rect } from "../render/ui.ts";
import { drawButton, inRect } from "../render/ui.ts";
import { GameScene } from "./game.ts";
import { HomeScene } from "./home.ts";
import { StoreScene } from "./store.ts";

/**
 * ほんばんの前の広告ゲート。
 * 確認画面(広告が流れることを明示)→ 擬似広告(AD_STUB時)→ ほんばん開始。
 */
export class AdGateScene implements Scene {
  private t = 0;
  private mode: "confirm" | "ad" = "confirm";
  private adLeft = STUB_AD_SEC;
  private started = false;
  private watchRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private storeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private app: App) {}

  update(dt: number): void {
    this.t += dt;
    if (this.mode === "ad") {
      this.adLeft -= dt;
      if (this.adLeft <= 0 && !this.started) {
        this.started = true;
        sfxGo();
        this.app.manager.switchTo(new GameScene(this.app, "ranked"));
      }
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
      ctx.font = `900 ${30 * u}px -apple-system, system-ui, sans-serif`;
      ctx.shadowColor = COLORS.accent2;
      ctx.shadowBlur = 16 * u;
      ctx.fillText("🌏 ほんばん", w / 2, h * 0.2);
      ctx.shadowBlur = 0;

      ctx.fillStyle = COLORS.text;
      ctx.font = `700 ${15 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("せかいランキングに ちょうせん!", w / 2, h * 0.29);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `700 ${13 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("プレイの まえに こうこくが ながれます", w / 2, h * 0.35);

      const bw = 250 * u;
      this.watchRect = { x: w / 2 - bw / 2, y: h * 0.46, w: bw, h: 56 * u };
      this.storeRect = { x: w / 2 - bw / 2, y: h * 0.46 + 72 * u, w: bw, h: 48 * u };
      this.backRect = { x: w / 2 - bw / 2, y: h * 0.46 + 134 * u, w: bw, h: 48 * u };
      drawButton(ctx, u, this.watchRect, "▶ こうこくを 見て スタート", { bg: COLORS.accent2, fontPx: 16 * u });
      drawButton(ctx, u, this.storeRect, "🛒 こうこくを なくす(ストア)", { bg: "#25314f", fg: COLORS.text, fontPx: 13 * u });
      drawButton(ctx, u, this.backRect, "もどる", { bg: "#25314f", fg: COLORS.text, fontPx: 14 * u });
    } else {
      // 擬似広告(iOSではここがAdMobに置き換わる)
      ctx.fillStyle = "#10131f";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2a3350";
      ctx.beginPath();
      ctx.roundRect(w / 2 - 130 * u, h * 0.3 - 90 * u, 260 * u, 180 * u, 14 * u);
      ctx.fill();
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `900 ${58 * u}px -apple-system, system-ui, sans-serif`;
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(this.t * 2.4);
      ctx.fillText("AD", w / 2, h * 0.3);
      ctx.globalAlpha = 1;

      const left = Math.max(this.adLeft, 0);
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 ${17 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(`あと ${Math.ceil(left)} びょう`, w / 2, h * 0.48);
      // 残り時間バー
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
      ctx.font = `700 ${11 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("開発ビルドのため 擬似広告を表示しています", w / 2, h * 0.62);
      ctx.fillText("(iOS版では ここに実際の広告が入ります)", w / 2, h * 0.62 + 18 * u);
    }
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    if (this.mode !== "confirm") return;
    if (inRect(this.watchRect, x, y)) {
      sfxStart();
      if (AD_STUB) {
        this.mode = "ad";
        this.adLeft = STUB_AD_SEC;
      } else {
        void showNativeAd().then((ok) => {
          if (ok && !this.started) {
            this.started = true;
            this.app.manager.switchTo(new GameScene(this.app, "ranked"));
          }
        });
      }
    } else if (inRect(this.storeRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new StoreScene(this.app));
    } else if (inRect(this.backRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new HomeScene(this.app));
    }
  }
}
