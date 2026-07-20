import type { EnemyKind } from "./config.ts";
import { ENEMY_DEFS, SPAWN_DIST } from "./config.ts";

export interface Enemy {
  kind: EnemyKind;
  angle: number; // 極座標(rad)
  dist: number; // 中心からの距離(R比)
  hp: number;
  alive: boolean;
  /** 重複ヒット防止: 最後に被弾したスイングID */
  hitSwing: number;
  /** 被弾フラッシュの残り秒数(描画用) */
  hitFlash: number;
  /** Chime専用: 次弾までの秒数 */
  fireT: number;
  /** 描画のゆらぎ用シード */
  wobble: number;
}

export interface Bullet {
  angle: number;
  dist: number;
  alive: boolean;
}

export function createEnemy(kind: EnemyKind, angle: number, wobble: number): Enemy {
  return {
    kind,
    angle,
    dist: SPAWN_DIST,
    hp: ENEMY_DEFS[kind].hp,
    alive: true,
    hitSwing: -1,
    hitFlash: 0,
    fireT: 1.0, // 停止位置到達後、最初の弾までの間
    wobble,
  };
}
