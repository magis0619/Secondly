/**
 * セーブ: localStorageに {v, data} の封筒形式。破損・非対応環境では黙ってデフォルトに落ちる。
 */
import type { WeaponId } from "./config.ts";
import { SHOTGUN_COST, UPGRADE_DEFS } from "./config.ts";

const KEY = "recoilriser.save.v1";

export interface StageRecord {
  bestScore: number;
  bestTimeMs: number;
  stars: [boolean, boolean, boolean]; // クリア / ノーダメ / 回収80%
}

export interface SaveData {
  gems: number;
  stageUnlocked: number;
  stages: Record<number, StageRecord>;
  upgrades: { magazine: number; armor: number };
  shotgunOwned: boolean;
  selectedWeapon: WeaponId;
  playCount: number;
}

const DEFAULTS: SaveData = {
  gems: 0,
  stageUnlocked: 1,
  stages: {},
  upgrades: { magazine: 0, armor: 0 },
  shotgunOwned: false,
  selectedWeapon: "machinegun",
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
  newStars: number;
}

export function persistStageResult(
  stageId: number,
  score: number,
  timeMs: number,
  gemsEarned: number,
  stars: [boolean, boolean, boolean],
  stageCount: number,
): StageOutcome {
  const save = loadSave();
  const rec: StageRecord =
    save.stages[stageId] ?? { bestScore: 0, bestTimeMs: 0, stars: [false, false, false] };
  const newBest = score > rec.bestScore;
  if (newBest) rec.bestScore = score;
  const cleared = stars[0];
  if (cleared && (rec.bestTimeMs === 0 || timeMs < rec.bestTimeMs)) rec.bestTimeMs = timeMs;
  let newStars = 0;
  for (let i = 0; i < 3; i++) {
    if (stars[i] && !rec.stars[i]) {
      rec.stars[i] = true;
      newStars++;
    }
  }
  if (cleared) save.stageUnlocked = Math.max(save.stageUnlocked, Math.min(stageId + 1, stageCount));
  save.stages[stageId] = rec;
  // 失敗時も獲得ジェムの半分は持ち帰り
  save.gems += cleared ? gemsEarned : Math.floor(gemsEarned * 0.5);
  save.playCount += 1;
  store(save);
  return { save, newBest, newStars };
}

export function buyUpgrade(key: "magazine" | "armor"): { ok: boolean; save: SaveData } {
  const save = loadSave();
  const def = UPGRADE_DEFS.find((d) => d.key === key)!;
  const lv = save.upgrades[key];
  if (lv >= def.max) return { ok: false, save };
  const cost = def.costs[lv];
  if (save.gems < cost) return { ok: false, save };
  save.gems -= cost;
  save.upgrades[key] = lv + 1;
  store(save);
  return { ok: true, save };
}

export function buyShotgun(): { ok: boolean; save: SaveData } {
  const save = loadSave();
  if (save.shotgunOwned || save.gems < SHOTGUN_COST) return { ok: false, save };
  save.gems -= SHOTGUN_COST;
  save.shotgunOwned = true;
  save.selectedWeapon = "shotgun";
  store(save);
  return { ok: true, save };
}

export function selectWeapon(w: WeaponId): SaveData {
  const save = loadSave();
  if (w === "shotgun" && !save.shotgunOwned) return save;
  save.selectedWeapon = w;
  store(save);
  return save;
}
