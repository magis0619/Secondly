/**
 * オンラインランキング(Firebase Firestore REST API直叩き。SDK依存なし)。
 * ONLINE.projectId / apiKey が空の間は無効(すべてnull/falseを返す)。
 * 1プレイヤー=1ドキュメント(docId=playerId)なので、世界ランキングに同一人物は並ばない。
 */
import { ONLINE } from "./config.ts";

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
export async function submitScore(playerId: string, name: string, score: number): Promise<boolean> {
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
          },
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
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
