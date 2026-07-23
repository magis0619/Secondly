/**
 * ★プッシュ通知(チケット回復リマインド)の差し替えポイント。
 * Webスタブ: 何もしない(ネイティブ通知はブラウザから安全に出せないため)。
 * iOS化: @capacitor/local-notifications に差し替える(docs/release-checklist.md参照、
 * 通知文の日英コピーも同ファイルに記載)。
 *
 * 運用方針: 許可ダイアログは起動直後ではなく、実際にほんばんチケットを使い切って
 * 補充画面(AdGateScene)を見せる時に初めてスケジュールを試みる(=そのタイミングで
 * ネイティブ側が許可を求める)。起動直後にいきなり許可を求めるのは離脱要因になるため避ける。
 */
export async function scheduleTicketReminder(): Promise<void> {
  // TODO(iOS): LocalNotifications.schedule({ notifications: [{ id: 1001, ... }] })
}

/** ほんばんを開始できた(チケットが足りている)時に呼び、不要になった通知を取り消す */
export async function cancelTicketReminder(): Promise<void> {
  // TODO(iOS): LocalNotifications.cancel({ notifications: [{ id: 1001 }] })
}
