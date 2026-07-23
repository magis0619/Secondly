/**
 * ★プッシュ通知(チケット回復リマインド)の差し替えポイント。
 *
 * 運用方針: 許可ダイアログは起動直後ではなく、実際にほんばんチケットを使い切って
 * 補充画面(AdGateScene)を見せる時に初めてスケジュールを試みる(=そのタイミングで
 * ネイティブ側が許可を求める)。起動直後にいきなり許可を求めるのは離脱要因になるため避ける。
 */
import { LocalNotifications } from "@capacitor/local-notifications";
import { currentLang } from "./i18n.ts";

const REMINDER_ID = 1001;
const notifyText = {
  ja: { title: "🎟 CLIMB 30", body: "きょうの ほんばん3回が かいふくしたよ! あそびに来てね" },
  en: { title: "🎟 CLIMB 30", body: "Your 3 free Ranked plays are back today!" },
};

export async function scheduleTicketReminder(): Promise<void> {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== "granted") return; // 拒否されたら以後は求めない(ここでリトライしない)
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    const lang = currentLang() === "ja" ? "ja" : "en";
    await LocalNotifications.schedule({
      notifications: [{ id: REMINDER_ID, schedule: { at: tomorrow }, ...notifyText[lang] }],
    });
  } catch {
    // 非対応環境やスケジュール失敗はゲームを止めない
  }
}

/** ほんばんを開始できた(チケットが足りている)時に呼び、不要になった通知を取り消す */
export async function cancelTicketReminder(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  } catch {
    // 非対応環境は無視
  }
}
