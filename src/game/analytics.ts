/**
 * ★分析(アナリティクス)の差し替えポイント。
 * 開発ビルド: consoleと window.__analytics(直近100件、検証用)に記録。
 * 本番: Firebase Analyticsにも送信する(iOSはGoogleService-Info.plist必須)。
 *
 * 計測イベント一覧(README参照):
 *  [基本] app_open / screen_view{screen} / js_error{msg}
 *  [プレイ] play_start{mode} / play_end{mode,score,maxCombo,fever,misses,sec,zone} /
 *          play_quit{mode,score,sec} / fever_start
 *  [オンボーディング] lang_pick{lang} / howto_show{source} / howto_page{n} / howto_done{lastPage}
 *  [広告] adgate_view / ad_start / ad_result{ok} / adgate_exit{to} / ad_shown /
 *        ticket_refill{n} / ticket_refund
 *  [課金] product_tap{id} / purchase_result{id,ok} / purchase{id} / restore
 *  [継続] streak_checkin{streak,bonus} / streak_view
 *  [ゴースト] play_start{ghost=設定} / ghost_result{src,win} / ghost_mode{mode}
 *  [ともだち] room_create / room_join{ok,why} / room_invite / room_leave
 *  [その他] ranking_view{tab} / name_change / skin_select{id} / chara_select{id} /
 *          lang_change{lang} / bgm_toggle / sfx_toggle / review_prompt / share{mode,score}
 *
 * 離脱分析の考え方: 画面遷移は screen_view、ファネルの各段は専用イベントで取る。
 * 「開始したが完了しなかった」を測れるよう、開始側イベント(ad_start/product_tap/play_start)と
 * 結果側イベント(ad_result/purchase_result/play_end・play_quit)を必ず対で送ること。
 */
import { FirebaseAnalytics } from "@capacitor-firebase/analytics";

export type AnalyticsParams = Record<string, string | number | boolean>;

interface Entry {
  name: string;
  params?: AnalyticsParams;
  at: number;
}

const buffer: Entry[] = [];

export function logEvent(name: string, params?: AnalyticsParams): void {
  try {
    if (import.meta.env.DEV) {
      buffer.push({ name, params, at: Date.now() });
      if (buffer.length > 100) buffer.shift();
      (window as unknown as Record<string, unknown>).__analytics = buffer;
      console.debug("[analytics]", name, params ?? {});
    }
    void FirebaseAnalytics.logEvent({ name, params: params ?? {} }).catch(() => {});
  } catch {
    // 計測失敗でゲームを止めない
  }
}

let lastScreen = "";

/**
 * 画面表示を記録する(離脱分析の土台)。各Sceneのenter()から呼ぶ。
 * Firebaseの経路探索/目標到達プロセスは画面イベントを前提にしているため、
 * キャンバス1枚で全画面を描くこのゲームでは手動で送る必要がある。
 * 同じ画面の連続送信は抑制する(再描画やモーダル開閉での二重計上を防ぐ)。
 */
export function logScreen(screen: string): void {
  if (screen === lastScreen) return;
  lastScreen = screen;
  logEvent("screen_view", { screen });
  try {
    void FirebaseAnalytics.setCurrentScreen({ screenName: screen }).catch(() => {});
  } catch {
    // 計測失敗でゲームを止めない
  }
}
