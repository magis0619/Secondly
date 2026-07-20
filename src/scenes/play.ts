import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { resumeAudio, suspendAudio } from "../audio/audio.ts";
import {
  sfxClang,
  sfxClear,
  sfxCombo,
  sfxDamage,
  sfxDash,
  sfxDig,
  sfxFail,
  sfxGas,
  sfxPickup,
  sfxSmash,
  sfxTierUp,
  sfxWind,
} from "../audio/sfx.ts";
import { Fx } from "../fx/particles.ts";
import { Juice } from "../fx/juice.ts";
import { COLORS, GRID, MACHINE, modsFromUpgrades } from "../game/config.ts";
import { loadSave, persistStageResult } from "../game/save.ts";
import type { StageDef } from "../game/stages.ts";
import { STAGES } from "../game/stages.ts";
import { World, type WorldEvent } from "../game/world.ts";
import { formatScore } from "../render/hud.ts";
import { getLayout, colX, depthY } from "../render/layout.ts";
import { renderPlay } from "../render/renderer.ts";
import { ResultScene } from "./result.ts";

const END_DELAY = 1.3; // 終了演出を見せてからリザルトへ

export class PlayScene implements Scene {
  private world: World;
  private fx = new Fx();
  private juice = new Juice();
  private paused = false;
  private endT = 0;
  private finished = false;
  private windT = 0;
  private smashIdx = 0;
  private onVisibility = () => {
    if (document.hidden && this.world.status === "playing") {
      this.paused = true;
      suspendAudio();
    }
  };

  constructor(
    private app: App,
    private stage: StageDef,
  ) {
    this.world = new World(stage, modsFromUpgrades(loadSave().upgrades));
  }

  enter(): void {
    document.addEventListener("visibilitychange", this.onVisibility);
    if (import.meta.env.DEV) {
      // Playwright/開発コンソールからの検証用フック
      (window as unknown as Record<string, unknown>).__drill = {
        world: this.world,
        state: () => ({
          scene: "play",
          stage: this.stage.id,
          depth: this.world.machine.depth,
          col: this.world.machine.col,
          hp: this.world.machine.hp,
          machineState: this.world.machine.state,
          score: this.world.score,
          coins: this.world.coins,
          status: this.world.status,
        }),
        warp: (depth: number) => {
          this.world.machine.depth = depth;
          this.world.camera.depth = depth;
        },
        moveTo: (col: number) => {
          this.world.machine.col = col + 0.5 > GRID.COLS ? GRID.COLS - 0.5 : col;
          this.world.machine.targetCol = this.world.machine.col;
        },
      };
    }
  }

  exit(): void {
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  update(dt: number): void {
    if (this.paused) return;

    const { vp, input } = this.app;
    this.juice.update(dt, 8 * vp.unit);
    const sdt = dt * this.juice.timeScale;

    const tilePx = GRID.TILE_UNITS * vp.unit;
    const ctrl = {
      pressed: input.pressed,
      dragCols: (input.consumeDragDX() / tilePx) * MACHINE.DRAG_SENS,
      keyDir: input.keyDir,
    };

    this.world.update(sdt, ctrl);
    this.fx.update(sdt);

    // バネ圧縮のラチェット音
    if (this.world.machine.state === "charging") {
      this.windT -= sdt;
      if (this.windT <= 0) {
        this.windT = 0.09;
        sfxWind(this.world.machine.chargeRatio);
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
        const outcome = persistStageResult(
          this.stage.id,
          this.world.score,
          Math.round(this.world.elapsed * 1000),
          this.world.coins,
          cleared,
          STAGES.length,
        );
        this.app.manager.switchTo(
          new ResultScene(this.app, {
            stage: this.stage,
            score: this.world.score,
            timeMs: Math.round(this.world.elapsed * 1000),
            cleared,
            coinsAdded: outcome.coinsAdded,
            newBest: outcome.newBest,
            totalCoins: outcome.save.coins,
          }),
        );
      }
    }
  }

  /** タイル座標→画面座標(このフレームのカメラ基準) */
  private px(col: number, row: number): [number, number] {
    const l = getLayout(this.app.vp);
    return [colX(l, col + 0.5), depthY(l, this.world.camera.depth, row + 0.5)];
  }

  private handleEvent(ev: WorldEvent): void {
    const { vp } = this.app;
    const u = vp.unit;
    switch (ev.type) {
      case "dig": {
        const [x, y] = this.px(ev.col, ev.row);
        sfxDig();
        this.fx.burst(x, y, "#8a6a48", 4, 90 * u, 3 * u);
        break;
      }
      case "smash": {
        const [x, y] = this.px(ev.col, ev.row);
        const color = ev.kind === "steel" ? COLORS.tile.steel : COLORS.tile.rock;
        sfxSmash(this.smashIdx++, ev.kind === "steel");
        this.fx.burst(x, y, color, 10, 170 * u, 4 * u);
        this.fx.ring(x, y, "#ffffff", 20 * u, 2.5 * u, 0.25);
        this.juice.hitstop(0.015);
        this.juice.shake(0.08);
        break;
      }
      case "clang": {
        const [x, y] = this.px(ev.col, ev.row);
        sfxClang();
        this.fx.burst(x, y - 14 * u, "#ffe9a8", 6, 140 * u, 3 * u);
        this.fx.float(x, y - 26 * u, "かたい!", COLORS.textDim, 13 * u, 0.7);
        this.juice.shake(0.22);
        break;
      }
      case "dashStart":
        sfxDash(ev.tier);
        this.smashIdx = 0;
        if (ev.tier === 2) this.juice.shake(0.18);
        break;
      case "dashEnd": {
        if (ev.smashed >= 2) {
          const m = this.world.machine;
          const [x, y] = this.px(m.col - 0.5, Math.max(m.depth - 1.6, 0));
          this.fx.float(x, y, `+${formatScore(ev.score)}`, COLORS.text, 16 * u, 0.9);
          if (ev.smashed >= 3) {
            sfxCombo(ev.smashed);
            this.fx.float(x, y + 22 * u, `${ev.smashed}枚 ぶちぬき!`, COLORS.tier[2], 14 * u, 0.9);
            this.juice.shake(Math.min(0.1 * ev.smashed, 0.5));
          }
        }
        break;
      }
      case "pickup": {
        const [x, y] = this.px(ev.col, ev.row);
        const color = ev.kind === "gem" ? COLORS.tile.gem : COLORS.coin;
        sfxPickup(ev.kind, ev.duringDash);
        this.fx.burst(x, y, color, ev.kind === "gem" ? 12 : 7, 150 * u, 3.5 * u);
        this.fx.float(x, y - 16 * u, `+${ev.score}`, color, 13 * u, 0.8);
        break;
      }
      case "gasBurst": {
        const [x, y] = this.px(ev.col, ev.row);
        sfxGas(ev.harmless);
        this.fx.burst(x, y, COLORS.tile.gas, 10, 160 * u, 3.5 * u);
        this.fx.ring(x, y, COLORS.tile.gas, 26 * u, 2.5 * u, 0.3);
        break;
      }
      case "tierUp": {
        const m = this.world.machine;
        const [x, y] = this.px(m.col - 0.5, m.depth);
        sfxTierUp(ev.tier);
        this.fx.ring(x, y, COLORS.tier[ev.tier], 30 * u, 2.5 * u, 0.3);
        break;
      }
      case "damage": {
        const [x, y] = this.px(ev.col, ev.row);
        sfxDamage();
        this.juice.hitstop(0.12);
        this.juice.shake(0.6);
        this.juice.flashScreen(COLORS.danger, 0.3);
        this.fx.float(x, y - 20 * u, "-1", COLORS.danger, 18 * u, 0.8);
        break;
      }
      case "clear": {
        const [x, y] = this.px(3, Math.max(this.world.machine.depth - 2, 0));
        sfxClear();
        this.juice.flashScreen(COLORS.coin, 0.25);
        this.juice.shake(0.4);
        this.fx.float(x, y, "コアに とうたつ!", COLORS.coin, 20 * u, 1.3);
        break;
      }
      case "failed": {
        const [x, y] = this.px(3, Math.max(this.world.machine.depth - 2, 0));
        sfxFail();
        this.juice.shake(0.8);
        this.fx.float(x, y, "きたい たいは……", COLORS.danger, 20 * u, 1.3);
        break;
      }
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
