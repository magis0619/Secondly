/**
 * セーブ: localStorageに {v, data} の封筒形式。
 * ベスト+ローカルランキングTOP10+オンライン用の匿名ID/名前。
 */
const KEY = "climb30.save.v1";
const TOP_N = 10;

export interface RankEntry {
  score: number;
  date: string; // ISO
}

export interface SaveData {
  best: number;
  ranking: RankEntry[];
  playCount: number;
  /** オンラインランキング用の匿名ID(端末生成) */
  playerId: string;
  playerName: string;
  /** ベスト送信が未達(オフライン等)なら次回再送 */
  pendingSync: boolean;
}

const DEFAULTS: SaveData = {
  best: 0,
  ranking: [],
  playCount: 0,
  playerId: "",
  playerName: "",
  pendingSync: false,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const env = JSON.parse(raw) as { v?: number; data?: Partial<SaveData> };
    if (env.v !== 1 || typeof env.data !== "object" || env.data === null) {
      return structuredClone(DEFAULTS);
    }
    return { ...structuredClone(DEFAULTS), ...env.data };
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

/** 初回起動時に匿名IDと名前を用意する(既にあればそのまま返す) */
export function ensureIdentity(): SaveData {
  const save = loadSave();
  let changed = false;
  if (!save.playerId) {
    save.playerId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    changed = true;
  }
  if (!save.playerName) {
    save.playerName = `ノボラー${1000 + Math.floor(Math.random() * 9000)}`;
    changed = true;
  }
  if (changed) store(save);
  return save;
}

export function setPlayerName(name: string): SaveData {
  const save = loadSave();
  const trimmed = name.trim().slice(0, 12);
  if (trimmed.length > 0) {
    save.playerName = trimmed;
    save.pendingSync = true; // 名前変更もオンラインへ反映したい
    store(save);
  }
  return save;
}

export function setPendingSync(v: boolean): void {
  const save = loadSave();
  save.pendingSync = v;
  store(save);
}

export interface ScoreOutcome {
  save: SaveData;
  /** ランキング入りした順位(1始まり)。圏外は-1 */
  rank: number;
  newBest: boolean;
}

export function addScore(score: number): ScoreOutcome {
  const save = loadSave();
  const newBest = score > save.best;
  if (newBest) save.best = score;
  save.playCount += 1;
  save.ranking.push({ score, date: new Date().toISOString() });
  save.ranking.sort((a, b) => b.score - a.score);
  const idx = save.ranking.findIndex((e) => e.score === score);
  save.ranking = save.ranking.slice(0, TOP_N);
  store(save);
  return { save, rank: idx >= 0 && idx < TOP_N ? idx + 1 : -1, newBest };
}
