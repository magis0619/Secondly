# CLIMB 30 — App Store リリースチェックリスト

このリポジトリで済んでいるもの / **Mac + Xcode でやる残作業** を上から順に潰していく手順書。
所要目安: アカウント類の審査待ちを除けば実作業 1〜2 日。

## 済んでいるもの(このリポジトリ内)

- ゲーム本体(れんしゅう/ほんばん、オンラインランキング、ストア画面、リストア導線)
- 広告・課金の**差し替えポイント集約**(`src/game/monetize.ts` だけ触ればよい)
- アプリアイコン `assets/appstore/icon-1024.png` / 起動画面 `assets/appstore/splash-2732.png`
- プライバシーポリシー雛形 `docs/privacy-policy.md` / ストア掲載文の下書き `docs/store-listing.md`
- セーフエリア対応・電話や通知での自動ポーズ・オフライン時のフォールバック
- BGM/こうかおんのオン・オフ設定、触覚フィードバック、チケット切れ通知の差し替えポイント
  (`src/game/haptics.ts` / `src/game/notify.ts`)、レビュー依頼の接続口(`monetize.ts`)

## 全体の流れ

```
1 Apple Developer登録 → 2 Bundle ID決定 → 3 Xcodeプロジェクト生成
→ 4 アイコン/起動画面 → 5 AdMob接続 → 6 課金接続(RevenueCat)
→ 7 プライバシーポリシー公開 → 8 App Store Connect登録 → 9 TestFlight → 10 審査提出
```

---

## 1. Apple Developer Program(未加入なら)

- <https://developer.apple.com/programs/> から加入(**年 ¥12,980 前後**)。個人でOK
- 有料アプリ/App内課金を出すため、App Store Connect の **「契約/税/口座」で有料Appの契約に同意し、銀行口座と税務情報(W-8BEN等)を登録**しておく。ここが未完だと課金のテストすらできないので最初にやる

## 2. Bundle ID の決定

1. `capacitor.config.ts` の `appId` を自分のものに変更(例: `com.yamada.climb30`)。**後から変更不可**
2. <https://developer.apple.com/account/resources/identifiers> で同じ ID の App ID を作成(Capabilities は不要。In-App Purchase は自動で有効)

## 3. Xcode プロジェクト生成(Mac 上)

```bash
git clone <このリポジトリ> && cd Secondly && git checkout claude/ios-game-app-dev-h425s9
npm install
npm i @capacitor/core @capacitor/cli @capacitor/ios
CAPACITOR=1 npm run build
npx cap add ios && npx cap sync ios
npx cap open ios
```

Xcode で: Signing & Capabilities → 自分の Team を選択 / Deployment Info → **Portrait のみ** / General → Version `1.0.0`, Build `1`。

## 4. アイコンと起動画面

- **アイコン**: Xcode で `App/Assets.xcassets/AppIcon` を開き、1024pt スロットに `assets/appstore/icon-1024.png` をドラッグ(Xcode 14+ は 1024 一枚で全サイズ生成される。角丸は自動)
- **起動画面**: `Assets.xcassets` に `assets/appstore/splash-2732.png` を「Splash」等の名前で追加 → `LaunchScreen.storyboard` の ImageView に割り当て(Content Mode: Aspect Fill)。背景色は `#472a66`

## 5. AdMob(ほんばん前のインタースティシャル広告)

### 5-1. AdMob 側

1. <https://admob.google.com/> でアカウント作成 → 「アプリを追加」(まだストア未公開なので「アプリストアに掲載していない」を選ぶ)
2. **アプリID**(`ca-app-pub-xxxxxxxx~yyyyyyy`)を控える
3. 広告ユニットを作成 → **リワード(推奨)またはインタースティシャル** → ユニットID(`ca-app-pub-xxxxxxxx/zzzzzzz`)を控える
   - ゲーム内は「広告を見るとほんばん+3回」という**報酬型**の導線なので、リワード広告が意味的に正しい(`AdMob.prepareRewardVideoAd`/`showRewardVideoAd` を使う。視聴完了イベントで `true` を返すようにする)

### 5-2. プラグイン導入(Mac 上)

```bash
npm i @capacitor-community/admob
npx cap sync ios
```

`ios/App/App/Info.plist` に追記:

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-xxxxxxxx~yyyyyyy</string>
<key>NSUserTrackingUsageDescription</key>
<string>広告の最適化のために使用します。許可しなくてもプレイできます。</string>
```

(SKAdNetworkItems はプラグインの README 記載のリストをそのまま貼る)

### 5-3. `src/game/monetize.ts` の差し替え(コピペ用)

```ts
import { AdMob } from "@capacitor-community/admob";

export const AD_STUB = false; // ← falseにするとAdGateSceneがshowNativeAd()を使う

const INTERSTITIAL_ID = "ca-app-pub-xxxxxxxx/zzzzzzz"; // ←自分のユニットID
// テスト中はGoogle公式のテストID: ca-app-pub-3940256099942544/4411468910

let adInit = false;
async function ensureAdInit(): Promise<void> {
  if (adInit) return;
  adInit = true;
  await AdMob.initialize();
  // ATT(トラッキング許可)ダイアログ。拒否されても非パーソナライズ広告が出るだけ
  try { await AdMob.requestTrackingAuthorization(); } catch { /* iOS以外 */ }
}

export async function showNativeAd(): Promise<boolean> {
  try {
    await ensureAdInit();
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID });
    await AdMob.showInterstitial();
    return true;
  } catch {
    return true; // 広告の読み込み失敗でゲームを止めない(そのまま開始)
  }
}
```

> プラグインのAPI名はバージョンで変わることがある。動かなければ
> <https://github.com/capacitor-community/admob> の README の最新例に合わせる。

### 5-4. 確認

- 実機で ほんばん → 「広告を見てスタート」→ **テストID** の広告が出る → 閉じるとカウントダウンが始まる
- **提出時に本番ユニットIDへ差し替えたか必ず確認**(テストIDのまま公開すると収益ゼロ+規約違反)

## 6. App内課金(RevenueCat 経由を推奨)

### 6-1. App Store Connect で商品登録(4つ)

「マイアプリ → App → 収益化 → App内課金」で作成:

| 商品ID(推奨) | 種類 | 参考価格 | 表示名 |
|---|---|---|---|
| `<bundleId>.noads` | **非消耗型** | ¥500段階 | こうこくじょきょ |
| `<bundleId>.tip_s` | **消耗型** | ¥200段階 | おうえん(小) |
| `<bundleId>.tip_m` | **消耗型** | ¥500段階 | おうえん(中) |
| `<bundleId>.tip_l` | **消耗型** | ¥1,200段階 | おうえん(大) |

各商品に日本語の表示名と説明を入れ、審査用スクショ(ストア画面のスクショでよい)を添付。

### 6-2. RevenueCat セットアップ

1. <https://www.revenuecat.com/>(無料枠で十分)→ プロジェクト作成 → iOSアプリ追加(Bundle ID)→ App Store Connect の App用共有シークレット/APIキーを接続
2. 4商品を Products に取り込み、Entitlement `noads` に `.noads` を紐づけ
3. プラグイン導入: `npm i @revenuecat/purchases-capacitor && npx cap sync ios`

### 6-3. `src/game/monetize.ts` の purchase/restore 差し替え(コピペ用)

```ts
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

const RC_API_KEY = "appl_xxxxxxxx"; // RevenueCatのPublic APIキー(iOS)

let rcInit = false;
async function ensureRcInit(): Promise<void> {
  if (rcInit) return;
  rcInit = true;
  await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
  await Purchases.configure({ apiKey: RC_API_KEY });
}

function storeId(id: ProductId): string {
  return `com.yamada.climb30.${id}`; // ←自分のBundle IDに合わせる
}

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

export async function restorePurchases(): Promise<ProductId[]> {
  try {
    await ensureRcInit();
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo.entitlements.active["noads"] ? ["noads"] : [];
  } catch {
    return [];
  }
}
```

### 6-4. 確認(Sandbox)

- App Store Connect → 「ユーザとアクセス → Sandboxテスター」でテストアカウント作成
- 実機の設定 → App Store → サンドボックスアカウント にログインして購入テスト
- 確認項目: noads購入→ほんばんが広告なし / アプリ削除→再インストール→**リストアでnoads復活** / tip購入→⭐とお礼表示

## 6.5 分析(Firebase Analytics)と表示名のローカライズ

### 分析の接続(任意だが推奨)

ゲーム内は `src/game/analytics.ts` の `logEvent()` に計測が集約済み(イベント一覧はファイル冒頭)。
開発ビルドではconsole出力のみ。iOSで実際に収集するには:

```bash
npm i @capacitor-firebase/analytics firebase && npx cap sync ios
```

Firebaseコンソールで既存プロジェクト(climb30-*)にiOSアプリを追加し、`GoogleService-Info.plist` を
Xcodeの `App/App/` に入れる。`analytics.ts` の `logEvent` を差し替え:

```ts
import { FirebaseAnalytics } from "@capacitor-firebase/analytics";

export function logEvent(name: string, params?: AnalyticsParams): void {
  void FirebaseAnalytics.logEvent({ name, params: params ?? {} }).catch(() => {});
}
```

### 表示名のローカライズ(のぼれ！30秒 / Climb 30)

Xcodeで: プロジェクト → Info → Localizations に **Japanese** を追加 →
`InfoPlist.strings` を作成しローカライズを有効化して、それぞれに:

```
// InfoPlist.strings (Japanese)
"CFBundleDisplayName" = "のぼれ！30秒";
// InfoPlist.strings (English)
"CFBundleDisplayName" = "Climb 30";
```

App Store Connect側も「日本語」「英語(米国)」の2ロケールで名前・説明を登録する(`docs/store-listing.md`)。

## 7. プライバシーポリシー(必須)

1. `docs/privacy-policy.md` の `【】` 箇所(連絡先メール等)を埋める
2. 公開する。一番簡単なのは GitHub Pages:
   - 新規公開リポジトリ(例 `climb30-privacy`)に `index.md` として置く → Settings → Pages で公開
3. URL を以下 3 箇所に設定:
   - `src/game/config.ts` の `LEGAL.privacyUrl`(ストア画面にリンクが出る)
   - App Store Connect のアプリ情報「プライバシーポリシーURL」
   - AdMob のアプリ設定

### App Store Connect「Appのプライバシー」申告表の書き方

| 収集データ | 該当 | 用途 | 紐づけ | トラッキング |
|---|---|---|---|---|
| 識別子 > ユーザID | 匿名プレイヤーID | アプリの機能(ランキング) | いいえ | いいえ |
| ユーザコンテンツ > その他 | ニックネーム | アプリの機能 | いいえ | いいえ |
| 識別子 > デバイスID | 広告識別子(IDFA) | 広告 | いいえ | **はい**(ATT許可時) |
| 使用状況データ | 広告SDKの計測 | 広告 | いいえ | はい |
| 使用状況データ > 製品の操作 | Firebase Analytics(プレイ回数等) | 分析 | いいえ | いいえ |

(AdMobのパーソナライズ広告を使わない設定にするならトラッキング「いいえ」+ATT省略も可)

## 8. App Store Connect でアプリ登録

- マイApp → 「+」→ 新規App(プラットフォーム iOS / Bundle ID / SKU は任意文字列)
- 名前・サブタイトル・説明・キーワード → **`docs/store-listing.md` からコピペ**
- カテゴリ: ゲーム > カジュアル / 年齢: 質問に全て「なし」で **4+**
- スクリーンショット(必須は2サイズ):
  - 6.9インチ(1320×2868)と 6.5インチ(1284×2778 または 1242×2688)
  - シミュレータ(iPhone 16 Pro Max 等)で ホーム/プレイ中/ランキング/リザルト を `Cmd+S` で撮るのが楽

## 9. TestFlight

- Xcode: Product → Archive → Distribute App → App Store Connect にアップロード
- 処理完了後、自分の実機の TestFlight アプリでインストールして最終確認
  (広告テストID→本番ID差し替え、課金Sandbox、ランキング送信、ダイナミックアイランド)

## 10. 審査提出

審査メモ(App Review情報)に書いておくとスムーズ:

> ・「ほんばん」モード開始前にインタースティシャル広告が表示されます(広告除去IAPあり)
> ・「おうえん」課金は開発者への任意の支援(チップ)で、追加機能はありません
> ・ランキングのニックネームは端末ローカルで設定され、不適切な場合は開発者が
>  Firebase コンソールから削除できます(連絡先: プライバシーポリシー記載)

### よくあるリジェクトと対策(このプロジェクト用)

| リジェクト | 対策 |
|---|---|
| **擬似広告/擬似購入のまま提出**(Guideline 2.3) | `AD_STUB=false` にし、purchase/restore を本実装へ差し替えたか確認。「開発ビルドでは擬似購入」の注記はスタブ時のみ表示なので、差し替え後は自然に消える表現になっているか確認 |
| リストアがない(3.1.1) | 実装済み(ストア画面)。RevenueCat接続を忘れずに |
| プライバシーポリシーURL切れ(5.1.1) | 提出直前にURLを開いて確認 |
| ATT の説明不足(5.1.2) | `NSUserTrackingUsageDescription` を必ず入れる。パーソナライズ広告を使わないなら ATT 自体を省略しトラッキング「なし」で申告 |
| チップ課金の誤解(3.2.1) | 審査メモに「追加機能のない任意の支援」と明記。アプリ内の説明文もその通りになっている |

## 11. 触覚フィードバック(Haptics)

`src/game/haptics.ts` に `hapticLight/Medium/Heavy` を集約済み(Webは`navigator.vibrate`)。

```bash
npm i @capacitor/haptics && npx cap sync ios
```

```ts
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export function hapticLight(): void { void Haptics.impact({ style: ImpactStyle.Light }); }
export function hapticMedium(): void { void Haptics.impact({ style: ImpactStyle.Medium }); }
export function hapticHeavy(): void { void Haptics.impact({ style: ImpactStyle.Heavy }); }
```

## 12. プッシュ通知(チケット回復リマインド)

`src/game/notify.ts` の `scheduleTicketReminder()` / `cancelTicketReminder()` が差し替えポイント。

```bash
npm i @capacitor/local-notifications && npx cap sync ios
```

```ts
import { LocalNotifications } from "@capacitor/local-notifications";

const REMINDER_ID = 1001;
const notifyText = {
  ja: { title: "🎟 CLIMB 30", body: "きょうの ほんばん3回が かいふくしたよ! あそびに来てね" },
  en: { title: "🎟 CLIMB 30", body: "Your 3 free Ranked plays are back today!" },
};

export async function scheduleTicketReminder(): Promise<void> {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== "granted") return; // 拒否されたら以後は求めない(ここでリトライしない)
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);
  const lang = currentLang() === "ja" ? "ja" : "en"; // src/game/i18n.ts
  await LocalNotifications.schedule({
    notifications: [{ id: REMINDER_ID, schedule: { at: tomorrow }, ...notifyText[lang] }],
  });
}

export async function cancelTicketReminder(): Promise<void> {
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
}
```

**重要**: 許可ダイアログは起動直後には出さない設計にしてある(`AdGateScene.enter()` = 実際にチケットが
切れて補充画面を見せる瞬間にだけ呼ばれる)。この順序を崩さないこと(離脱率が上がる)。

## 13. App Store レビュー依頼

`src/game/monetize.ts` の `requestReview()` が差し替えポイント。5回目・25回目・60回目の自己ベスト更新時
(`result.ts`)にだけ呼ばれる設計。ネイティブAPI自体にも年間の呼び出し上限があるため、
呼び出し側の頻度調整と合わせて二重に乱発防止している。

```bash
npm i @capacitor-community/in-app-review && npx cap sync ios
```

```ts
import { InAppReview } from "@capacitor-community/in-app-review";

export async function requestReview(): Promise<void> {
  await InAppReview.requestReview();
}
```

## 14. 残っているリスクと運用メモ

- **App Check未導入**: Firestoreのread/writeはAPIキーがあれば誰でも叩ける状態。悪意ある大量書き込みへの
  防御はFirestoreルールのバリデーション(score範囲・name長)のみ。心配なら`firebase-appcheck-capacitor`の
  導入を検討(v1.1候補)
- **ニックネームはUGC**: 不適切な文字列が入る可能性がある。通報導線は現状「プライバシーポリシー記載の
  連絡先にメール」のみ。運営者はFirebaseコンソールから該当ドキュメントの`name`フィールドを手動編集できる
  (削除はルールで禁止しているが上書きは可能)
- **チケットは端末のローカル日付で判定**: 端末の時計を進めれば理論上チケットは早期に回復してしまう。
  実害は「無料プレイ回数を少し多く使われる」程度で、世界ランキングの信頼性(スコア自体)には影響しないため
  許容している
- **クラウドセーブなし**: `localStorage`は機種変更・アプリ再インストールで消える。ベスト記録や課金の
  復元は「リストア」ボタン(購入履歴のみ)でカバーされるが、ランキング順位やきせかえ進捗は引き継がれない。
  気になる場合はplayerIdをiCloud Keychain等に退避する仕組みをv1.1で検討
- **利用規約(Terms of Service)ページは未作成**: 課金があるアプリでは用意しておくと安全(プライバシー
  ポリシーとは別物)。App Store Connectの「EULA」欄で標準契約を使う選択肢もある

## 15. リリース後

- Firestore の無料枠(読取5万/日)監視: Firebase コンソール → 使用状況。超えそうならランキングのキャッシュ間隔を伸ばす
- 更新の反映は `CAPACITOR=1 npm run build && npx cap sync ios` → Archive → 審査(Webコードの変更もネイティブ再提出が必要)
