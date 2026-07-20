/**
 * ベストスコアの保存。localStorageに {v, data} の封筒形式で保存し、
 * 破損・非対応環境(プライベートモード等)では黙ってデフォルトに落ちる。
 */
const KEY = "secondly.best.v1";

export interface SaveData {
  bestScore: number;
  bestCombo: number;
  cleared: boolean;
  playCount: number;
}

const DEFAULTS: SaveData = { bestScore: 0, bestCombo: 0, cleared: false, playCount: 0 };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const env = JSON.parse(raw) as { v?: number; data?: Partial<SaveData> };
    if (env.v !== 1 || typeof env.data !== "object" || env.data === null) return { ...DEFAULTS };
    return { ...DEFAULTS, ...env.data };
  } catch {
    return { ...DEFAULTS };
  }
}

function store(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, data }));
  } catch {
    // 保存不可環境では何もしない
  }
}

export interface ResultOutcome {
  save: SaveData;
  newBest: boolean;
}

export function persistResult(score: number, maxCombo: number, cleared: boolean): ResultOutcome {
  const save = loadSave();
  const newBest = score > save.bestScore;
  if (newBest) save.bestScore = score;
  if (maxCombo > save.bestCombo) save.bestCombo = maxCombo;
  if (cleared) save.cleared = true;
  save.playCount += 1;
  store(save);
  return { save, newBest };
}
