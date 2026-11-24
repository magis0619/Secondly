/**
 * ゴースト: 過去のプレイの「時刻→高さ」だけを記録し、次のプレイで半透明のキャラとして並走させる。
 * 足場はプレイごとにランダムなので、横位置は再生時の塔から決める(高さだけが本質)。
 * 保存先はlocalStorage(モード別に自己ベストの1本ずつ)。ほんばんのベストはFirestoreへも
 * 同梱して送り(online.ts)、世界1位のゴーストとして誰でも並走できる。
 */
import { GAME, ONLINE } from "./config.ts";

/** keys: [開始からの経過センチ秒, その時点の高さ(ホップ/落下の着地先)] */
export interface GhostRun {
  score: number;
  keys: [number, number][];
  /** 世界ゴーストの持ち主名(自分のゴーストは未設定) */
  name?: string;
}

const KEY = "climb30.ghost.v1";
/** ホップ/落下の見た目の所要秒(ゲーム側のアニメ長に合わせた近似) */
const HOP_ANIM = 0.1;
const FALL_ANIM = 0.3;

export type GhostSlot = "practice" | "ranked";

/** プレイ中の記録係。ホップ/落下のたびに(経過秒, 高さ)を積む */
export class GhostRecorder {
  keys: [number, number][] = [];
  push(elapsedSec: number, h: number): void {
    if (this.keys.length >= ONLINE.GHOST_MAX_KEYS) return;
    this.keys.push([Math.round(elapsedSec * 100), h]);
  }
}

/** 経過秒tでのゴーストの高さ(滑らか)と、そこまでの最高到達点 */
export function ghostAt(run: GhostRun, sec: number): { h: number; max: number } {
  const cs = sec * 100;
  let prevH = 0;
  let curH = 0;
  let curT = 0;
  let max = 0;
  for (const [kt, kh] of run.keys) {
    if (kt > cs) break;
    prevH = curH;
    curH = kh;
    curT = kt;
    if (kh > max) max = kh;
  }
  const anim = curH > prevH ? HOP_ANIM : FALL_ANIM;
  const f = Math.min(Math.max((cs - curT) / 100 / anim, 0), 1);
  return { h: prevH + (curH - prevH) * f, max };
}

// ---- 保存(localStorage) ----

function readAll(): Partial<Record<GhostSlot, GhostRun>> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Partial<Record<GhostSlot, GhostRun>>;
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

export function loadGhost(mode: GhostSlot): GhostRun | null {
  const run = readAll()[mode];
  if (!run || !Array.isArray(run.keys) || typeof run.score !== "number") return null;
  return run;
}

/** そのモードの保存済みゴーストより高ければ置き換える。置き換えたらtrue */
export function saveGhostIfBest(mode: GhostSlot, run: GhostRun): boolean {
  if (run.score <= 0 || run.keys.length === 0) return false;
  const all = readAll();
  if ((all[mode]?.score ?? 0) >= run.score) return false;
  all[mode] = { score: run.score, keys: run.keys };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  return true;
}

// ---- 送受信用の文字列化("cs.h,cs.h,…") ----

export function encodeGhost(run: GhostRun): string {
  return run.keys.map(([t, h]) => `${t}.${h}`).join(",");
}

/** サーバー由来の文字列を厳密に検証して復元する。不正なら null */
export function decodeGhost(text: string, score: number, name?: string): GhostRun | null {
  if (!text || text.length > 12000) return null;
  const keys: [number, number][] = [];
  let lastT = -1;
  for (const part of text.split(",")) {
    const m = /^(\d{1,5})\.(\d{1,4})$/.exec(part);
    if (!m) return null;
    const t = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    if (t < lastT || t > GAME.TIME * 100 + 100 || h > ONLINE.MAX_SCORE) return null;
    lastT = t;
    keys.push([t, h]);
    if (keys.length > ONLINE.GHOST_MAX_KEYS) return null;
  }
  return keys.length > 0 ? { score, keys, name } : null;
}
