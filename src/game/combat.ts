import { angleDiff, clamp, degToRad } from "../core/math.ts";
import type { Enemy, Bullet } from "./enemies.ts";
import type { Hand } from "./hand.ts";
import { BULLET, CORE, ENEMY_DEFS, HAND } from "./config.ts";

export interface SwingHit {
  enemy: Enemy;
  crit: boolean;
}

/**
 * 解放スイングの扇形判定。攻撃判定が生きている間、範囲内の未ヒット敵を返す。
 * クリティカルは「針の先端 CRIT_BAND 帯」に敵中心がある場合。
 */
export function sweepEnemies(hand: Hand, enemies: Enemy[]): SwingHit[] {
  if (!hand.hitActive) return [];
  const tier = HAND.TIERS[hand.attackTier];
  const halfArc = degToRad(tier.arcDeg); // arcDeg は片側の角度(±arcDeg)
  const hits: SwingHit[] = [];
  for (const e of enemies) {
    if (!e.alive || e.hitSwing === hand.swingId) continue;
    if (e.dist > tier.len + ENEMY_DEFS[e.kind].size) continue;
    if (Math.abs(angleDiff(hand.attackAngle, e.angle)) > halfArc) continue;
    e.hitSwing = hand.swingId;
    hits.push({ enemy: e, crit: e.dist >= tier.len * (1 - HAND.CRIT_BAND) });
  }
  return hits;
}

/** 弾が針(中心からvisLenの線分)に触れているか。点と線分の距離で判定 */
export function bulletHitsHand(b: Bullet, hand: Hand): boolean {
  const px = Math.cos(b.angle) * b.dist;
  const py = Math.sin(b.angle) * b.dist;
  const ux = Math.cos(hand.angle);
  const uy = Math.sin(hand.angle);
  const proj = clamp(px * ux + py * uy, 0, hand.visLen);
  const dx = px - proj * ux;
  const dy = py - proj * uy;
  const rr = BULLET.SIZE + HAND.THICK;
  return dx * dx + dy * dy <= rr * rr;
}

/** 弾がコアリングに到達したか(吸収されて消える。ダメージなし) */
export function bulletReachesCore(b: Bullet): boolean {
  return b.dist <= CORE.RADIUS + BULLET.SIZE;
}

/** 敵本体がコアに到達したか(コアダメージ) */
export function enemyReachesCore(e: Enemy): boolean {
  return e.dist <= CORE.RADIUS + ENEMY_DEFS[e.kind].size * 0.5;
}
