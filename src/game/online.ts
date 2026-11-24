/**
 * オンラインランキング(Firebase Firestore REST API直叩き。SDK依存なし)。
 * ONLINE.projectId / apiKey が空の間は無効(すべてnull/falseを返す)。
 * 1プレイヤー=1ドキュメント(docId=playerId)なので、世界ランキングに同一人物は並ばない。
 */
import { ONLINE } from "./config.ts";
import type { GhostRun } from "./ghost.ts";
import { decodeGhost, encodeGhost, loadGhost } from "./ghost.ts";
import { loadSave, markRoomSynced, markSynced } from "./save.ts";

export interface WorldEntry {
  id: string;
  name: string;
  score: number;
}

export function onlineEnabled(): boolean {
  return ONLINE.projectId.length > 0 && ONLINE.apiKey.length > 0;
}

function base(): string {
  return `https://firestore.googleapis.com/v1/projects/${ONLINE.projectId}/databases/(default)/documents`;
}

/** 通信タイムアウト(ms)。固まると無限スピナーになるため必須 */
const TIMEOUT_MS = 8000;

function timeoutSignal(): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), TIMEOUT_MS);
  return c.signal;
}

/** 自己ベストを送信(上書き)。成功したらtrue。失敗は握りつぶす(次回再送) */
export async function submitScore(playerId: string, name: string, score: number, ghost?: string): Promise<boolean> {
  if (!onlineEnabled()) return false;
  const safeScore = Math.max(0, Math.min(Math.floor(score), ONLINE.MAX_SCORE));
  try {
    const res = await fetch(
      `${base()}/${ONLINE.collection}/${encodeURIComponent(playerId)}?key=${ONLINE.apiKey}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        signal: timeoutSignal(),
        body: JSON.stringify({
          fields: {
            name: { stringValue: name.slice(0, ONLINE.NAME_MAX) },
            score: { integerValue: String(safeScore) },
            updatedAt: { timestampValue: new Date().toISOString() },
            // ゴースト(世界1位のリプレイ用)。ベストと同じ回のものがある時だけ同梱する
            ...(ghost ? { ghost: { stringValue: ghost } } : {}),
          },
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export type SyncResult = "sent" | "failed" | "none";

/**
 * ほんばん自己ベストに未送信分があれば世界へ送る。
 * 判定は rankedBest > lastSynced(送信成功時に更新)。名前変更でlastSyncedは0に戻るため、
 * 新しい名前でも自動的に再送される。モード分離前の旧セーブもlastSynced=0で始まるので、
 * ランキング画面を開くだけで過去のベストが送信される。
 */
export async function syncBest(): Promise<SyncResult> {
  const save = loadSave();
  if (!onlineEnabled() || save.rankedBest <= 0 || save.rankedBest <= save.lastSynced) return "none";
  const g = loadGhost("ranked");
  const ghost = g && g.score === save.rankedBest ? encodeGhost(g) : undefined;
  const ok = await submitScore(save.playerId, save.playerName, save.rankedBest, ghost);
  if (ok) markSynced(save.rankedBest);
  return ok ? "sent" : "failed";
}

/**
 * 自分のスコアより上位の人数を集計クエリ(runAggregationQuery)で取得し、順位を返す。
 * TOP_N圏外の人でも自分の順位が分かるようにするため。Sparkプランで使え、
 * 通常クエリより読み取りコストが小さい。無効/失敗はnull
 */
export async function fetchMyRank(score: number): Promise<number | null> {
  if (!onlineEnabled() || score <= 0) return null;
  try {
    const res = await fetch(`${base()}:runAggregationQuery?key=${ONLINE.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeoutSignal(),
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: {
            from: [{ collectionId: ONLINE.collection }],
            where: {
              fieldFilter: {
                field: { fieldPath: "score" },
                op: "GREATER_THAN",
                value: { integerValue: String(Math.floor(score)) },
              },
            },
          },
          aggregations: [{ alias: "higher", count: {} }],
        },
      }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { result?: { aggregateFields?: { higher?: { integerValue?: string } } } }[];
    const higher = rows[0]?.result?.aggregateFields?.higher?.integerValue;
    return higher !== undefined ? parseInt(higher, 10) + 1 : null;
  } catch {
    return null;
  }
}

/** 世界ランキング上位を取得。無効/失敗はnull */
export async function fetchTop(): Promise<WorldEntry[] | null> {
  if (!onlineEnabled()) return null;
  try {
    const res = await fetch(`${base()}:runQuery?key=${ONLINE.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeoutSignal(),
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: ONLINE.collection }],
          // ゴースト文字列(数KB)を一覧のたびに運ばないよう、表示に要る項目だけ取得する
          select: { fields: [{ fieldPath: "name" }, { fieldPath: "score" }] },
          orderBy: [{ field: { fieldPath: "score" }, direction: "DESCENDING" }],
          limit: ONLINE.TOP_N,
        },
      }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      document?: { name: string; fields?: Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number }> };
    }[];
    return rows
      .filter((r) => r.document)
      .map((r) => {
        const d = r.document!;
        const f = d.fields ?? {};
        return {
          id: d.name.split("/").pop() ?? "",
          name: f.name?.stringValue ?? "???",
          score: f.score?.integerValue ? parseInt(f.score.integerValue, 10) : Math.floor(f.score?.doubleValue ?? 0),
        };
      });
  } catch {
    return null;
  }
}

// ==================== ゴースト(世界1位) ====================

let topGhostCache: { at: number; run: GhostRun | null } | null = null;
const GHOST_CACHE_MS = 10 * 60 * 1000;

/**
 * 世界ランキング上位のうち、ゴースト付きの最上位の1本を返す(読み取り1回、10分キャッシュ)。
 * ゴースト導入前のベストにはゴーストが無いので、上位10件から探す。無効/失敗/該当なしはnull
 */
export async function fetchTopGhost(): Promise<GhostRun | null> {
  if (!onlineEnabled()) return null;
  if (topGhostCache && Date.now() - topGhostCache.at < GHOST_CACHE_MS) return topGhostCache.run;
  try {
    const res = await fetch(`${base()}:runQuery?key=${ONLINE.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeoutSignal(),
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: ONLINE.collection }],
          orderBy: [{ field: { fieldPath: "score" }, direction: "DESCENDING" }],
          limit: 10,
        },
      }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      document?: { fields?: Record<string, { stringValue?: string; integerValue?: string }> };
    }[];
    let run: GhostRun | null = null;
    for (const r of rows) {
      const f = r.document?.fields;
      const text = f?.ghost?.stringValue;
      if (!f || !text) continue;
      run = decodeGhost(text, parseInt(f.score?.integerValue ?? "0", 10), f.name?.stringValue);
      if (run) break;
    }
    topGhostCache = { at: Date.now(), run };
    return run;
  } catch {
    return null;
  }
}

// ==================== ともだちルーム ====================
// rooms/{コード}/members/{playerId} に各自のほんばんベストを置く。ルームは最初の参加者が書いた時点で
// 暗黙に生まれ、全員が抜けると消える。コードを知っている人だけが読める(一覧APIは開けない)。

export interface RoomMember {
  id: string;
  name: string;
  score: number;
}

/** 紛らわしい文字(I,L,O,0,1)を除いた32文字 */
const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newRoomCode(): string {
  let s = "";
  for (let i = 0; i < ONLINE.ROOM_CODE_LEN; i++) {
    s += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return s;
}

/** 入力を大文字化・空白除去して検証する。不正ならnull */
export function normalizeRoomCode(input: string): string | null {
  const code = input.replace(/[\s\-]/g, "").toUpperCase();
  if (code.length !== ONLINE.ROOM_CODE_LEN) return null;
  for (const ch of code) if (!ROOM_ALPHABET.includes(ch)) return null;
  return code;
}

function roomPath(code: string): string {
  return `${base()}/rooms/${encodeURIComponent(code)}`;
}

/** ルームへ自分のベストを書く(score=0でも名簿には載る)。成功でtrue */
export async function roomSubmit(code: string, playerId: string, name: string, score: number): Promise<boolean> {
  if (!onlineEnabled()) return false;
  const safeScore = Math.max(0, Math.min(Math.floor(score), ONLINE.MAX_SCORE));
  try {
    const res = await fetch(`${roomPath(code)}/members/${encodeURIComponent(playerId)}?key=${ONLINE.apiKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      signal: timeoutSignal(),
      body: JSON.stringify({
        fields: {
          name: { stringValue: name.slice(0, ONLINE.NAME_MAX) },
          score: { integerValue: String(safeScore) },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** ルームの全員をスコア降順で取得。無効/失敗はnull、存在しないルームは空配列 */
export async function roomFetch(code: string): Promise<RoomMember[] | null> {
  if (!onlineEnabled()) return null;
  try {
    const res = await fetch(`${roomPath(code)}:runQuery?key=${ONLINE.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeoutSignal(),
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "members" }],
          orderBy: [{ field: { fieldPath: "score" }, direction: "DESCENDING" }],
          limit: ONLINE.ROOM_MAX,
        },
      }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      document?: { name: string; fields?: Record<string, { stringValue?: string; integerValue?: string }> };
    }[];
    return rows
      .filter((r) => r.document)
      .map((r) => {
        const d = r.document!;
        const f = d.fields ?? {};
        return {
          id: d.name.split("/").pop() ?? "",
          name: f.name?.stringValue ?? "???",
          score: f.score?.integerValue ? parseInt(f.score.integerValue, 10) : 0,
        };
      });
  } catch {
    return null;
  }
}

/** ルームから抜ける(自分の名簿を消す)。失敗しても端末側は抜けた扱いにする */
export async function roomLeave(code: string, playerId: string): Promise<boolean> {
  if (!onlineEnabled()) return false;
  try {
    const res = await fetch(`${roomPath(code)}/members/${encodeURIComponent(playerId)}?key=${ONLINE.apiKey}`, {
      method: "DELETE",
      signal: timeoutSignal(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 参加中ルームへ最新の自己ベスト/名前を送る。内容が前回と同じなら何もしない(書き込み節約)。
 * force=trueなら同じ内容でも送る(参加直後の名簿登録用)。ルーム未参加/無効はfalse
 */
export async function syncRoom(force = false): Promise<boolean> {
  const save = loadSave();
  if (!onlineEnabled() || !save.room) return false;
  const key = `${save.room}|${save.playerName}|${save.rankedBest}`;
  if (!force && save.roomSynced === key) return true;
  const ok = await roomSubmit(save.room, save.playerId, save.playerName, save.rankedBest);
  if (ok) markRoomSynced(key);
  return ok;
}
