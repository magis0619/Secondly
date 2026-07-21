import type { EnemyKind } from "./config.ts";
import { ENEMY_AI, ENEMY_DEFS } from "./config.ts";
import type { Terrain } from "./terrain.ts";
import { isSolid, kindAt } from "./terrain.ts";

/**
 * 敵。すべて配置制・決定論パターン(公平性原則)。
 * 白(stompable)=踏める / 赤=踏めない。
 */
export interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  baseY: number; // fuwari浮遊の基準
  dir: number; // togemaruの進行方向
  hp: number;
  alive: boolean;
  hitFlash: number;
  phase: number; // 各種タイマー位相
  /** houdai: 状態 0=idle 1=aim 2=cooldown */
  aiState: number;
  aiT: number;
  aimAngle: number;
  /** 壁付き砲台の向き(+1=右向き, -1=左向き) */
  facing: number;
}

export interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export function createEnemy(kind: EnemyKind, x: number, y: number, terrain: Terrain): Enemy {
  // 砲台は近い側の壁に向きを合わせる
  const facing = x < terrain.cols / 2 ? 1 : -1;
  return {
    kind,
    x,
    y,
    baseY: y,
    dir: 1,
    hp: ENEMY_DEFS[kind].hp,
    alive: true,
    hitFlash: 0,
    phase: (x * 7 + y * 13) % 6.28,
    aiState: 0,
    aiT: ENEMY_AI.HOUDAI_IDLE * (0.5 + ((x + y) % 1)),
    aimAngle: 0,
    facing,
  };
}

export interface EnemyHost {
  /** 砲台が発射(worldが弾生成) */
  enemyShoot(x: number, y: number, angle: number): void;
  telegraph(x: number, y: number): void;
}

export function updateEnemy(
  e: Enemy,
  dt: number,
  elapsed: number,
  t: Terrain,
  px: number,
  py: number,
  onScreen: boolean,
  host: EnemyHost,
): void {
  e.hitFlash = Math.max(e.hitFlash - dt, 0);
  const def = ENEMY_DEFS[e.kind];

  switch (e.kind) {
    case "fuwari":
      // その場でゆっくり上下
      e.y = e.baseY + Math.sin(elapsed * ENEMY_AI.FUWARI_SPEED + e.phase) * ENEMY_AI.FUWARI_AMP;
      break;

    case "togemaru": {
      // 左右パトロール。壁・固体タイルで反転
      const nx = e.x + e.dir * ENEMY_AI.TOGE_SPEED * dt;
      const edge = nx + e.dir * def.r;
      if (isSolid(kindAt(t, Math.floor(edge), Math.floor(e.y)))) {
        e.dir *= -1;
      } else {
        e.x = nx;
      }
      break;
    }

    case "houdai": {
      // 画面内+射程内でのみ起動。idle→予告(レーザーサイト)→発射→idle
      const dist = Math.hypot(px - e.x, py - e.y);
      const active = onScreen && dist <= ENEMY_AI.HOUDAI_RANGE;
      e.aiT -= dt;
      if (e.aiState === 0) {
        if (active && e.aiT <= 0) {
          e.aiState = 1;
          e.aiT = ENEMY_AI.HOUDAI_AIM;
          e.aimAngle = Math.atan2(py - e.y, px - e.x); // 予告開始時にロック
          host.telegraph(e.x, e.y);
        }
      } else if (e.aiState === 1) {
        if (e.aiT <= 0) {
          host.enemyShoot(e.x, e.y, e.aimAngle);
          e.aiState = 0;
          e.aiT = ENEMY_AI.HOUDAI_IDLE;
        }
      }
      break;
    }
  }
}
