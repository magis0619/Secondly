/**
 * セーブ: localStorageに {v, data} の封筒形式。
 * ベスト+ローカルランキングTOP10+オンライン用の匿名ID/名前+課金フラグ。
 */
const KEY = "climb30.save.v1";
const TOP_N = 10;

export interface RankEntry {
  score: number;
  date: string; // ISO
}

export interface SaveData {
  /** 全モード通算の自己ベスト(表示用) */
  best: number;
  /** ほんばん(ランクド)の自己ベスト。世界ランキングへはこれだけを送る */
  rankedBest: number;
  /** 世界へ送信済みのスコア。rankedBest > lastSynced なら未送信分あり(名前変更で0に戻して再送) */
  lastSynced: number;
  ranking: RankEntry[];
  playCount: number;
  /** オンラインランキング用の匿名ID(端末生成) */
  playerId: string;
  playerName: string;
  /** 広告除去を購入済み */
  adFree: boolean;
  /** 開発者支援の累計回数 */
  supporter: number;
}

const DEFAULTS: SaveData = {
  best: 0,
  rankedBest: 0,
  lastSynced: 0,
  ranking: [],
  playCount: 0,
  playerId: "",
  playerName: "",
  adFree: false,
  supporter: 0,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const env = JSON.parse(raw) as { v?: number; data?: Partial<SaveData> };
    if (env.v !== 1 || typeof env.data !== "object" || env.data === null) {
      return structuredClone(DEFAULTS);
    }
    const save: SaveData = { ...structuredClone(DEFAULTS), ...env.data };
    // モード分離前の旧セーブ: 当時のベストは「ほんばん」扱いで引き継ぐ。
    // lastSyncedは0のままなので、次にランキングを開いた時に自動で世界へ送信される。
    if (!("rankedBest" in env.data) && save.best > 0) {
      save.rankedBest = save.best;
    }
    return save;
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
    save.lastSynced = 0; // 新しい名前で世界ランキングへ再送信させる
    store(save);
  }
  return save;
}

/** 世界への送信が成功したスコアを記録する */
export function markSynced(score: number): void {
  const save = loadSave();
  save.lastSynced = Math.max(save.lastSynced, score);
  store(save);
}

export function setAdFree(): SaveData {
  const save = loadSave();
  save.adFree = true;
  store(save);
  return save;
}

export function addSupport(): SaveData {
  const save = loadSave();
  save.supporter += 1;
  store(save);
  return save;
}

export interface ScoreOutcome {
  save: SaveData;
  /** ランキング入りした順位(1始まり)。圏外は-1 */
  rank: number;
  newBest: boolean;
}

export function addScore(score: number, ranked: boolean): ScoreOutcome {
  const save = loadSave();
  const newBest = score > save.best;
  if (newBest) save.best = score;
  if (ranked && score > save.rankedBest) save.rankedBest = score;
  save.playCount += 1;
  save.ranking.push({ score, date: new Date().toISOString() });
  save.ranking.sort((a, b) => b.score - a.score);
  const idx = save.ranking.findIndex((e) => e.score === score);
  save.ranking = save.ranking.slice(0, TOP_N);
  store(save);
  return { save, rank: idx >= 0 && idx < TOP_N ? idx + 1 : -1, newBest };
}
