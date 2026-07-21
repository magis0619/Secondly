import { PICKUP, PHYS } from "./config.ts";
import type { Terrain } from "./terrain.ts";
import { isSolid, kindAt } from "./terrain.ts";

export type PickupKind = "ammo" | "gem" | "gemBig";

/**
 * 破片・ジェム。軽量な自前物理(重力+タイル反発+磁力吸引)。
 * matter.jsの代替: 挙動は「跳ねて散らばり、近づくと吸い付く」で十分なため。
 */
export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  alive: boolean;
  rot: number;
}

export function spawnPickup(kind: PickupKind, x: number, y: number): Pickup {
  const a = Math.random() * Math.PI * 2;
  const sp = 3 + Math.random() * 4;
  return {
    kind,
    x,
    y,
    vx: Math.cos(a) * sp,
    vy: Math.sin(a) * sp - 2.5,
    life: PICKUP.LIFE,
    alive: true,
    rot: Math.random() * Math.PI * 2,
  };
}

/** 更新して、プレイヤーに回収されたらtrueを返す */
export function updatePickup(
  p: Pickup,
  dt: number,
  t: Terrain,
  px: number,
  py: number,
  magnetR: number,
): boolean {
  p.life -= dt;
  if (p.life <= 0) {
    p.alive = false;
    return false;
  }
  p.rot += dt * 6;

  const dx = px - p.x;
  const dy = py - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < PICKUP.COLLECT_R) {
    p.alive = false;
    return true;
  }
  if (dist < magnetR) {
    // 磁力吸引(近いほど強く)
    const k = (PICKUP.MAGNET_ACCEL * (1 - dist / magnetR)) / (dist || 1);
    p.vx += dx * k * dt;
    p.vy += dy * k * dt;
  } else {
    p.vy += PHYS.GRAVITY * PICKUP.GRAVITY_K * dt;
  }
  p.vx *= 1 - 1.6 * dt;
  p.vy *= 1 - 0.4 * dt;

  // タイル反発(軸別)
  let nx = p.x + p.vx * dt;
  if (isSolid(kindAt(t, Math.floor(nx), Math.floor(p.y)))) {
    p.vx *= -PICKUP.BOUNCE;
    nx = p.x;
  }
  let ny = p.y + p.vy * dt;
  if (isSolid(kindAt(t, Math.floor(nx), Math.floor(ny)))) {
    p.vy *= -PICKUP.BOUNCE;
    p.vx *= 0.8;
    ny = p.y;
  }
  p.x = nx;
  p.y = ny;
  return false;
}
