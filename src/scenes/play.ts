import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { resumeAudio, suspendAudio } from "../audio/audio.ts";
import {
  sfxAmmoPickup, sfxBlocked, sfxClear, sfxComboBank, sfxCp, sfxDamage, sfxEmpty,
  sfxEnemyHit, sfxEnemyShoot, sfxFail, sfxGem, sfxGlass, sfxKill, sfxLand, sfxOverdrive,
  sfxReload, sfxShoot, sfxStomp, sfxTelegraph, sfxTileBreak, sfxTileHit,
} from "../audio/sfx.ts";
import { Fx } from "../fx/particles.ts";
import { Juice } from "../fx/juice.ts";
import { COLORS, modsFrom } from "../game/config.ts";
import { loadSave, persistStageResult } from "../game/save.ts";
import type { StageDef } from "../game/stages.ts";
import { STAGES } from "../game/stages.ts";
import { World, type WorldEvent } from "../game/world.ts";
import { colX, depthY, getLayout } from "../render/layout.ts";
import { renderPlay } from "../render/renderer.ts";
import { ResultScene } from "./result.ts";

const END_DELAY = 1.3;

export class PlayScene implements Scene {
  private world: World;
  private fx = new Fx();
  private juice = new Juice();
  private paused = false;
  private endT = 0;
  private finished = false;
  private shotSfxT = 0;
  private isShotgun: boolean;
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
    const save = loadSave();
    this.isShotgun = save.selectedWeapon === "shotgun";
    this.world = new World(stage, modsFrom(save.upgrades, save.selectedWeapon));
  }

  enter(): void {
    document.addEventListener("visibilitychange", this.onVisibility);
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__recoil = {
        world: this.world,
        state: () => ({
          scene: "play",
          stage: this.stage.id,
          x: this.world.player.x,
          y: this.world.player.y,
          vy: this.world.player.vy,
          hp: this.world.player.hp,
          ammo: this.world.player.ammo,
          gems: this.world.gems,
          combo: this.world.combo,
          score: this.world.score,
          status: this.world.status,
          grounded: this.world.player.grounded,
        }),
        warp: (y: number) => {
          this.world.player.y = y;
          this.world.player.vy = 0;
          this.world.camera.y = y;
        },
        setAmmo: (n: number) => {
          this.world.player.ammo = n;
        },
        setHp: (n: number) => {
          this.world.player.hp = n;
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
    this.shotSfxT = Math.max(this.shotSfxT - dt, 0);

    const l = getLayout(vp);
    this.world.visibleRows = vp.h / l.tile;
    const ctrl = {
      firing: input.pressed,
      aimX: (input.pointerX - l.originX) / l.tile,
      aimY: this.world.camera.y + (input.pointerY - l.anchorY) / l.tile,
    };

    this.world.update(sdt, ctrl);
    this.fx.update(sdt);

    for (const ev of this.world.drainEvents()) this.handleEvent(ev);

    if (this.world.status !== "playing") {
      this.endT += dt;
      if (this.endT >= END_DELAY && !this.finished) {
        this.finished = true;
        const cleared = this.world.status === "clear";
        const stars: [boolean, boolean, boolean] = cleared
          ? [true, this.world.damageTaken === 0, this.world.gemsTotal > 0 && this.world.gems >= Math.floor(this.world.gemsTotal * 0.8)]
          : [false, false, false];
        const outcome = persistStageResult(
          this.stage.id,
          this.world.score,
          Math.round(this.world.elapsed * 1000),
          this.world.gems,
          stars,
          STAGES.length,
        );
        this.app.manager.switchTo(
          new ResultScene(this.app, {
            stage: this.stage,
            score: this.world.score,
            timeMs: Math.round(this.world.elapsed * 1000),
            cleared,
            stars,
            gems: this.world.gems,
            newBest: outcome.newBest,
            totalGems: outcome.save.gems,
          }),
        );
      }
    }
  }

  /** タイル座標→画面座標 */
  private px(tx: number, ty: number): [number, number] {
    const l = getLayout(this.app.vp);
    return [colX(l, tx), depthY(l, this.world.camera.y, ty)];
  }

  private handleEvent(ev: WorldEvent): void {
    const { vp } = this.app;
    const u = vp.unit;
    switch (ev.type) {
      case "shoot":
        if (this.shotSfxT <= 0) {
          this.shotSfxT = this.isShotgun ? 0 : 0.045; // MGは音を間引く
          sfxShoot(this.isShotgun);
        }
        if (this.isShotgun) this.juice.shake(0.12);
        break;
      case "empty":
        sfxEmpty();
        break;
      case "tileHit": {
        const [x, y] = this.px(ev.x, ev.y);
        sfxTileHit();
        this.fx.burst(x, y, "#c9cfe0", 3, 80 * u, 2.5 * u);
        break;
      }
      case "tileBreak": {
        const [x, y] = this.px(ev.x, ev.y);
        const color =
          ev.kind === "ore" ? COLORS.tile.ore : ev.kind === "hard" ? COLORS.tile.hard : ev.kind === "glass" ? COLORS.tile.glass : COLORS.tile.rock;
        sfxTileBreak(ev.kind === "hard");
        this.fx.burst(x, y, color, 9, 150 * u, 3.5 * u);
        this.juice.hitstop(0.012);
        break;
      }
      case "enemyHit": {
        const [x, y] = this.px(ev.x, ev.y);
        sfxEnemyHit();
        this.fx.burst(x, y, "#ffffff", 4, 110 * u, 3 * u);
        break;
      }
      case "kill": {
        const [x, y] = this.px(ev.x, ev.y);
        sfxKill(this.world.combo);
        this.fx.burst(x, y, COLORS.enemy[ev.kind], 12, 170 * u, 4 * u);
        this.fx.ring(x, y, "#ffffff", 22 * u, 2.5 * u, 0.25);
        this.juice.hitstop(0.04);
        this.juice.shake(0.15);
        break;
      }
      case "stomp": {
        const [x, y] = this.px(ev.x, ev.y);
        sfxStomp();
        this.fx.ring(x, y, COLORS.aim, 30 * u, 3 * u, 0.3);
        this.juice.hitstop(0.06);
        this.juice.shake(0.2);
        this.fx.float(x, y - 20 * u, "リロード!", COLORS.aim, 12 * u, 0.7);
        break;
      }
      case "land":
        sfxLand(ev.perfect);
        if (ev.perfect && this.world.status === "playing") {
          const [x, y] = this.px(this.world.player.x, this.world.player.y - 1);
          this.fx.float(x, y, "ソフトランディング", "#7dff8a", 11 * u, 0.7);
        }
        break;
      case "reload":
        sfxReload();
        break;
      case "damage": {
        const [x, y] = this.px(ev.x, ev.y);
        sfxDamage();
        this.juice.hitstop(0.12);
        this.juice.shake(0.6);
        this.juice.flashScreen(COLORS.danger, 0.3);
        this.fx.float(x, y - 20 * u, ev.cause === "crash" ? "激突!" : "-1", COLORS.danger, 15 * u, 0.8);
        break;
      }
      case "cp": {
        sfxCp();
        const [x, y] = this.px(this.world.terrain.cols / 2, ev.row);
        this.fx.ring(x, y, "#7dff8a", 60 * u, 3 * u, 0.5);
        this.fx.float(x, y - 16 * u, "チェックポイント / 弾補給", "#7dff8a", 11 * u, 1);
        break;
      }
      case "glassBreak": {
        const [x, y] = this.px(ev.x, ev.y);
        sfxGlass();
        this.fx.burst(x, y, COLORS.tile.glass, 8, 120 * u, 3 * u);
        break;
      }
      case "telegraph":
        sfxTelegraph();
        break;
      case "enemyShoot":
        sfxEnemyShoot();
        break;
      case "bulletBlocked": {
        const [x, y] = this.px(ev.x, ev.y);
        sfxBlocked();
        this.fx.burst(x, y, COLORS.ammo, 5, 100 * u, 2.5 * u);
        break;
      }
      case "gem": {
        const [x, y] = this.px(ev.x, ev.y);
        sfxGem(this.world.combo);
        this.fx.float(x, y - 10 * u, `+${ev.n}`, COLORS.gem, 11 * u, 0.5);
        break;
      }
      case "ammoPickup":
        sfxAmmoPickup();
        break;
      case "comboAdd":
        if (ev.n === 8) {
          const [x, y] = this.px(this.world.player.x, this.world.player.y - 1.5);
          this.fx.float(x, y, "すごい!", COLORS.overdrive, 15 * u, 0.8);
        }
        break;
      case "comboBank": {
        const [x, y] = this.px(this.world.player.x, this.world.player.y - 1.2);
        sfxComboBank(ev.n);
        this.fx.float(x, y, `コンボ×${ev.n} → +${ev.gems}ジェム`, COLORS.gem, 13 * u, 1);
        break;
      }
      case "overdrive": {
        sfxOverdrive();
        this.juice.flashScreen(COLORS.overdrive, 0.18);
        const [x, y] = this.px(this.world.player.x, this.world.player.y - 1.5);
        this.fx.float(x, y, "OVERDRIVE!", COLORS.overdrive, 17 * u, 1);
        break;
      }
      case "clear": {
        sfxClear();
        this.juice.flashScreen("#7dff8a", 0.25);
        const [x, y] = this.px(this.world.terrain.cols / 2, this.world.player.y - 2);
        this.fx.float(x, y, "とうちゃく!", "#7dff8a", 20 * u, 1.3);
        break;
      }
      case "failed": {
        sfxFail();
        this.juice.shake(0.8);
        const [x, y] = this.px(this.world.player.x, this.world.player.y - 2);
        this.fx.float(x, y, "きたい たいは……", COLORS.danger, 18 * u, 1.3);
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
