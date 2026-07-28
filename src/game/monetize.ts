/**
 * ★広告と課金の差し替えポイント(iOSネイティブと接続するのはこのファイルだけ)。
 *
 * 広告  … AdMobインタースティシャル(showNativeAd)
 * 課金  … RevenueCat経由のStoreKit(purchase/restorePurchases)
 * Web/シミュレータではネイティブAPI呼び出しがcatchされ、広告は無音スキップ・課金は失敗扱いになる。
 *
 * 価格表示はストアから取得した実価格に置き換えること(PRODUCTSのpriceは仮、docs/release-checklist.md参照)。
 */
import { AdMob } from "@capacitor-community/admob";
import { InAppReview } from "@capacitor-community/in-app-review";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

export type ProductId = "noads" | "tip_s" | "tip_m" | "tip_l";

export interface Product {
  id: ProductId;
  label: string;
  /** 表示用の仮価格。ストア接続後は実価格を表示すること */
  price: string;
  desc: string;
}

export const PRODUCTS: Product[] = [
  { id: "noads", label: "🚫 こうこく じょきょ", price: "¥500", desc: "ほんばん前の こうこくが なくなる(かいきり)" },
  { id: "tip_s", label: "☕ おうえん(小)", price: "¥200", desc: "かいはつしゃに コーヒーを おごる" },
  { id: "tip_m", label: "🍱 おうえん(中)", price: "¥500", desc: "かいはつしゃに おべんとうを おごる" },
  { id: "tip_l", label: "🎉 おうえん(大)", price: "¥1,200", desc: "かいはつしゃが とても よろこぶ" },
];

/** trueの間はシーン内の擬似広告を使う。AdMob接続時にfalseへ */
export const AD_STUB = false;

/** 擬似広告の長さ(秒) */
export const STUB_AD_SEC = 5;

const INTERSTITIAL_ID = "ca-app-pub-6400037812686003/9792711609";
// テスト中はGoogle公式のテストID: ca-app-pub-3940256099942544/4411468910

let adInit = false;
/**
 * ATT許可ダイアログ→AdMob初期化、の順で1回だけ実行する(冪等)。
 * Appleの審査要件により、トラッキング可能なデータ収集(=AdMob初期化)より前にATTを聞く必要がある。
 * main.tsから起動直後に一度呼ぶ(審査で「ATTダイアログが見つからない」とならないよう、
 * 広告を出す深い画面まで待たずに早期発火させる)。showNativeAd()からも安全網として呼ぶため冪等にしてある
 */
export async function ensureAdInit(): Promise<void> {
  if (adInit) return;
  adInit = true;
  // ATT(トラッキング許可)ダイアログ。拒否されても非パーソナライズ広告が出るだけ
  try { await AdMob.requestTrackingAuthorization(); } catch { /* iOS以外 */ }
  await AdMob.initialize();
}

/** ネイティブ広告(インタースティシャル)を表示し、閉じられたらtrue。AD_STUB=falseのときだけ呼ばれる */
export async function showNativeAd(): Promise<boolean> {
  try {
    await ensureAdInit();
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID });
    await AdMob.showInterstitial();
    return true;
  } catch (e) {
    console.warn("[monetize] showNativeAd failed", e); // Xcodeコンソールで原因を確認する用
    return true; // 広告の読み込み失敗でゲームを止めない(そのまま開始)
  }
}

const RC_API_KEY = "appl_vKMjiIFxJBdxygAWoSgiGvbESHK"; // RevenueCatのPublic APIキー(iOS)

let rcInit = false;
async function ensureRcInit(): Promise<void> {
  if (rcInit) return;
  rcInit = true;
  await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
  await Purchases.configure({ apiKey: RC_API_KEY });
}

function storeId(id: ProductId): string {
  return `com.yamada.climb30.${id}`;
}

/** 購入。スタブはconfirmで成功扱い。iOS化でStoreKitに差し替え */
export async function purchase(p: Product): Promise<boolean> {
  try {
    await ensureRcInit();
    const { products } = await Purchases.getProducts({ productIdentifiers: [storeId(p.id)] });
    if (products.length === 0) return false;
    await Purchases.purchaseStoreProduct({ product: products[0] });
    return true;
  } catch {
    return false; // キャンセル含む
  }
}

/** 購入のリストア。スタブは空(セーブに残るため不要)。iOS化でStoreKitに差し替え */
export async function restorePurchases(): Promise<ProductId[]> {
  try {
    await ensureRcInit();
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo.entitlements.active["noads"] ? ["noads"] : [];
  } catch {
    return [];
  }
}

/**
 * ストアレビューを促す(SKStoreReviewController相当)。
 * ネイティブのレビューAPI自体にも呼び出し回数の上限がかかる(年数回)ため、
 * 呼び出し側の頻度調整(result.tsの節目プレイのみ)と合わせて二重に乱発を防いでいる。
 */
export async function requestReview(): Promise<void> {
  try {
    await InAppReview.requestReview();
  } catch {
    // 非対応環境は無視
  }
}
