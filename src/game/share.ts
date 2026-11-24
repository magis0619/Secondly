/**
 * ★SNSシェアの差し替えポイント。
 * iOSネイティブでは @capacitor/share の共有シート(各種SNS対応)を使い、
 * Web/シミュレータでは navigator.share → X(Twitter)intent の順でフォールバックする。
 * 共有失敗でアプリを止めないよう例外は握りつぶす。
 */
import { logEvent } from "./analytics.ts";
import { LEGAL } from "./config.ts";
import { t } from "./i18n.ts";

/** リザルトのスコアを共有する。ranked=trueなら世界ランキング挑戦の文面にする */
export async function shareResult(score: number, ranked: boolean): Promise<void> {
  const text = t(ranked ? "shareTextRanked" : "shareTextPractice", { m: score });
  logEvent("share", { mode: ranked ? "ranked" : "practice", score });
  await shareText(text, LEGAL.marketingUrl);
}

async function shareText(text: string, url: string): Promise<void> {
  try {
    // ネイティブ共有シート(iOS)。プラグイン未導入/Web では throw されるのでcatchでフォールバック
    const { Share } = await import("@capacitor/share");
    await Share.share({ text, url });
    return;
  } catch {
    /* フォールバックへ */
  }
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await (navigator as Navigator & { share: (d: { text: string; url: string }) => Promise<void> }).share({ text, url });
      return;
    }
  } catch {
    /* ユーザーキャンセル等。intentも試さず終了 */
    return;
  }
  // 最終フォールバック: X(Twitter)の投稿画面をブラウザで開く
  try {
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank");
  } catch {
    /* 何もできなければ黙って終了 */
  }
}
