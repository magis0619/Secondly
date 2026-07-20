import type { App } from "../app.ts";
import { degToRad } from "../core/math.ts";
import type { Scene } from "../core/scene.ts";
import { resumeAudio, suspendAudio } from "../audio/audio.ts";
import {
  sfxAbsorb,
  sfxClear,
  sfxCrit,
  sfxDamage,
  sfxFail,
  sfxHit,
  sfxKill,
  sfxMulti,
  sfxShot,
  sfxTelegraph,
  sfxTick,
  sfxTierUp,
  sfxWind,
  sfxSwing,
} from "../audio/sfx.ts";
import { Fx } from "../fx/particles.ts";
import { Juice } from "../fx/juice.ts";
import { COLORS, ENEMY_DEFS, HAND } from "../game/config.ts";
import { persistResult } from "../game/save.ts";
import { World, type WorldEvent } from "../game/world.ts";
import { renderPlay } from "../render/renderer.ts";
import { ResultScene } from "./result.ts";

const END_DELAY = 1.4; // 終了演出を見せてからリザルトへ

export class PlayScene implements Scene {
  private world: World;
  private fx = new Fx();
  private juice = new Juice();
  private paused = false;
  private endT = 0;
  private finished = false;
  private windT = 0;
  private killIdx = 0;
  private onVisibility = () => {
    if (document.hidden && this.world.status === "playing") {
      this.paused = true;
      suspendAudio();
    }
  };

  constructor(private app: App) {
    this.world = new World(Math.floor(Math.random() * 2 ** 31));
  }

  enter(): void {
    document.addEventListener("visibilitychange", this.onVisibility);
    if (import.meta.env.DEV) {
      // Playwright/開発コンソールからの検証用フック
      (window as unknown as Record<string, unknown>).__secondly = {
        world: this.world,
        skipTo: (t: number) => {
          this.world.elapsed = t;
        },
        spawn: (kind: "tick" | "rush" | "chime", angleDeg: number) => {
          this.world.telegraphs.push({
            kind,
            angle: degToRad(angleDeg),
            t: 0.01,
            total: ENEMY_DEFS[kind].telegraph,
          });
        },
      };
    }
  }

  exit(): void {
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  update(dt: number): void {
    if (this.paused) return;

    this.juice.update(dt, 9 * this.app.vp.unit);
    const sdt = dt * this.juice.timeScale;

    this.world.update(sdt, this.app.input.pressed);
    this.fx.update(sdt);

    // ゼンマイ巻きのラチェット音(チャージ中、断続的に)
    if (this.world.hand.state === "charging") {
      this.windT -= sdt;
      if (this.windT <= 0) {
        this.windT = 0.09;
        sfxWind(this.world.hand.chargeRatio);
      }
    } else {
      this.windT = 0;
    }

    for (const ev of this.world.drainEvents()) this.handleEvent(ev);

    if (this.world.status !== "playing") {
      this.endT += dt;
      if (this.endT >= END_DELAY && !this.finished) {
        this.finished = true;
        const cleared = this.world.status === "clear";
        const outcome = persistResult(this.world.score, this.world.maxCombo, cleared);
        this.app.manager.switchTo(
          new ResultScene(this.app, {
            score: this.world.score,
            maxCombo: this.world.maxCombo,
            cleared,
            newBest: outcome.newBest,
            best: outcome.save.bestScore,
          }),
        );
      }
    }
  }

  /** 極座標(R比)→画面座標 */
  private px(angle: number, dist: number): [number, number] {
    const { cx, cy, R } = this.app.vp;
    return [cx + Math.cos(angle) * dist * R, cy + Math.sin(angle) * dist * R];
  }

  private handleEvent(ev: WorldEvent): void {
    const { vp } = this.app;
    const { unit, R, cx, cy } = vp;
    switch (ev.type) {
      case "telegraph":
        sfxTelegraph(ev.kind);
        break;
      case "spawn": {
        const [x, y] = this.px(ev.angle, 1.15);
        this.fx.ring(x, y, COLORS.enemy[ev.kind], 18 * unit, 2 * unit, 0.3);
        break;
      }
      case "swing": {
        const tier = HAND.TIERS[ev.tier];
        sfxSwing(ev.tier);
        this.fx.swingArc(
          this.world.hand.attackAngle,
          degToRad(tier.arcDeg),
          tier.len * R,
          COLORS.tier[ev.tier],
        );
        if (ev.tier === 2) {
          this.fx.ring(cx, cy, COLORS.tier[2], R * 1.18, 4 * unit, 0.4);
          this.juice.shake(0.3);
        }
        this.killIdx = 0;
        break;
      }
      case "tierUp":
        sfxTierUp(ev.tier);
        this.fx.ring(cx, cy, COLORS.tier[ev.tier], 34 * unit, 2.5 * unit, 0.3);
        break;
      case "hit": {
        const [x, y] = this.px(ev.angle, ev.dist);
        sfxHit();
        this.fx.burst(x, y, "#ffffff", 4, 120 * unit, 3 * unit);
        this.juice.hitstop(0.02);
        break;
      }
      case "kill": {
        const [x, y] = this.px(ev.angle, ev.dist);
        const color = COLORS.enemy[ev.kind];
        sfxKill(this.world.combo + this.killIdx);
        this.killIdx++;
        this.fx.burst(x, y, color, ev.crit ? 16 : 10, 170 * unit, 4 * unit);
        this.fx.ring(x, y, ev.crit ? "#ffffff" : color, (ev.crit ? 34 : 24) * unit, 3 * unit);
        this.juice.hitstop(ev.crit ? 0.09 : 0.04);
        this.juice.shake(ev.crit ? 0.25 : 0.12);
        if (ev.crit) {
          sfxCrit();
          this.fx.float(x, y - 18 * unit, "JUST!", COLORS.core, 15 * unit, 0.7);
        }
        break;
      }
      case "swingResult": {
        const [x, y] = this.px(ev.angle, 0.6);
        this.fx.float(
          x,
          y,
          `+${ev.score.toLocaleString("en-US")}`,
          ev.anyCrit ? COLORS.core : COLORS.text,
          (ev.kills >= 2 ? 19 : 15) * unit,
          0.9,
        );
        if (ev.kills >= 2) {
          sfxMulti(ev.kills);
          this.fx.float(x, y + 22 * unit, `${ev.kills}体まとめて ×${ev.kills}`, COLORS.tier[2], 13 * unit, 0.9);
        }
        break;
      }
      case "chimeShot": {
        const [x, y] = this.px(ev.angle, ev.dist);
        sfxShot();
        this.fx.ring(x, y, COLORS.bullet, 12 * unit, 2 * unit, 0.25);
        break;
      }
      case "bulletAbsorb": {
        const [x, y] = this.px(ev.angle, 0.11);
        sfxAbsorb();
        this.fx.ring(x, y, COLORS.core, 10 * unit, 2 * unit, 0.3);
        break;
      }
      case "coreHit": {
        sfxDamage();
        this.juice.hitstop(0.12);
        this.juice.shake(0.6);
        this.juice.flashScreen(COLORS.danger, 0.3);
        this.fx.ring(cx, cy, COLORS.danger, R * 0.6, 5 * unit, 0.5);
        this.fx.float(cx, cy - 40 * unit, "-1", COLORS.danger, 20 * unit, 0.8);
        break;
      }
      case "second":
        sfxTick(this.world.timeLeft <= 10, this.world.timeLeft);
        break;
      case "clear":
        sfxClear();
        this.juice.flashScreen(COLORS.tickLit, 0.25);
        this.fx.float(cx, cy - R * 0.5, "TIME UP — CLEAR!", COLORS.tickLit, 22 * unit, 1.4);
        break;
      case "failed":
        sfxFail();
        this.juice.shake(0.8);
        this.fx.float(cx, cy - R * 0.5, "CORE DOWN…", COLORS.danger, 22 * unit, 1.4);
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    renderPlay(ctx, this.app.vp, this.world, this.fx, this.juice);

    if (this.paused) {
      const { w, h, unit } = this.app.vp;
      ctx.save();
      ctx.fillStyle = "rgba(10,14,26,0.72)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${20 * unit}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("PAUSED — TAP TO RESUME", w / 2, h / 2);
      ctx.restore();
    }
  }

  onDown(): void {
    if (this.paused) {
      this.paused = false;
      resumeAudio();
    }
  }
}
