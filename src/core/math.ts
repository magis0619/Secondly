export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** aからbへの最短角度差を [-PI, PI] で返す */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function normAngle(a: number): number {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

export function easeInQuad(t: number): number {
  return t * t;
}

/** フレームレート非依存の指数的追従係数 */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}
