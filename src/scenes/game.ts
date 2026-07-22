import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { clamp, damp, lerp } from "../core/math.ts";
import {
  sfxCount, sfxFall, sfxGo, sfxHop, sfxTick, sfxTimeup,
} from "../audio/sfx.ts";
import { Fx } from "../fx/particles.ts";
import { Juice } from "../fx/juice.ts";
import { COLORS, GAME, LAYOUT } from "../game/config.ts";
import { addScore, loadSave } from "../game/save.ts";
import type { Side } from "../game/tower.ts";
import { Tower } from "../game/tower.ts";
import { drawFx } from "../render/fx.ts";
import { ResultScene } from "./result.ts";

function hexLerp(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export class GameScene implements Scene {
  private tower = new Tower();
  private fx = new Fx();
  private juice = new Juice();
  private camH = 0;
  private best = 0;
  private taps = 0;
  private endT = 0;
  private finished = false;
  private goFlash = 0;
  private lastKeyDir = 0;
  private t = 0;

  constructor(private app: App) {}

  enter(): void {
    this.best = loadSave().best;
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__climb = {
        tower: this.tower,
        tap: (d: Side) => this.tower.tap(d),
        skip: () => {
          if (this.tower.phase === "count") this.tower.countdown = 0.01;
          else this.tower.timeLeft = Math.min(this.tower.timeLeft, 0.4);
        },
        state: () => ({
          scene: "game",
          phase: this.tower.phase,
          h: this.tower.h,
          maxH: this.tower.maxH,
          timeLeft: this.tower.timeLeft,
          nextSide: this.tower.side(this.tower.h + 1),
        }),
      };
    }
  }

  update(dt: number): void {
    this.t += dt;
    const { vp, input } = this.app;
    this.juice.update(dt, 7 * vp.unit);
    this.goFlash = Math.max(this.goFlash - dt, 0);

    // 開発用: ←→キーでもタップ
    const kd = input.keyDir;
    if (kd !== this.lastKeyDir && kd !== 0) this.tap(kd < 0 ? 0 : 1);
    this.lastKeyDir = kd;

    this.tower.update(dt);
    this.fx.update(dt);

    for (const ev of this.tower.drainEvents()) {
      switch (ev.type) {
        case "count":
          sfxCount();
          break;
        case "go":
          sfxGo();
          this.goFlash = 0.6;
          break;
        case "hop": {
          sfxHop(ev.h);
          const [x, y] = this.platPos(ev.h - 1);
          this.fx.burst(x, y, "#c9d6ff", 5, 90 * vp.unit, 3 * vp.unit);
          break;
        }
        case "fall": {
          const dist = ev.from + 1 - ev.to;
          sfxFall(dist);
          this.juice.shake(clamp(0.15 + dist * 0.06, 0.2, 0.6));
          this.juice.flashScreen(COLORS.danger, 0.18);
          break;
        }
        case "tick":
          sfxTick();
          break;
        case "timeup":
          sfxTimeup();
          this.juice.flashScreen(COLORS.gold, 0.2);
          break;
      }
    }

    // カメラ追従
    this.camH += (this.tower.visualH() - this.camH) * damp(9, dt);

    if (this.tower.phase === "done") {
      this.endT += dt;
      if (this.endT >= GAME.END_DELAY && !this.finished) {
        this.finished = true;
        const score = this.tower.maxH;
        const outcome = addScore(score);
        this.app.manager.switchTo(
          new ResultScene(this.app, {
            score,
            rank: outcome.rank,
            newBest: outcome.newBest,
            best: outcome.save.best,
          }),
        );
      }
    }
  }

  private tap(d: Side): void {
    if (this.tower.tap(d)) this.taps++;
  }

  /** h段目の足場の画面座標(中心) */
  private platPos(h: number): [number, number] {
    const { vp } = this.app;
    const u = vp.unit;
    const anchorY = vp.h * LAYOUT.ANCHOR;
    const x = h === 0 ? vp.w / 2 : vp.w / 2 + (this.tower.side(h) === 0 ? -1 : 1) * LAYOUT.COL_OFFSET * u;
    const y = anchorY + (this.camH - h) * LAYOUT.STEP_H * u;
    return [x, y];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h: H, unit: u, safeTop } = vp;
    const tw = this.tower;

    // 背景(高度で明るく)
    const skyT = clamp(this.camH / 120, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hexLerp(COLORS.bg, COLORS.bgTop, skyT));
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, H);
    // 星(高度パララックス)
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 14; i++) {
      const sy = ((i * 173 + this.camH * LAYOUT.STEP_H * u * 0.3) % (H + 40)) - 20;
      ctx.globalAlpha = 0.12 + (i % 3) * 0.08;
      ctx.fillRect(((i * 97) % w), sy, 2 * u, 2 * u);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(this.juice.offX, this.juice.offY);

    const anchorY = H * LAYOUT.ANCHOR;
    const stepH = LAYOUT.STEP_H * u;
    const visTop = tw.h + 2; // 見えるのは2つ上まで

    // 足場(下は画面内すべて、上はvisTopまで)
    const hMin = Math.max(0, Math.floor(this.camH - anchorY / stepH) - 1);
    const hMax = Math.min(visTop, Math.ceil(this.camH + (H - anchorY) / stepH) + 1);
    for (let hh = hMin; hh <= Math.max(hMax, visTop); hh++) {
      if (hh > visTop) break;
      const y = anchorY + (this.camH - hh) * stepH;
      if (y < -40 || y > H + 40) continue;
      if (hh === 0) {
        // 地面
        ctx.fillStyle = COLORS.ground;
        ctx.fillRect(0, y, w, H - y + 40);
        ctx.fillStyle = COLORS.platformTop;
        ctx.fillRect(0, y, w, 4 * u);
        continue;
      }
      const x = w / 2 + (tw.side(hh) === 0 ? -1 : 1) * LAYOUT.COL_OFFSET * u;
      const pw = LAYOUT.PLAT_W * u;
      const ph = LAYOUT.PLAT_H * u;
      ctx.fillStyle = COLORS.platform;
      ctx.beginPath();
      ctx.roundRect(x - pw / 2, y, pw, ph, 6 * u);
      ctx.fill();
      ctx.fillStyle = COLORS.platformTop;
      ctx.beginPath();
      ctx.roundRect(x - pw / 2, y, pw, 4.5 * u, 3 * u);
      ctx.fill();
      // 高度ラベル(10段ごと)
      if (hh % 10 === 0) {
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `700 ${9 * u}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = x < w / 2 ? "left" : "right";
        ctx.fillText(`${hh}m`, x < w / 2 ? x + pw / 2 + 6 * u : x - pw / 2 - 6 * u, y + 11 * u);
      }
    }

    // 霧(2つ上より先は見えない)
    const fogY = anchorY + (this.camH - (visTop + 0.6)) * stepH;
    if (fogY > -10) {
      const fg = ctx.createLinearGradient(0, fogY - 70 * u, 0, fogY + 24 * u);
      fg.addColorStop(0, "rgba(10,14,26,1)");
      fg.addColorStop(1, "rgba(10,14,26,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, w, Math.max(fogY + 24 * u, 0));
      // ハテナ
      ctx.fillStyle = COLORS.textDim;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 3);
      ctx.font = `800 ${14 * u}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("? ? ?", w / 2, Math.max(fogY - 26 * u, safeTop + 96 * u));
      ctx.globalAlpha = 1;
    }

    // プレイヤー(小さなクライマー)
    {
      const vh = tw.visualH();
      const vx = w / 2 + tw.visualSide() * LAYOUT.COL_OFFSET * u;
      const vy = anchorY + (this.camH - vh) * stepH;
      const r = LAYOUT.PLAYER_R * u;
      // ホップ中は弧を描く+スカッシュ
      let jump = 0;
      let sx = 1;
      let sy = 1;
      if (tw.anim.kind === "hop") {
        const t = Math.min(tw.anim.t / tw.anim.dur, 1);
        jump = Math.sin(t * Math.PI) * 26 * u;
        sy = 1 + 0.25 * Math.sin(t * Math.PI);
        sx = 1 - 0.15 * Math.sin(t * Math.PI);
      } else if (tw.anim.kind === "fall") {
        sy = 1.2;
        sx = 0.85;
      }
      ctx.save();
      ctx.translate(vx, vy - r - 4 * u - jump);
      ctx.scale(sx, sy);
      ctx.fillStyle = COLORS.player;
      ctx.shadowColor = COLORS.accent;
      ctx.shadowBlur = 10 * u;
      ctx.beginPath();
      ctx.roundRect(-r * 0.8, -r, r * 1.6, r * 2, r * 0.7);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 顔
      ctx.fillStyle = COLORS.accent;
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.25, r * 0.16, 0, Math.PI * 2);
      ctx.arc(r * 0.22, -r * 0.25, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      // バンダナ
      ctx.fillStyle = COLORS.accent2;
      ctx.fillRect(-r * 0.8, -r * 0.75, r * 1.6, r * 0.28);
      ctx.restore();
    }

    drawFx(ctx, vp, this.fx);
    ctx.restore();

    // ==== HUD ====
    const urgent = tw.phase === "play" && tw.timeLeft <= GAME.URGENT;
    // タイマーバー
    const bw = w * 0.56;
    const bx = w / 2 - bw / 2;
    const by = safeTop + 14 * u;
    ctx.fillStyle = "#25314f";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 10 * u, 5 * u);
    ctx.fill();
    const ratio = clamp(tw.timeLeft / GAME.TIME, 0, 1);
    ctx.fillStyle = urgent ? COLORS.danger : COLORS.accent;
    if (ratio > 0) {
      ctx.beginPath();
      ctx.roundRect(bx, by, bw * ratio, 10 * u, 5 * u);
      ctx.fill();
    }
    // 残り秒数
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = urgent ? COLORS.danger : COLORS.text;
    const pulse = urgent ? 1 + 0.12 * Math.sin(this.t * 12) : 1;
    ctx.font = `900 ${26 * u * pulse}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(String(Math.ceil(tw.timeLeft)), w / 2, by + 16 * u);
    // 高度(左上)
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${10 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("たかさ", 16 * u, by);
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${26 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${tw.maxH}m`, 16 * u, by + 12 * u);
    // ベスト(右上)
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${10 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText("ベスト", w - 16 * u, by);
    ctx.fillStyle = COLORS.gold;
    ctx.font = `800 ${18 * u}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${Math.max(this.best, tw.maxH)}m`, w - 16 * u, by + 13 * u);

    // タップガイド(最初の3タップまで)
    if (this.taps < 3 && tw.phase === "play") {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.textDim;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 4);
      ctx.font = `900 ${30 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("◀", w * 0.2, H * 0.86);
      ctx.fillText("▶", w * 0.8, H * 0.86);
      ctx.font = `700 ${12 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("つぎの足場がある側をタップ!", w / 2, H * 0.86);
      ctx.globalAlpha = 1;
    }

    // カウントダウン / GO! / TIME UP
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (tw.phase === "count") {
      ctx.fillStyle = "rgba(10,14,26,0.5)";
      ctx.fillRect(0, 0, w, H);
      const n = Math.max(1, Math.ceil(tw.countdown));
      const frac = tw.countdown - Math.floor(tw.countdown);
      ctx.fillStyle = COLORS.text;
      ctx.font = `900 ${(70 + 24 * frac) * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(tw.countdown > GAME.COUNTDOWN ? "" : String(n), w / 2, H * 0.42);
      ctx.font = `700 ${13 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText("30びょうで どこまで のぼれる?", w / 2, H * 0.55);
    } else if (this.goFlash > 0) {
      ctx.fillStyle = COLORS.accent;
      ctx.globalAlpha = Math.min(this.goFlash * 3, 1);
      ctx.font = `900 ${54 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("GO!", w / 2, H * 0.42);
      ctx.globalAlpha = 1;
    } else if (tw.phase === "done") {
      ctx.fillStyle = COLORS.gold;
      ctx.font = `900 ${44 * u}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("TIME UP!", w / 2, H * 0.42);
    }

    if (this.juice.flash > 0) {
      ctx.globalAlpha = this.juice.flash;
      ctx.fillStyle = this.juice.flashColor;
      ctx.fillRect(0, 0, w, H);
      ctx.globalAlpha = 1;
    }
  }

  onDown(x: number): void {
    this.tap(x < this.app.vp.w / 2 ? 0 : 1);
  }
}
