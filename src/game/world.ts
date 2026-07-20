import type { EnemyKind } from "./config.ts";
import { BULLET, CHIME, CORE, ENEMY_DEFS, HAND, SCORE, STAGE } from "./config.ts";
import { bulletHitsHand, bulletReachesCore, enemyReachesCore, sweepEnemies } from "./combat.ts";
import type { Bullet, Enemy } from "./enemies.ts";
import { createEnemy } from "./enemies.ts";
import { Hand } from "./hand.ts";
import type { KillRecord } from "./score.ts";
import { swingScore } from "./score.ts";
import type { Telegraph } from "./spawner.ts";
import { Spawner } from "./spawner.ts";

export type WorldStatus = "playing" | "clear" | "failed";

export type WorldEvent =
  | { type: "telegraph"; kind: EnemyKind; angle: number }
  | { type: "spawn"; kind: EnemyKind; angle: number }
  | { type: "swing"; tier: number }
  | { type: "tierUp"; tier: number }
  | { type: "hit"; angle: number; dist: number; kind: EnemyKind }
  | { type: "kill"; angle: number; dist: number; kind: EnemyKind; crit: boolean }
  | {
      type: "swingResult";
      kills: number;
      score: number;
      tier: number;
      anyCrit: boolean;
      angle: number;
      combo: number;
    }
  | { type: "chimeShot"; angle: number; dist: number }
  | { type: "bulletAbsorb"; angle: number }
  | { type: "coreHit"; hpLeft: number; angle: number }
  | { type: "second"; sec: number }
  | { type: "clear"; score: number }
  | { type: "failed"; score: number };

/**
 * プレイ1回分の全状態。リトライ = new World() で状態リセット漏れを構造的に防ぐ。
 * 描画にもDOMにも触れない純ロジック。演出・音はeventsを介してシーン側が反応する。
 */
export class World {
  elapsed = 0;
  hand = new Hand();
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  telegraphs: Telegraph[] = [];
  spawner: Spawner;
  coreHp: number = CORE.HP;
  invulnT = 0;
  status: WorldStatus = "playing";
  score = 0;
  combo = 0;
  maxCombo = 0;
  chainT = 0;
  events: WorldEvent[] = [];

  private lastSecond = -1;
  private swingKills: KillRecord[] = [];
  private swingScored = true;

  constructor(seed: number) {
    this.spawner = new Spawner(seed);
  }

  get timeLeft(): number {
    return Math.max(STAGE.TIME - this.elapsed, 0);
  }

  update(dt: number, pressed: boolean): void {
    if (this.status !== "playing") return;

    this.elapsed += dt;
    this.invulnT = Math.max(this.invulnT - dt, 0);

    const sec = Math.floor(this.elapsed);
    if (sec !== this.lastSecond && sec <= STAGE.TIME) {
      this.lastSecond = sec;
      this.events.push({ type: "second", sec });
    }

    // チェーンコンボの時間切れ
    if (this.combo > 0) {
      this.chainT -= dt;
      if (this.chainT <= 0) this.combo = 0;
    }

    // 針
    this.hand.update(dt, pressed, this.elapsed);
    if (this.hand.justReleased) {
      this.swingKills = [];
      this.swingScored = false;
      this.events.push({ type: "swing", tier: this.hand.attackTier });
    }
    if (this.hand.justTierUp) {
      this.events.push({ type: "tierUp", tier: this.hand.justTierUp });
    }

    // スポーン(テレグラフ経由)
    this.spawner.update(dt, this);
    for (const tg of this.telegraphs) {
      tg.t -= dt;
      if (tg.t <= 0) {
        this.enemies.push(createEnemy(tg.kind, tg.angle, Math.random() * 1000));
        this.events.push({ type: "spawn", kind: tg.kind, angle: tg.angle });
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => t.t > 0);

    // 敵の移動・射撃・コア到達
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.hitFlash = Math.max(e.hitFlash - dt, 0);
      const def = ENEMY_DEFS[e.kind];
      if (e.kind === "chime" && e.dist <= CHIME.STOP_DIST) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT += CHIME.FIRE_INTERVAL;
          this.bullets.push({ angle: e.angle, dist: e.dist - def.size, alive: true });
          this.events.push({ type: "chimeShot", angle: e.angle, dist: e.dist });
        }
      } else {
        e.dist -= def.speed * dt;
      }
      if (enemyReachesCore(e)) {
        e.alive = false;
        this.damageCore(e.angle);
      }
    }

    // 弾の移動・針/コアリング判定
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.dist -= BULLET.SPEED * dt;
      if (bulletHitsHand(b, this.hand)) {
        b.alive = false;
        this.damageCore(b.angle);
      } else if (bulletReachesCore(b)) {
        // コアリングが吸収(ダメージなし)。「縮んでやり過ごす」回避を成立させる
        b.alive = false;
        this.events.push({ type: "bulletAbsorb", angle: b.angle });
      }
    }

    // スイングの当たり
    const tier = HAND.TIERS[this.hand.attackTier];
    for (const h of sweepEnemies(this.hand, this.enemies)) {
      h.enemy.hp -= tier.power;
      if (h.enemy.hp <= 0) {
        h.enemy.alive = false;
        this.swingKills.push({ base: ENEMY_DEFS[h.enemy.kind].score, crit: h.crit });
        this.events.push({
          type: "kill",
          angle: h.enemy.angle,
          dist: h.enemy.dist,
          kind: h.enemy.kind,
          crit: h.crit,
        });
      } else {
        h.enemy.hitFlash = 0.15;
        this.events.push({ type: "hit", angle: h.enemy.angle, dist: h.enemy.dist, kind: h.enemy.kind });
      }
    }

    // スイング判定が終わった瞬間にスコア確定(マルチキル倍率のため一括計算)
    if (!this.swingScored && !this.hand.hitActive) {
      this.swingScored = true;
      const n = this.swingKills.length;
      if (n > 0) {
        const add = swingScore(this.swingKills, HAND.TIERS[this.hand.attackTier].mult, this.combo);
        this.score += add;
        this.combo += n;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.chainT = SCORE.CHAIN_WINDOW;
        this.events.push({
          type: "swingResult",
          kills: n,
          score: add,
          tier: this.hand.attackTier,
          anyCrit: this.swingKills.some((k) => k.crit),
          angle: this.hand.attackAngle,
          combo: this.combo,
        });
      }
    }

    // 死亡・消滅エンティティの掃除
    this.enemies = this.enemies.filter((e) => e.alive);
    this.bullets = this.bullets.filter((b) => b.alive);

    // ステージ終了
    if (this.elapsed >= STAGE.TIME) {
      this.status = "clear";
      this.score += SCORE.CLEAR_BONUS_PER_HP * this.coreHp;
      this.events.push({ type: "clear", score: this.score });
    }
  }

  private damageCore(angle: number): void {
    if (this.invulnT > 0 || this.status !== "playing") return;
    this.coreHp -= 1;
    this.invulnT = CORE.INVULN;
    this.combo = 0;
    this.events.push({ type: "coreHit", hpLeft: this.coreHp, angle });
    if (this.coreHp <= 0) {
      this.status = "failed";
      this.events.push({ type: "failed", score: this.score });
    }
  }

  /** シーン側が毎フレーム回収する */
  drainEvents(): WorldEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
