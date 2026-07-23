import "./style.css";
import type { App } from "./app.ts";
import { resumeAudio, unlockAudio } from "./audio/audio.ts";
import { createInput } from "./core/input.ts";
import { startLoop } from "./core/loop.ts";
import { SceneManager } from "./core/scene.ts";
import { createViewport } from "./core/viewport.ts";
import { currentBgm, setBgmMuted } from "./audio/bgm.ts";
import { setSfxMuted } from "./audio/sfx.ts";
import { logEvent } from "./game/analytics.ts";
import { COLORS, LEGAL, ONLINE } from "./game/config.ts";
import { initLang } from "./game/i18n.ts";
import { loadSave } from "./game/save.ts";
import { HomeScene } from "./scenes/home.ts";

initLang();
logEvent("app_open");

// サウンド設定をセーブから反映(オフのまま次回起動しても無音を維持する)
{
  const startupSave = loadSave();
  setBgmMuted(startupSave.bgmOff);
  setSfxMuted(startupSave.sfxOff);
}

// 本番の不具合検知用(捕捉できなかった例外/Promise拒否をアナリティクスへ)
window.addEventListener("error", (e) => {
  logEvent("js_error", { msg: String(e.message ?? e).slice(0, 200) });
});
window.addEventListener("unhandledrejection", (e) => {
  logEvent("js_error", { msg: String(e.reason ?? "unhandledrejection").slice(0, 200) });
});

// バックグラウンドから復帰した時にAudioContextを再開(iOSはsuspendされたままのことがある)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) resumeAudio();
});

// devビルド限定: 検証用にONLINE設定を注入できるようにする
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__cfg = { ONLINE, LEGAL };
  (window as unknown as Record<string, unknown>).__bgm = { current: currentBgm };
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
