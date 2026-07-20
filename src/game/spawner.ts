import { TAU, angleDiff, degToRad, normAngle } from "../core/math.ts";
import { mulberry32 } from "../core/rng.ts";
import type { EnemyKind, Phase } from "./config.ts";
import { CHIME_RESPAWN, ENEMY_DEFS, PHASES, SPAWN_MIN_SEP_DEG } from "./config.ts";
import type { World } from "./world.ts";

export interface Telegraph {
  kind: EnemyKind;
  angle: number;
  t: number; // 残り秒数
  total: number;
}

/** 60秒のフェーズテーブルに従って敵スポーンとテレグラフを管理する */
export class Spawner {
  private rng: () => number;
  private spawnT = 1.0; // 最初のスポーンまで
  private lastAngle: number | null = null;
  private firstSpawn = true;
  private chimeCooldown = 0;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  private currentPhase(elapsed: number): Phase {
    return PHASES.find((p) => elapsed < p.until) ?? PHASES[PHASES.length - 1];
  }

  private pickKind(phase: Phase): EnemyKind {
    let total = 0;
    for (const [, w] of phase.weights) total += w;
    let r = this.rng() * total;
    for (const [kind, w] of phase.weights) {
      r -= w;
      if (r <= 0) return kind;
    }
    return phase.weights[0][0];
  }

  private pickAngle(world: World): number {
    if (this.firstSpawn) {
      // 最初の1体は針の進行方向前方に出して初撃破を保証する
      this.firstSpawn = false;
      return normAngle(world.hand.angle + degToRad(90));
    }
    const minSep = degToRad(SPAWN_MIN_SEP_DEG);
    for (let i = 0; i < 8; i++) {
      const a = this.rng() * TAU;
      if (this.lastAngle === null || Math.abs(angleDiff(this.lastAngle, a)) >= minSep) return a;
    }
    return this.rng() * TAU;
  }

  private schedule(world: World, kind: EnemyKind, angle: number): void {
    const total = ENEMY_DEFS[kind].telegraph;
    world.telegraphs.push({ kind, angle: normAngle(angle), t: total, total });
    world.events.push({ type: "telegraph", kind, angle: normAngle(angle) });
    this.lastAngle = normAngle(angle);
  }

  update(dt: number, world: World): void {
    const phase = this.currentPhase(world.elapsed);

    // 通常スポーン
    if (isFinite(phase.interval)) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT += phase.interval;
        const angle = this.pickAngle(world);
        this.schedule(world, this.pickKind(phase), angle);
        // 対角同時スポーン(終盤フェーズのみ、1/2の確率で)
        if (phase.dual && this.rng() < 0.5) {
          this.schedule(world, this.pickKind(phase), angle + Math.PI);
        }
      }
    }

    // Chimeを規定数まで維持(撃破後はクールダウンを挟む)
    this.chimeCooldown -= dt;
    if (phase.chime > 0 && this.chimeCooldown <= 0) {
      const liveChimes =
        world.enemies.filter((e) => e.alive && e.kind === "chime").length +
        world.telegraphs.filter((t) => t.kind === "chime").length;
      if (liveChimes < phase.chime) {
        this.schedule(world, "chime", this.pickAngle(world));
        this.chimeCooldown = CHIME_RESPAWN;
      }
    }
  }
}
