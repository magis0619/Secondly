import { damp } from "../core/math.ts";
import type { EnemyKind, RunMods, TileKind, WeaponDef } from "./config.ts";
import {
  CAMERA, COMBO, ENEMY_AI, ENEMY_DEFS, GLASS_BREAK_DELAY, LAVA, PHYS, PICKUP, PLAYER, SCORE, TILE_DROPS,
} from "./config.ts";
import type { Enemy, EnemyBullet } from "./enemies.ts";
import { createEnemy, updateEnemy } from "./enemies.ts";
import type { Pickup } from "./pickups.ts";
import { spawnPickup, updatePickup } from "./pickups.ts";
import type { PlayerCtrl } from "./player.ts";
import { Player } from "./player.ts";
import type { StageDef } from "./stages.ts";
import { buildStage } from "./stages.ts";
import type { Terrain } from "./terrain.ts";
import { damageTile, isShootable, isSolid, kindAt, clearTile } from "./terrain.ts";

export type WorldStatus = "playing" | "clear" | "failed";

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  traveled: number;
  range: number;
  dmg: number;
  alive: boolean;
}

export type WorldEvent =
  | { type: "shoot"; x: number; y: number; angle: number }
  | { type: "empty" }
  | { type: "tileHit"; x: number; y: number }
  | { type: "tileBreak"; x: number; y: number; kind: TileKind }
  | { type: "enemyHit"; x: number; y: number }
  | { type: "kill"; x: number; y: number; kind: EnemyKind; score: number }
  | { type: "stomp"; x: number; y: number }
  | { type: "land"; speed: number; perfect: boolean; hard: boolean }
  | { type: "reload" }
  | { type: "damage"; hpLeft: number; cause: string; x: number; y: number }
  | { type: "cp"; row: number }
  | { type: "glassBreak"; x: number; y: number }
  | { type: "telegraph"; x: number; y: number }
  | { type: "enemyShoot"; x: number; y: number }
  | { type: "bulletBlocked"; x: number; y: number }
  | { type: "gem"; x: number; y: number; n: number }
  | { type: "ammoPickup"; x: number; y: number; n: number }
  | { type: "comboAdd"; n: number }
  | { type: "comboBank"; n: number; gems: number }
  | { type: "overdrive" }
  | { type: "lavaWarn"; dist: number }
  | { type: "clear"; score: number; gems: number; timeMs: number; stars: boolean[] }
  | { type: "failed"; score: number; gems: number };

/**
 * プレイ1回分の全状態(リトライ=new World)。純ロジック、演出はevents経由。
 */
export class World {
  readonly stage: StageDef;
  readonly terrain: Terrain;
  readonly player: Player;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  enemyBullets: EnemyBullet[] = [];
  pickups: Pickup[] = [];
  camera = { y: -3 };
  elapsed = 0;
  score = 0;
  gems = 0;
  gemsTotal = 0;
  combo = 0;
  overdriveCharged = false;
  damageTaken = 0;
  status: WorldStatus = "playing";
  events: WorldEvent[] = [];
  lastLandSpeed = 0;
  /** 溶岩の水面(行。時間で減少=上昇してくる) */
  lavaY = 0;
  /** 画面の可視行数(敵の起動判定用。シーンが毎フレーム設定) */
  visibleRows = 14;

  private passedCp = new Set<number>();
  private glassTimers = new Map<number, number>();
  private emptyClickT = 0;
  private meltRow: number;
  private lavaWarnT = 0;

  constructor(stage: StageDef, mods: RunMods) {
    this.stage = stage;
    const compiled = buildStage(stage);
    this.terrain = compiled.terrain;
    // 底のスタート足場の上から開始。溶岩はさらに下から追ってくる
    this.player = new Player(this.terrain.cols / 2, this.terrain.rows - 1 - PHYS.PLAYER_R - 0.05, mods);
    this.lavaY = this.terrain.rows + 3;
    this.meltRow = this.terrain.rows;
    this.camera.y = this.player.y;
    for (const s of compiled.enemies) {
      this.enemies.push(createEnemy(s.kind, s.col, s.row, this.terrain));
    }
    // 回収率スター用の総ジェム数
    for (const k of this.terrain.tiles) {
      const d = TILE_DROPS[k];
      if (d) this.gemsTotal += d.gems;
    }
    for (const e of this.enemies) this.gemsTotal += ENEMY_DEFS[e.kind].gems;
  }

  update(dt: number, ctrl: PlayerCtrl): void {
    if (this.status !== "playing") return;
    this.elapsed += dt;
    this.emptyClickT = Math.max(this.emptyClickT - dt, 0);
    const t = this.terrain;
    const p = this.player;

    // 風
    let windAx = 0;
    for (const [a, b, ax] of t.winds) if (p.y >= a && p.y < b) windAx = ax;

    p.update(dt, ctrl, t, windAx, {
      shoot: (dx, dy, w) => this.fireWeapon(dx, dy, w),
      emptyClick: () => {
        if (this.emptyClickT <= 0) {
          this.emptyClickT = 0.25;
          this.events.push({ type: "empty" });
        }
      },
      landed: (speed, hard) => this.onLanded(speed, hard),
      steppedGlass: (col, row) => {
        const key = row * t.cols + col;
        if (!this.glassTimers.has(key)) this.glassTimers.set(key, GLASS_BREAK_DELAY);
      },
    });

    // ガラス割れタイマー
    for (const [key, left] of this.glassTimers) {
      const nl = left - dt;
      if (nl <= 0) {
        this.glassTimers.delete(key);
        const col = key % t.cols;
        const row = Math.floor(key / t.cols);
        if (kindAt(t, col, row) === "glass") {
          clearTile(t, col, row);
          this.events.push({ type: "glassBreak", x: col + 0.5, y: row + 0.5 });
        }
      } else {
        this.glassTimers.set(key, nl);
      }
    }

    // チェックポイント(上向きに通過で発動)
    for (const row of t.checkpoints) {
      if (!this.passedCp.has(row) && p.y <= row) {
        this.passedCp.add(row);
        p.refillAmmo(PLAYER.CP_AMMO);
        this.events.push({ type: "cp", row });
      }
    }

    // 溶岩の上昇(先行しすぎたら追い上げ、追い越しはしない)
    let lavaSpeed = this.stage.lavaSpeed;
    if (this.lavaY - p.y > LAVA.CATCHUP_LEAD) lavaSpeed *= LAVA.CATCHUP_MULT;
    this.lavaY -= lavaSpeed * dt;
    // 呑まれた地形・敵・破片を溶かす
    while (this.meltRow - 1 > this.lavaY && this.meltRow > 0) {
      this.meltRow--;
      for (let c = 0; c < t.cols; c++) t.tiles[this.meltRow * t.cols + c] = "empty";
    }
    for (const e of this.enemies) if (e.alive && e.y > this.lavaY + 0.3) e.alive = false;
    for (const pk3 of this.pickups) if (pk3.alive && pk3.y > this.lavaY + 0.3) pk3.alive = false;
    // 接触: 1ダメージ+上に打ち上げ(リカバリー可能)
    if (p.y + PHYS.PLAYER_R > this.lavaY) {
      p.takeDamage("lava", 0, 0, (hp, c) => this.onDamaged(hp, c));
      p.y = this.lavaY - 2;
      p.vy = LAVA.BOUNCE_VY;
    }
    // 接近警告(スロットル)
    this.lavaWarnT -= dt;
    const lavaDist = this.lavaY - (p.y + PHYS.PLAYER_R);
    if (lavaDist < LAVA.WARN_ROWS && this.lavaWarnT <= 0 && this.status === "playing") {
      this.lavaWarnT = 0.8;
      this.events.push({ type: "lavaWarn", dist: Math.max(lavaDist, 0) });
    }

    // ハザード(トゲ・溶岩): プレイヤーが重なるタイル
    const pk = kindAt(t, Math.floor(p.x), Math.floor(p.y));
    if (pk === "spike" || pk === "lava") {
      p.takeDamage(pk, -Math.sign(p.vx || 1) * PHYS.KNOCKBACK * 0.5, -PHYS.KNOCKBACK, (hp, c) =>
        this.onDamaged(hp, c),
      );
    }

    // 敵(アンカー0.6=画面の上6割が前方視界)
    const camTop = this.camera.y - this.visibleRows * 0.65;
    const camBottom = this.camera.y + this.visibleRows * 0.45;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const onScreen = e.y > camTop && e.y < camBottom;
      updateEnemy(e, dt, this.elapsed, t, p.x, p.y, onScreen, {
        enemyShoot: (x, y, angle) => {
          this.enemyBullets.push({
            x, y,
            vx: Math.cos(angle) * ENEMY_AI.HOUDAI_SHOT_SPEED,
            vy: Math.sin(angle) * ENEMY_AI.HOUDAI_SHOT_SPEED,
            alive: true,
          });
          this.events.push({ type: "enemyShoot", x, y });
        },
        telegraph: (x, y) => this.events.push({ type: "telegraph", x, y }),
      });
      // 接触判定(踏みつけ or 被弾)
      const def = ENEMY_DEFS[e.kind];
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      if (Math.abs(dx) < def.r + PHYS.PLAYER_R && Math.abs(dy) < def.r + PHYS.PLAYER_R) {
        const fromAbove = p.y < e.y - def.r * 0.2 && p.vy > 1.5;
        if (def.stompable && fromAbove) {
          this.killEnemy(e, true);
          p.vy = PHYS.STOMP_BOUNCE;
          p.ammo = p.maxAmmo; // 踏みつけ=フルリロード
          this.events.push({ type: "stomp", x: e.x, y: e.y });
          this.events.push({ type: "reload" });
        } else {
          p.takeDamage("enemy", Math.sign(dx || 1) * PHYS.KNOCKBACK, -PHYS.KNOCKBACK * 0.7, (hp, c) =>
            this.onDamaged(hp, c),
          );
        }
      }
    }

    // プレイヤー弾
    for (const b of this.bullets) {
      if (!b.alive) continue;
      this.stepBullet(b, dt);
    }
    // 敵弾
    for (const b of this.enemyBullets) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (isSolid(kindAt(t, Math.floor(b.x), Math.floor(b.y)))) {
        b.alive = false;
        continue;
      }
      if (Math.abs(b.x - p.x) < 0.45 && Math.abs(b.y - p.y) < 0.45) {
        b.alive = false;
        p.takeDamage("bullet", Math.sign(p.x - b.x) * PHYS.KNOCKBACK * 0.6, -PHYS.KNOCKBACK * 0.5, (hp, c) =>
          this.onDamaged(hp, c),
        );
      }
    }

    // ピックアップ
    for (const pk2 of this.pickups) {
      if (!pk2.alive) continue;
      if (updatePickup(pk2, dt, t, p.x, p.y, PLAYER.MAGNET_R)) {
        if (pk2.kind === "ammo") {
          p.addAmmo(PICKUP.AMMO_PER_SHARD);
          this.events.push({ type: "ammoPickup", x: pk2.x, y: pk2.y, n: PICKUP.AMMO_PER_SHARD });
        } else {
          const n = pk2.kind === "gemBig" ? 5 : 1;
          this.gems += n;
          this.score += SCORE.GEM_SCORE * n;
          this.events.push({ type: "gem", x: pk2.x, y: pk2.y, n });
        }
      }
    }

    // 掃除
    this.bullets = this.bullets.filter((b) => b.alive);
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);
    this.pickups = this.pickups.filter((b) => b.alive);

    // 着地パッド(接地+真下がパッド)
    if (p.grounded) {
      const below = kindAt(t, Math.floor(p.x), Math.floor(p.y + PHYS.PLAYER_R + 0.06));
      if (below === "pad") this.finishClear();
    }

    // カメラ(下端はステージ底まで)
    const target = p.y;
    const rate = target > this.camera.y ? CAMERA.FOLLOW_DOWN : CAMERA.FOLLOW_UP;
    this.camera.y += (target - this.camera.y) * damp(rate, dt);
    this.camera.y = Math.min(this.camera.y, this.terrain.rows - 3);
  }

  private fireWeapon(dx: number, dy: number, w: WeaponDef): void {
    const p = this.player;
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < w.pellets; i++) {
      const spread = ((Math.random() - 0.5) * w.spreadDeg * Math.PI) / 180;
      const a = base + spread;
      this.bullets.push({
        x: p.x + Math.cos(a) * 0.5,
        y: p.y + Math.sin(a) * 0.5,
        vx: Math.cos(a) * w.speed,
        vy: Math.sin(a) * w.speed,
        traveled: 0,
        range: w.range * (0.9 + Math.random() * 0.2),
        dmg: w.dmg,
        alive: true,
      });
    }
    this.events.push({ type: "shoot", x: p.x, y: p.y, angle: base });
  }

  /** 弾をサブステップで進めてタイル/敵/敵弾と判定 */
  private stepBullet(b: Bullet, dt: number): void {
    const t = this.terrain;
    const dist = Math.hypot(b.vx, b.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / 0.25));
    for (let s = 0; s < steps && b.alive; s++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      b.traveled += dist / steps;
      if (b.traveled >= b.range) {
        b.alive = false;
        return;
      }
      const col = Math.floor(b.x);
      const row = Math.floor(b.y);
      const k = kindAt(t, col, row);
      if (isSolid(k)) {
        b.alive = false;
        if (isShootable(k)) {
          if (damageTile(t, col, row, b.dmg)) this.onTileDestroyed(col, row, k);
          else this.events.push({ type: "tileHit", x: b.x, y: b.y });
        } else {
          this.events.push({ type: "tileHit", x: b.x, y: b.y });
        }
        return;
      }
      // 敵弾の撃ち消し
      for (const eb of this.enemyBullets) {
        if (!eb.alive) continue;
        if (Math.abs(eb.x - b.x) < 0.35 && Math.abs(eb.y - b.y) < 0.35) {
          eb.alive = false;
          b.alive = false;
          this.events.push({ type: "bulletBlocked", x: b.x, y: b.y });
          return;
        }
      }
      // 敵ヒット
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const def = ENEMY_DEFS[e.kind];
        if (Math.abs(e.x - b.x) < def.r + 0.15 && Math.abs(e.y - b.y) < def.r + 0.15) {
          b.alive = false;
          e.hp -= b.dmg;
          if (e.hp <= 0) this.killEnemy(e, false);
          else {
            e.hitFlash = 0.12;
            this.events.push({ type: "enemyHit", x: b.x, y: b.y });
          }
          return;
        }
      }
    }
  }

  private onTileDestroyed(col: number, row: number, kind: TileKind): void {
    this.score += SCORE.TILE;
    this.events.push({ type: "tileBreak", x: col + 0.5, y: row + 0.5, kind });
    const drops = TILE_DROPS[kind];
    if (drops) {
      for (let i = 0; i < drops.ammoShards; i++) {
        this.pickups.push(spawnPickup("ammo", col + 0.5, row + 0.5));
      }
      for (let i = 0; i < drops.gems; i++) {
        this.pickups.push(spawnPickup("gem", col + 0.5, row + 0.5));
      }
    }
    if (kind !== "glass") this.addCombo();
  }

  private killEnemy(e: Enemy, stomped: boolean): void {
    e.alive = false;
    const def = ENEMY_DEFS[e.kind];
    this.score += def.score;
    for (let i = 0; i < def.ammoShards; i++) this.pickups.push(spawnPickup("ammo", e.x, e.y));
    for (let i = 0; i < def.gems; i++) this.pickups.push(spawnPickup("gem", e.x, e.y));
    this.events.push({ type: "kill", x: e.x, y: e.y, kind: e.kind, score: def.score });
    this.addCombo();
    if (stomped) this.addCombo(); // 踏みは+2(気持ちよさ優先)
  }

  private addCombo(): void {
    this.combo += 1;
    this.events.push({ type: "comboAdd", n: this.combo });
    if (this.combo >= COMBO.OVERDRIVE_AT && !this.overdriveCharged) {
      this.overdriveCharged = true;
      this.player.overdriveT = COMBO.OVERDRIVE_TIME;
      this.events.push({ type: "overdrive" });
    }
  }

  private onLanded(speed: number, hard: boolean): void {
    // 激突ダメージは廃止(上昇型では登り降りが頻繁なため過剰な罰になる)。
    // 落下の代償は「溶岩に時間を与える」ことで十分。hardは重い着地音・揺れの演出のみ
    this.lastLandSpeed = speed;
    this.events.push({ type: "land", speed, perfect: !hard && speed < 3, hard });
    // 接地=フルリロード
    if (this.player.ammo < this.player.maxAmmo) {
      this.player.ammo = this.player.maxAmmo;
      this.events.push({ type: "reload" });
    }
    // エアコンボ確定
    if (this.combo >= 4) {
      const bonus = Math.floor(this.combo * COMBO.BANK_GEM_PER);
      this.gems += bonus;
      this.score += bonus * SCORE.GEM_SCORE;
      this.events.push({ type: "comboBank", n: this.combo, gems: bonus });
    }
    this.combo = 0;
    this.overdriveCharged = false;
  }

  private onDamaged(hpLeft: number, cause: string): void {
    this.damageTaken += 1;
    this.combo = 0;
    this.events.push({ type: "damage", hpLeft, cause, x: this.player.x, y: this.player.y });
    if (hpLeft <= 0) {
      this.status = "failed";
      this.events.push({ type: "failed", score: this.score, gems: this.gems });
    }
  }

  private finishClear(): void {
    if (this.status !== "playing") return;
    this.status = "clear";
    // 余裕クリアボーナス(溶岩をどれだけ引き離して登頂したか)
    const margin = Math.max(0, Math.floor(this.lavaY - this.player.y));
    const timeBonus = Math.max(0, Math.floor(this.stage.parTime - this.elapsed)) * SCORE.TIME_BONUS_PER_SEC;
    this.score += margin * SCORE.LAVA_MARGIN + timeBonus + this.player.hp * SCORE.HP_BONUS;
    const stars: boolean[] = [
      true,
      this.damageTaken === 0,
      this.gemsTotal > 0 && this.gems >= Math.floor(this.gemsTotal * 0.8),
    ];
    this.events.push({
      type: "clear",
      score: this.score,
      gems: this.gems,
      timeMs: Math.round(this.elapsed * 1000),
      stars,
    });
  }

  cpPassed(row: number): boolean {
    return this.passedCp.has(row);
  }

  drainEvents(): WorldEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
