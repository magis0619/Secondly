import { GRID, TILE_DEFS } from "./config.ts";
import { CHAR_TILES } from "./terrain.ts";

/**
 * ステージ定義。rows は1行=7文字の文字列(記号は terrain.ts の CHAR_TILES):
 *   . 土   _ 空洞   R 岩(Lv1)   S 鉄骨(Lv2)   o 鉱石   G ジェム   L 溶岩   g ガス   C コア
 * parTime はタイムボーナスの基準秒(制限時間ではない)。
 * palette は地層の色(上→下へ深度で補間)。
 */
export interface StageDef {
  id: number;
  name: string;
  parTime: number;
  palette: string[];
  rows: string[];
}

export const STAGES: StageDef[] = [
  {
    id: 1,
    name: "やわらかい地層",
    parTime: 35,
    palette: ["#7a5a3f", "#6b4a35", "#59392c"],
    rows: [
      ".......",
      "...o...",
      ".......",
      "..o....",
      ".......",
      "...R...",
      ".......",
      ".o...o.",
      "._.....",
      "..RR...",
      ".......",
      "....o..",
      ".R...R.",
      ".......",
      "..o.o..",
      "...R...",
      ".......",
      "L......",
      ".......",
      "..o....",
      "......L",
      ".......",
      "..RRR..",
      "._...o.",
      "...G...",
      ".......",
      "...C...",
      "SSSSSSS",
    ],
  },
  {
    id: 2,
    name: "鉄骨とマグマ",
    parTime: 60,
    palette: ["#5a5f4a", "#4a4f42", "#3a4038", "#2e3a38"],
    rows: [
      ".......",
      "..o....",
      ".......",
      "....o..",
      ".R.....",
      ".......",
      ".SSSSS.",
      ".......",
      "..o..o.",
      "L......",
      ".......",
      "...R...",
      ".o.....",
      ".......",
      "SSSSS..",
      "......L",
      "..g.o..",
      ".o.g...",
      ".......",
      "....R..",
      "L......",
      ".......",
      "..SSSSS",
      ".......",
      ".o...o.",
      "...L...",
      ".g.....",
      "....o..",
      ".......",
      "R..R...",
      ".......",
      "......L",
      "..o....",
      ".......",
      ".RRRR..",
      "....._.",
      "..G....",
      ".......",
      "..C....",
      "SSSSSSS",
    ],
  },
  {
    id: 3,
    name: "コアの間",
    parTime: 90,
    palette: ["#4a3f5e", "#3c3452", "#2e2a46", "#231f3a"],
    rows: [
      ".......",
      "...o...",
      ".R.....",
      ".......",
      "....o..",
      ".......",
      "..RRR..",
      "L......",
      ".......",
      ".o..g..",
      ".......",
      "...R...",
      "...R...",
      "...R...",
      "...R...",
      "...R...",
      "...R...",
      "...R...",
      "...R...",
      "...R...",
      "...R...",
      "..o.o..",
      ".......",
      "L......",
      ".L.....",
      "..L....",
      "...L...",
      "....L..",
      ".....L.",
      "....L..",
      "...L...",
      "..L....",
      ".......",
      ".G.g.G.",
      ".g...o.",
      ".......",
      "SSSS...",
      ".......",
      "..o..R.",
      ".......",
      "...SSSS",
      "L......",
      ".......",
      "..RR...",
      ".......",
      "....o..",
      ".R.....",
      "..G....",
      ".......",
      "..SSS..",
      "..S.C..",
      "..SSS..",
      ".......",
      "SSSSSSS",
    ],
  },
];

/**
 * dev用バリデータ。理不尽・詰みを機械的に排除する:
 *  1) 全行が7文字・未知文字なし・コアがちょうど1個
 *  2) 到達可能性: 「無強化(Lv1ダッシュ=岩まで破壊+土の横掘り)」で地表からコアへ
 *     ノーダメージ経路が存在する(ガス・溶岩・鉄骨は通れない扱いのBFS)
 *  3) 溶岩を含む行には安全列(溶岩でない列)が2列以上あり、
 *     直上行の安全列と隣接している(強制被弾の禁止)
 */
export function validateStage(def: StageDef): string[] {
  const errors: string[] = [];
  const cols = GRID.COLS;
  let coreCount = 0;

  def.rows.forEach((line, r) => {
    if (line.length !== cols) errors.push(`row ${r}: 長さが${line.length}(7必要)`);
    for (const ch of line) {
      if (!(ch in CHAR_TILES)) errors.push(`row ${r}: 未知の文字 "${ch}"`);
      if (ch === "C") coreCount++;
    }
  });
  if (coreCount !== 1) errors.push(`コアが${coreCount}個(1個必要)`);
  if (errors.length > 0) return errors; // 形が壊れていたら以降は無意味

  const kind = (c: number, r: number) => CHAR_TILES[def.rows[r][c]];
  // 無強化で通行可能: 土/空洞/鉱石/ジェム/岩(Lv1で壊せる)/コア。鉄骨・溶岩・ガスは不可
  const passable = (c: number, r: number) => {
    const k = kind(c, r);
    return !TILE_DEFS[k].hazard && TILE_DEFS[k].hardness <= 1;
  };

  // BFS(地表=row0の通行可能な全列からスタート)
  const R = def.rows.length;
  const seen = new Set<number>();
  const queue: [number, number][] = [];
  for (let c = 0; c < cols; c++) {
    if (passable(c, 0)) {
      queue.push([c, 0]);
      seen.add(c);
    }
  }
  let reached = false;
  while (queue.length > 0) {
    const [c, r] = queue.shift()!;
    if (kind(c, r) === "core") {
      reached = true;
      break;
    }
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= R) continue;
      const id = nr * cols + nc;
      if (seen.has(id) || !passable(nc, nr)) continue;
      seen.add(id);
      queue.push([nc, nr]);
    }
  }
  if (!reached) errors.push("無強化(Lv1+土横掘り)でコアに到達できない");

  // 溶岩行の安全性
  def.rows.forEach((line, r) => {
    if (!line.includes("L")) return;
    const safe = (row: string) =>
      [...row].map((ch, i) => (ch !== "L" ? i : -1)).filter((i) => i >= 0);
    const cur = safe(line);
    if (cur.length < 2) errors.push(`row ${r}: 溶岩行の安全列が${cur.length}列(2列以上必要)`);
    if (r > 0) {
      const above = new Set(safe(def.rows[r - 1]));
      const linked = cur.some((c) => above.has(c - 1) || above.has(c) || above.has(c + 1));
      if (!linked) errors.push(`row ${r}: 直上行の安全列と隣接していない(強制被弾)`);
    }
  });

  return errors;
}

export function validateAllStages(): void {
  for (const s of STAGES) {
    const errors = validateStage(s);
    for (const e of errors) console.error(`[stage ${s.id} ${s.name}] ${e}`);
  }
}
