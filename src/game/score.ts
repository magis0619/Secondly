import { SCORE } from "./config.ts";

export interface KillRecord {
  base: number;
  crit: boolean;
}

/** チェーンコンボ倍率(スイング開始時点のコンボ数から算出) */
export function chainMult(combo: number): number {
  return Math.min(1 + SCORE.CHAIN_STEP * combo, SCORE.CHAIN_MAX);
}

/**
 * 1スイングの獲得スコア。
 * 基礎点(クリット×2込み)の合計 × マルチキル倍率(n体で×n) × 溜めティア倍率 × チェーン倍率
 */
export function swingScore(kills: KillRecord[], tierMult: number, combo: number): number {
  const n = kills.length;
  if (n === 0) return 0;
  const sum = kills.reduce((s, k) => s + k.base * (k.crit ? SCORE.CRIT_MULT : 1), 0);
  return Math.floor(sum * n * tierMult * chainMult(combo));
}
