/**
 * ★広告と課金の差し替えポイント(iOSネイティブと接続するのはこのファイルだけ)。
 *
 * Web/開発ビルドではスタブで動く:
 *  - 広告  … AD_STUB=true → AdGateScene がキャンバス内に擬似広告(5秒)を描く
 *  - 課金  … purchase() が confirm ダイアログで成功扱い(実際の請求なし)
 *
 * iOS製品化のとき(README「広告と課金」参照):
 *  1. AD_STUB を false にして showNativeAd() を AdMob インタースティシャルに実装
 *  2. purchase() / restorePurchases() を StoreKit(または RevenueCat)に実装
 *  3. 価格表示はストアから取得した実価格に置き換える(PRODUCTSのpriceは仮)
 */
import { productLabel, t } from "./i18n.ts";

export type ProductId = "noads" | "tip_s" | "tip_m" | "tip_l";

export interface Product {
  id: ProductId;
  label: string;
  /** 表示用の仮価格。ストア接続後は実価格を表示すること */
  price: string;
  desc: string;
}

export const PRODUCTS: Product[] = [
  { id: "noads", label: "🚫 こうこく じょきょ", price: "¥480", desc: "ほんばん前の こうこくが なくなる(かいきり)" },
  { id: "tip_s", label: "☕ おうえん(小)", price: "¥160", desc: "かいはつしゃに コーヒーを おごる" },
  { id: "tip_m", label: "🍱 おうえん(中)", price: "¥480", desc: "かいはつしゃに おべんとうを おごる" },
  { id: "tip_l", label: "🎉 おうえん(大)", price: "¥1,200", desc: "かいはつしゃが とても よろこぶ" },
];

/** trueの間はシーン内の擬似広告を使う。AdMob接続時にfalseへ */
export const AD_STUB = true;

/** 擬似広告の長さ(秒) */
export const STUB_AD_SEC = 5;

/** ネイティブ広告(インタースティシャル)を表示し、閉じられたらtrue。AD_STUB=falseのときだけ呼ばれる */
export async function showNativeAd(): Promise<boolean> {
  return true; // TODO: iOS化でAdMob実装に差し替え
}

/** 購入。スタブはconfirmで成功扱い。iOS化でStoreKitに差し替え */
export async function purchase(p: Product): Promise<boolean> {
  return window.confirm(t("purchaseConfirm", { label: productLabel(p.id, p.label), price: p.price }));
}

/** 購入のリストア。スタブは空(セーブに残るため不要)。iOS化でStoreKitに差し替え */
export async function restorePurchases(): Promise<ProductId[]> {
  return [];
}

/**
 * ストアレビューを促す(SKStoreReviewController相当)。スタブはNo-op。
 * iOS化: @capacitor-community/in-app-review 等に差し替える(docs/release-checklist.md参照)。
 * ネイティブのレビューAPIは呼び出し回数に自動で上限がかかる(年数回)ため、
 * 呼び出し側の頻度調整(result.tsの節目プレイのみ)と合わせて二重に乱発を防いでいる。
 */
export async function requestReview(): Promise<void> {
  // TODO(iOS): await InAppReview.requestReview()
}
