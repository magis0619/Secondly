/**
 * 2言語対応(日本語/English)。全UI文字列はここの辞書を通す。
 * 言語はセーブに保存(未設定なら端末言語から判定)。
 * 使い方: t("key") / t("key", { n: 3 })({n}を置換)
 */
import { loadSave, setLangPref } from "./save.ts";

export type Lang = "ja" | "en";

let lang: Lang = "ja";

/** 起動時に一度呼ぶ(セーブ→端末言語の順で決定) */
export function initLang(): void {
  const saved = loadSave().lang;
  if (saved === "ja" || saved === "en") {
    lang = saved;
  } else {
    lang = typeof navigator !== "undefined" && navigator.language?.startsWith("ja") ? "ja" : "en";
  }
}

export function currentLang(): Lang {
  return lang;
}

export function toggleLang(): Lang {
  lang = lang === "ja" ? "en" : "ja";
  setLangPref(lang);
  return lang;
}

const JA = {
  tagline: "30びょうで どこまで のぼれる?",
  bestLabel: "ベスト",
  heightLabel: "たかさ",
  practice: "れんしゅう",
  ranked: "🌏 ほんばん",
  ticketsUnlimited: "∞ むせいげんで あそべます",
  ticketsLeft: "🎟 きょう あと {n} かい(こうこくで +{r})",
  rankingBtn: "🏆 ランキング",
  storeBtn: "🛒 ストア",
  skinsBtn: "👕きせかえ",
  langPill: "🌐 EN",
  tapGuide: "つぎの足場がある側をタップ!",
  zoneBanner: "{m}m — {name}へ!",
  feverBanner: "🔥 FEVER! 🔥",
  resultTitle: "けっか",
  newBest: "★ じこベスト こうしん! ★",
  rankIn: "ランキング {n}い!",
  syncSending: "🌏 せかいランキングへ そうしんちゅう…",
  syncOk: "🌏 せかいランキングに そうしんしました!",
  syncFail: "そうしんできませんでした(つぎに じどうで さいそう)",
  again: "もういちど",
  toHome: "ホームへ",
  rankingTitle: "🏆 ランキング",
  tabWorld: "🌏 ほんばん",
  tabLocal: "📱 れんしゅう",
  noRecords: "まだ きろくが ないよ",
  playToRecord: "あそんで きろくを つくろう!",
  offline: "オンライン未接続",
  offlineHint: "README の手順で Firebase を設定してね",
  netError: "つうしんエラー",
  netErrorHint: "でんぱの いいところで もういちど",
  worldEmpty: "まだ だれも いないよ",
  worldEmptyHint: "せかいで さいしょの きろくを つくろう!",
  back: "もどる",
  gateUsedUp: "きょうの むりょうぶんは つかいきった!",
  gateAdInfo: "こうこくを 見ると +{n}かい あそべます",
  gateNone: "🎟 のこり 0 かい",
  gateWatch: "▶ こうこくを 見て +{n}かい",
  gateStore: "🛒 こうこくじょきょ(むせいげん)",
  adLeft: "あと {n} びょう",
  adStubNote1: "開発ビルドのため 擬似広告を表示しています",
  adStubNote2: "(iOS版では ここに実際の広告が入ります)",
  storeTitle: "🛒 ストア",
  supportHeader: "― かいはつしゃを おうえん(なんどでも)―",
  supportCount: "これまでの おうえん: {n}かい ⭐ ありがとう!",
  restore: "こうにゅうを ふっこうする(リストア)",
  restoreDone: "ふっこう しました!",
  restoreNone: "ふっこうする こうにゅうは ありません",
  devPurchaseNote: "※ 開発ビルドでは擬似購入です(実際の請求はありません)",
  privacy: "プライバシーポリシー ↗",
  owned: "✓ ずみ",
  noadsToast: "こうこくを なくしました! なんどでも ほんばんへ!",
  supportToast: "おうえん ありがとう! ⭐",
  skinsTitle: "👕 きせかえ",
  skinsSub: "あそんで あたらしい バンダナを あつめよう",
  equipped: "そうびちゅう!",
  settingsTitle: "⚙ せってい",
  changeName: "✏️ なまえを かえる",
  languageRow: "🌐 ことば: にほんご",
  namePrompt: "なまえ({n}もじまで)",
  version: "バージョン",
  defaultNamePrefix: "ノボラー",
  purchaseConfirm: "【開発ビルドの擬似購入】\n{label} {price}\n実際の請求はありません。購入しますか?",
  confirmQuit: "ホームに もどる?",
  confirmQuitSub: "この きろくは のこりません",
  resume: "つづける",
  rankBig1: "👑 だい1い!!",
  rankBig2: "だい2い!!",
  rankBig3: "だい3い!!",
};

const EN: Record<keyof typeof JA, string> = {
  tagline: "How high can you climb in 30 seconds?",
  bestLabel: "BEST",
  heightLabel: "HEIGHT",
  practice: "Practice",
  ranked: "🌏 Ranked",
  ticketsUnlimited: "∞ Unlimited plays",
  ticketsLeft: "🎟 {n} plays left today (+{r} per ad)",
  rankingBtn: "🏆 Ranking",
  storeBtn: "🛒 Shop",
  skinsBtn: "👕Outfits",
  langPill: "🌐 日本語",
  tapGuide: "Tap the side with the next step!",
  zoneBanner: "{m}m — {name}!",
  feverBanner: "🔥 FEVER! 🔥",
  resultTitle: "RESULT",
  newBest: "★ NEW BEST! ★",
  rankIn: "Rank #{n}!",
  syncSending: "🌏 Submitting to world ranking…",
  syncOk: "🌏 Submitted to world ranking!",
  syncFail: "Couldn't submit (will retry next time)",
  again: "Play Again",
  toHome: "Home",
  rankingTitle: "🏆 Ranking",
  tabWorld: "🌏 Ranked",
  tabLocal: "📱 Practice",
  noRecords: "No records yet",
  playToRecord: "Play to set a record!",
  offline: "Offline",
  offlineHint: "Set up Firebase (see README)",
  netError: "Connection error",
  netErrorHint: "Try again with a better signal",
  worldEmpty: "Nobody here yet",
  worldEmptyHint: "Be the first in the world!",
  back: "Back",
  gateUsedUp: "You've used today's free plays!",
  gateAdInfo: "Watch an ad to get +{n} plays",
  gateNone: "🎟 0 plays left",
  gateWatch: "▶ Watch ad for +{n} plays",
  gateStore: "🛒 Remove ads (unlimited)",
  adLeft: "{n}s left",
  adStubNote1: "Dev build: this is a simulated ad",
  adStubNote2: "(A real ad appears in the iOS build)",
  storeTitle: "🛒 Shop",
  supportHeader: "― Support the developer (repeatable) ―",
  supportCount: "Total support: {n} ⭐ Thank you!",
  restore: "Restore purchases",
  restoreDone: "Restored!",
  restoreNone: "Nothing to restore",
  devPurchaseNote: "* Dev build: purchases are simulated (no charge)",
  privacy: "Privacy Policy ↗",
  owned: "✓ Owned",
  noadsToast: "Ads removed! Unlimited ranked plays!",
  supportToast: "Thanks for your support! ⭐",
  skinsTitle: "👕 Outfits",
  skinsSub: "Play to unlock new bandanas",
  equipped: "Equipped!",
  settingsTitle: "⚙ Settings",
  changeName: "✏️ Change name",
  languageRow: "🌐 Language: English",
  namePrompt: "Name (max {n} chars)",
  version: "Version",
  defaultNamePrefix: "Climber",
  purchaseConfirm: "[Dev build: simulated purchase]\n{label} {price}\nNo real charge. Buy?",
  confirmQuit: "Return home?",
  confirmQuitSub: "This run won't be saved",
  resume: "Keep going",
  rankBig1: "👑 1ST PLACE!!",
  rankBig2: "2ND PLACE!!",
  rankBig3: "3RD PLACE!!",
};

export type TKey = keyof typeof JA;

export function t(key: TKey, params?: Record<string, string | number>): string {
  let s: string = (lang === "ja" ? JA : EN)[key];
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

// ---- データ(config)の表示名 ----

const ZONE_EN: Record<string, string> = {
  ゆうぐれ: "Dusk",
  よぞら: "Night Sky",
  くものうえ: "Above the Clouds",
  うちゅう: "Space",
};

export function zoneName(jaName: string): string {
  return lang === "ja" ? jaName : (ZONE_EN[jaName] ?? jaName);
}

const SKIN_EN: Record<string, { name: string; cond: string }> = {
  pink: { name: "Pink", cond: "From the start" },
  sky: { name: "Sky Blue", cond: "Play 10 times" },
  green: { name: "Green", cond: "Play 30 times" },
  purple: { name: "Purple", cond: "Play 50 times" },
  gold: { name: "Gold", cond: "Best 70m or higher" },
  rainbow: { name: "Rainbow", cond: "Reach space (120m)" },
  star: { name: "⭐White", cond: "Support the developer" },
};

export function skinName(id: string, jaName: string): string {
  return lang === "ja" ? jaName : (SKIN_EN[id]?.name ?? jaName);
}

export function skinCond(id: string, jaCond: string): string {
  return lang === "ja" ? jaCond : (SKIN_EN[id]?.cond ?? jaCond);
}

const PRODUCT_EN: Record<string, { label: string; desc: string }> = {
  noads: { label: "🚫 Remove Ads", desc: "No more ads before Ranked (one-time)" },
  tip_s: { label: "☕ Tip (S)", desc: "Buy the developer a coffee" },
  tip_m: { label: "🍱 Tip (M)", desc: "Buy the developer a lunch" },
  tip_l: { label: "🎉 Tip (L)", desc: "Make the developer's day" },
};

export function productLabel(id: string, jaLabel: string): string {
  return lang === "ja" ? jaLabel : (PRODUCT_EN[id]?.label ?? jaLabel);
}

export function productDesc(id: string, jaDesc: string): string {
  return lang === "ja" ? jaDesc : (PRODUCT_EN[id]?.desc ?? jaDesc);
}
