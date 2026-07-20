import { damp } from "../core/math.ts";
import type { RunMods, TileKind } from "./config.ts";
import { CAMERA, SCORE } from "./config.ts";
import type { Ctrl } from "./machine.ts";
import { Machine } from "./machine.ts";
import { pickupCoins, pickupScore, smashScore } from "./score.ts";
import type { StageDef } from "./stages.ts";
import type { Terrain } from "./terrain.ts";
import { parseRows } from "./terrain.ts";

export type WorldStatus = "playing" | "clear" | "failed";

export type WorldEvent =
  | { type: "dig"; col: number; row: number }
  | { type: "smash"; col: number; row: number; kind: TileKind }
  | { type: "clang"; col: number; row: number }
  | { type: "dashStart"; tier: number }
  | { type: "dashEnd"; smashed: number; score: number; tier: number }
  | { type: "pickup"; col: number; row: number; kind: "ore" | "gem"; score: number; coins: number; duringDash: boolean }
  | { type: "gasBurst"; col: number; row: number; harmless: boolean }
  | { type: "tierUp"; tier: number }
  | { type: "damage"; hpLeft: number; col: number; row: number }
  | { type: "clear"; score: number; coins: number; timeMs: number }
  | { type: "failed"; score: number; coins: number };

/**
 * プレイ1回分の全状態(リトライ = new World)。描画にもストレージにも触れない純ロジック。
 * machine からのコールバック(MachineHost)を受けてスコア・コインを集計し、
 * 演出・音はイベント(drainEvents)経由でシーン側が反応する。
 */
export class World {
  readonly stage: StageDef;
  readonly terrain: Terrain;
  readonly machine: Machine;
  camera = { depth: -2.5 };
  elapsed = 0;
  score = 0;
  coins = 0;
  status: WorldStatus = "playing";
  events: WorldEvent[] = [];

  constructor(stage: StageDef, mods: RunMods) {
    this.stage = stage;
    this.terrain = parseRows(stage.rows);
    this.machine = new Machine(mods);
  }

  get depthMax(): number {
    return this.terrain.rows;
  }

  update(dt: number, ctrl: Ctrl): void {
    if (this.status !== "playing") return;
    this.elapsed += dt;

    this.machine.update(dt, ctrl, this.terrain, {
      dig: (col, row) => this.events.push({ type: "dig", col, row }),
      smash: (col, row, kind) => this.events.push({ type: "smash", col, row, kind }),
      clang: (col, row) => this.events.push({ type: "clang", col, row }),
      pickup: (col, row, kind, duringDash) => {
        const score = pickupScore(kind, duringDash);
        const coins = pickupCoins(kind);
        this.score += score;
        this.coins += coins;
        this.events.push({ type: "pickup", col, row, kind, score, coins, duringDash });
      },
      gasBurst: (col, row, harmless) => this.events.push({ type: "gasBurst", col, row, harmless }),
      damaged: (hpLeft, col, row) => {
        this.events.push({ type: "damage", hpLeft, col, row });
        if (hpLeft <= 0) {
          this.status = "failed";
          this.events.push({ type: "failed", score: this.score, coins: this.coins });
        }
      },
      reachCore: () => {
        if (this.status !== "playing") return;
        this.status = "clear";
        const timeBonus = Math.max(0, Math.floor(this.stage.parTime - this.elapsed)) * SCORE.TIME_BONUS_PER_SEC;
        const hpBonus = this.machine.hp * SCORE.HP_BONUS;
        this.score += timeBonus + hpBonus;
        this.events.push({
          type: "clear",
          score: this.score,
          coins: this.coins,
          timeMs: Math.round(this.elapsed * 1000),
        });
      },
      dashStart: (tier) => this.events.push({ type: "dashStart", tier }),
      dashEnd: (smashed, tier) => {
        const score = smashScore(smashed);
        this.score += score;
        this.events.push({ type: "dashEnd", smashed, score, tier });
      },
      tierUp: (tier) => this.events.push({ type: "tierUp", tier }),
    });

    // カメラ追従(ダッシュ中は速く)
    const rate = this.machine.state === "dashing" ? CAMERA.FOLLOW_DASH : CAMERA.FOLLOW;
    this.camera.depth += (this.machine.depth - this.camera.depth) * damp(rate, dt);
    this.camera.depth = Math.max(this.camera.depth, -2.5);
  }

  drainEvents(): WorldEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
