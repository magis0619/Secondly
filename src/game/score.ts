import { SCORE } from "./config.ts";

/** 貫通コンボ: 1ダッシュで壊したタイル数nに対して 30×n²(まとめて抜くほど跳ねる) */
export function smashScore(n: number): number {
  return n > 0 ? SCORE.SMASH_BASE * n * n : 0;
}

export function pickupScore(kind: "ore" | "gem", duringDash: boolean): number {
  const base = kind === "gem" ? SCORE.GEM : SCORE.ORE;
  return base * (duringDash ? SCORE.DASH_PICKUP_MULT : 1);
}

export function pickupCoins(kind: "ore" | "gem"): number {
  return kind === "gem" ? SCORE.GEM_COINS : SCORE.ORE_COINS;
}
