import "./style.css";
import type { App } from "./app.ts";
import { unlockAudio } from "./audio/audio.ts";
import { createInput } from "./core/input.ts";
import { startLoop } from "./core/loop.ts";
import { SceneManager } from "./core/scene.ts";
import { createViewport } from "./core/viewport.ts";
import { COLORS, LEGAL, ONLINE } from "./game/config.ts";
import { HomeScene } from "./scenes/home.ts";

// devビルド限定: 検証用にONLINE設定を注入できるようにする
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__cfg = { ONLINE, LEGAL };
}

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const vp = createViewport(canvas);
const input = createInput(canvas);

const app = { vp, input } as App;
const manager = new SceneManager(new HomeScene(app), COLORS.bg);
app.manager = manager;

input.setHandler({
  onDown: (x, y) => {
    unlockAudio(); // iOSはユーザー操作内でのresumeが必須
    manager.onDown(x - vp.offsetX, y); // レターボックス分を差し引いてフレーム座標へ
  },
  onUp: (x, y) => manager.onUp(x - vp.offsetX, y),
});

startLoop(
  (dt) => manager.update(dt),
  () => {
    ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
    // レターボックスの帯(横長画面のみ)
    if (vp.offsetX > 0) {
      ctx.fillStyle = "#05070f";
      ctx.fillRect(0, 0, vp.realW, vp.h);
    }
    ctx.translate(vp.offsetX, 0);
    manager.draw(ctx, vp.w, vp.h);
    if (vp.offsetX > 0) {
      ctx.strokeStyle = "rgba(127,141,180,0.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, -1, vp.w - 1, vp.h + 2);
    }
  },
);
