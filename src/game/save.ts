/**
 * セーブ: localStorageに {v, data} の封筒形式。破損・非対応環境では黙ってデフォルトに落ちる。
 * コイン・ステージ進行・アップグレードを永続化する(メタ進行の土台)。
 */
import { SCORE, UPGRADE_DEFS } from "./config.ts";

const KEY = "springdrill.save.v1";

export interface StageRecord {
  bestScore: number;
  bestTimeMs: number;
  cleared: boolean;
}

export interface SaveData {
  coins: number;
  /** 挑戦可能な最大ステージid */
  stageUnlocked: number;
  stages: Record<number, StageRecord>;
  upgrades: { chargeSpeed: number; armor: number };
  playCount: number;
}

const DEFAULTS: SaveData = {
  coins: 0,
  stageUnlocked: 1,
  stages: {},
  upgrades: { chargeSpeed: 0, armor: 0 },
  playCount: 0,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const env = JSON.parse(raw) as { v?: number; data?: Partial<SaveData> };
    if (env.v !== 1 || typeof env.data !== "object" || env.data === null) {
      return structuredClone(DEFAULTS);
    }
    return {
      ...structuredClone(DEFAULTS),
      ...env.data,
      upgrades: { ...DEFAULTS.upgrades, ...env.data.upgrades },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function store(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, data }));
  } catch {
    // 保存不可環境では何もしない
  }
}

export interface StageOutcome {
  save: SaveData;
  newBest: boolean;
  coinsAdded: number;
}

export function persistStageResult(
  stageId: number,
  score: number,
  timeMs: number,
  coinsEarned: number,
  cleared: boolean,
  stageCount: number,
): StageOutcome {
  const save = loadSave();
  const rec: StageRecord = save.stages[stageId] ?? { bestScore: 0, bestTimeMs: 0, cleared: false };
  const newBest = score > rec.bestScore;
  if (newBest) rec.bestScore = score;
  if (cleared && (rec.bestTimeMs === 0 || timeMs < rec.bestTimeMs)) rec.bestTimeMs = timeMs;
  if (cleared) {
    rec.cleared = true;
    save.stageUnlocked = Math.max(save.stageUnlocked, Math.min(stageId + 1, stageCount));
  }
  save.stages[stageId] = rec;
  // 失敗時もコインの一部は持ち帰り(ショップ経済を回す)
  const coinsAdded = cleared ? coinsEarned : Math.floor(coinsEarned * SCORE.FAIL_COIN_RATE);
  save.coins += coinsAdded;
  save.playCount += 1;
  store(save);
  return { save, newBest, coinsAdded };
}

/** 購入。成功時はセーブ済みの新しいSaveDataを返す */
export function buyUpgrade(key: "chargeSpeed" | "armor"): { ok: boolean; save: SaveData } {
  const save = loadSave();
  const def = UPGRADE_DEFS.find((d) => d.key === key)!;
  const lv = save.upgrades[key];
  if (lv >= def.max) return { ok: false, save };
  const cost = def.costs[lv];
  if (save.coins < cost) return { ok: false, save };
  save.coins -= cost;
  save.upgrades[key] = lv + 1;
  store(save);
  return { ok: true, save };
}
