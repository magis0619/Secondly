import "./style.css";
import type { App } from "./app.ts";
import { unlockAudio } from "./audio/audio.ts";
import { createInput } from "./core/input.ts";
import { startLoop } from "./core/loop.ts";
import { SceneManager } from "./core/scene.ts";
import { createViewport } from "./core/viewport.ts";
import { COLORS } from "./game/config.ts";
import { TitleScene } from "./scenes/title.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const vp = createViewport(canvas);
const input = createInput(canvas);

const app = { vp, input } as App;
const manager = new SceneManager(new TitleScene(app), COLORS.bg);
app.manager = manager;

input.setHandler({
  onDown: (x, y) => {
    unlockAudio(); // iOSはユーザー操作内でのresumeが必須
    manager.onDown(x, y);
  },
  onUp: (x, y) => manager.onUp(x, y),
});

startLoop(
  (dt) => manager.update(dt),
  () => {
    ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
    manager.draw(ctx, vp.w, vp.h);
  },
);
