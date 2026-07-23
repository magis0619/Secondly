/**
 * ★分析(アナリティクス)の差し替えポイント。
 * 開発/Webビルド: consoleと window.__analytics(直近100件、検証用)に記録するだけ。
 * iOS製品化: ここを @capacitor-firebase/analytics に差し替える(docs/release-checklist.md)。
 *
 * 計測イベント一覧(README参照):
 *  app_open / play_start{mode} / play_end{mode,score,maxCombo,fever} / fever_start /
 *  ad_shown / ticket_refill / purchase{id} / restore / ranking_view{tab} /
 *  name_change / skin_select{id} / chara_select{id} / lang_change{lang}
 */
export type AnalyticsParams = Record<string, string | number | boolean>;

interface Entry {
  name: string;
  params?: AnalyticsParams;
  at: number;
}

const buffer: Entry[] = [];

export function logEvent(name: string, params?: AnalyticsParams): void {
  try {
    // TODO(iOS): FirebaseAnalytics.logEvent({ name, params }) に差し替え
    if (import.meta.env.DEV) {
      buffer.push({ name, params, at: Date.now() });
      if (buffer.length > 100) buffer.shift();
      (window as unknown as Record<string, unknown>).__analytics = buffer;
      console.debug("[analytics]", name, params ?? {});
    }
  } catch {
    // 計測失敗でゲームを止めない
  }
}
