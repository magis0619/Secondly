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

## 再利用早見表(2本目以降のアプリ向け)

既に1本リリース済みの前提での早見表。各サービスの**アカウントはそのまま使い回せる**が、
**このアプリ用の「アプリ/プロジェクト」単位の登録は毎回必要**なものが多い。

| 項目 | 再利用可否 |
|---|---|
| Apple Developer Program(年間契約・銀行口座/税務情報) | ♻️ アカウントそのまま。新規登録・再契約不要 |
| Bundle ID / App ID | 🆕 アプリごとに新規作成必須 |
| AdMobアカウント | ♻️ アカウントは再利用。🆕 このアプリ用の「アプリ」「広告ユニット」は新規作成 |
| RevenueCatアカウント | ♻️ アカウントは再利用。🆕 このアプリ用の「プロジェクト」は新規作成 |
| Firebase(Analytics/Firestore/Hosting) | ♻️ アカウントは再利用。🆕 このアプリ用のプロジェクトは新規(既存流用も可、6.5参照) |
| Firebase Hosting(プライバシーポリシー) | ♻️🆕 プロジェクトは6.5と共通化可(複数サイト機能)、公開サイトはアプリごとに1つ必要(7参照) |
| App Store Connect アプリ登録 | 🆕 アプリごとに新規必須 |

## 全体の流れ

```
1 Apple Developer登録 → 2 Bundle ID決定 → 3 Xcodeプロジェクト生成
→ 4 アイコン/起動画面 → 5 AdMob接続 → 6 課金接続(RevenueCat)
→ 7 プライバシーポリシー公開 → 8 App Store Connect登録 → 9 TestFlight → 10 審査提出
```

---

## 1. Apple Developer Program `♻️ 再利用可`

前アプリで加入済みのアカウントをそのまま使う。確認するのは以下の2点だけ:

- 年間メンバーシップが有効期限内か(<https://developer.apple.com/account/> で確認)
- App Store Connect の「契約/税/口座」で**有料Appの契約が有効**なままか(失効しているとApp内課金のテストもできない)

(未加入の場合のみ) <https://developer.apple.com/programs/> から加入(**年 ¥12,980 前後**)。個人でOK。
有料アプリ/App内課金を出すため、「契約/税/口座」で有料Appの契約に同意し、銀行口座と税務情報(W-8BEN等)を登録しておく。

## 2. Bundle ID の決定 `🆕 新規必須`

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

### 5-1. AdMob 側 `♻️🆕` アカウントは再利用、アプリ登録は新規

前アプリで使っているAdMobアカウントに<https://admob.google.com/>でログイン → 「アプリを追加」で
CLIMB 30用のアプリを新規作成する(アカウント自体の再作成は不要)。
未加入の場合のみアカウント作成から: 「アプリを追加」(まだストア未公開なので「アプリストアに掲載していない」を選ぶ)

1. **アプリID**(`ca-app-pub-xxxxxxxx~yyyyyyy`)を控える
2. 広告ユニットを作成 → **リワード(推奨)またはインタースティシャル** → ユニットID(`ca-app-pub-xxxxxxxx/zzzzzzz`)を控える
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

「マイApp → 対象App → 左メニュー『収益化』→『App内課金』→『+』」で1商品ずつ作成する。
種類(消耗型/非消耗型)は**作成後に変更できない**ので、下表どおりに選ぶこと:

| 商品ID(推奨) | 種類 | 参考価格 | 表示名 |
|---|---|---|---|
| `<bundleId>.noads` | **非消耗型** | ¥500段階 | こうこくじょきょ |
| `<bundleId>.tip_s` | **消耗型** | ¥200段階 | おうえん(小) |
| `<bundleId>.tip_m` | **消耗型** | ¥500段階 | おうえん(中) |
| `<bundleId>.tip_l` | **消耗型** | ¥1,200段階 | おうえん(大) |

各商品の作成フォームで埋める項目(4商品とも同じ流れを繰り返す):

1. **参照名**: 審査やストアには表示されない、自分の管理用ラベル(例「広告じょきょ」)。何でもよい
2. **製品ID**: 上表の `<bundleId>.xxx`(`<bundleId>` は2章で決めたもの)。**作成後は変更不可**
3. **価格**: 自由入力ではなく、Appleが用意した価格の一覧から選ぶ方式。¥160/¥480/¥1,200 はそのまま
   一覧に存在する定番額なので探せばそのまま見つかる(近い額を選べば他の国・地域の価格は自動計算される)
4. **App Store Connect ローカリゼーション**: 表示名・説明を日本語+英語で登録 → 6-1-a 参照
5. **審査情報**: スクリーンショット1枚(ストア画面をそのまま撮ってよい)+ Review Notes → 6-1-b 参照
6. 保存すると状態が「**送信準備未完了**」→ 必須項目を埋めきると「**送信準備完了**」に変わる

> **重要**: App内課金は**単体では初回審査に提出できない**。1本目のビルド(9章のTestFlight/10章の審査提出)
> と一緒に初めて送信される仕組みなので、「送信準備完了」まで整えたら10章のビルド提出を進めればよい
> (2本目以降の商品追加はビルドと無関係に単体提出できる)。

### 6-1-a. 表示名・説明のローカリゼーション(日本語+英語)

本アプリはJA/EN両対応(ホーム左上の🌐で切替)のため、各商品ページで
「+ ローカリゼーションを追加」から **日本語** と **英語(米国)** の2つを登録する。
テキストはアプリ内表示(`src/game/monetize.ts` の `PRODUCTS`=日本語、
`src/game/i18n.ts` の `PRODUCT_EN`=英語)とそのまま揃える:

| 商品ID | ロケール | 表示名 | 説明 |
|---|---|---|---|
| `noads` | 日本語 | 🚫 こうこく じょきょ | ほんばん前の こうこくが なくなる(かいきり) |
| `noads` | English (U.S.) | 🚫 Remove Ads | No more ads before Ranked (one-time) |
| `tip_s` | 日本語 | ☕ おうえん(小) | かいはつしゃに コーヒーを おごる |
| `tip_s` | English (U.S.) | ☕ Tip (S) | Buy the developer a coffee |
| `tip_m` | 日本語 | 🍱 おうえん(中) | かいはつしゃに おべんとうを おごる |
| `tip_m` | English (U.S.) | 🍱 Tip (M) | Buy the developer a lunch |
| `tip_l` | 日本語 | 🎉 おうえん(大) | かいはつしゃが とても よろこぶ |
| `tip_l` | English (U.S.) | 🎉 Tip (L) | Make the developer's day |

表示名は30文字・説明は45文字がAppleの目安なので、上表はいずれも余裕で収まっている。
**あとで文言を変える時は、`monetize.ts`(JA)と`i18n.ts`の`PRODUCT_EN`(EN)も同時に直し、
アプリ内表示とストア掲載のズレを防ぐこと。**

審査用スクショ(ストア画面のスクショでよい)も各商品に添付。

### 6-1-b. 各商品の審査メモ(Review Notes、コピペ用)

各商品を提出する際、商品ごとの「Review Notes」欄(アプリ全体の10章の審査メモとは別)に
以下をそのまま貼る。レビュアーは世界各国のチームなので**英語**で書く
(日本語コメントは自分用のメモで、貼り付け不要)。

**`noads`(広告じょきょ、非消耗型)**

> This is a non-consumable purchase that permanently removes the interstitial ad
> that is shown before starting Ranked Mode ("Honban"). It also supports Restore
> Purchases from the Store screen.
>
> How to test: Home screen → tap the shopping cart icon (Store) → tap
> "こうこく じょきょ" (Remove Ads) → complete the purchase → the ad no longer
> appears before Ranked Mode starts. To verify restore: reinstall the app (or use
> a fresh sandbox session) → Store screen → "リストア" (Restore) → ads are removed again.

> (日本語メモ: 非消耗型。ほんばん開始前の広告を恒久的に消す。リストア対応あり)

**`tip_s` / `tip_m` / `tip_l`(開発者おうえん、消耗型)**

> These are consumable purchases that let the player send an optional, one-time
> tip to the developer. They unlock no additional content, features, or
> gameplay advantage — the only visible change is a small ⭐ mark shown next to
> the player's name on the Home screen after any tip purchase. This is a purely
> voluntary show of support, in line with Guideline 3.2.1(b).
>
> How to test: Home screen → tap the shopping cart icon (Store) → tap any of
> the "おうえん" (Support) items → complete the purchase → a ⭐ appears next to
> the player name on the Home screen. The purchase can be repeated any number
> of times (consumable).

> (日本語メモ: 消耗型・追加機能なしの純粋な支援。購入後ホーム名前欄に⭐が付くのみ。3.2.1(b)対策として明記)

### 6-2. RevenueCat セットアップ `♻️🆕` アカウントは再利用、プロジェクトは新規

前アプリのRevenueCatアカウントにログイン → CLIMB 30用の**プロジェクトを新規作成**する(アカウント自体は共通)。
未加入の場合のみアカウント作成から: <https://www.revenuecat.com/>(無料枠で十分)

1. <https://app.revenuecat.com/> にログイン → 左上のプロジェクト切り替え →「+ New Project」→
   プロジェクト名(例「CLIMB 30」)を入力して作成
2. 左メニュー「Apps」→「+ New」→「App Store」を選択 → App名(任意)と **Bundle ID**(2章で決めたもの)を入力
3. App Store Connect 側で共有シークレットを取得: App Store Connect → 対象App →「App情報」→
   下の方の「**App-Specific Shared Secret**」の「管理」→ 表示された文字列をコピー
4. 手順2で作ったRevenueCatのApp設定画面に、手順3のシークレットを貼り付けて保存
5. 左メニュー「Product Catalog → Products」→「+ New」または「Sync from App Store Connect」で
   6-1で作った4商品を取り込む(App Store Connect側で商品を保存した直後は同期候補に出ないことがあるので、
   6-1を先に済ませ、少し時間を置いてから同期する)
6. 左メニュー「Entitlements」→「+ New」→ 識別子 `noads` を作成 →
   `noads` Entitlement の「Attach」から `.noads` 製品を紐づける
   (tip系は消耗型で「継続的に持つ権利」が無いため Entitlement 紐付けは不要。
   購入結果は `purchaseStoreProduct()` の戻り値だけで判定すれば十分)
7. 左メニュー「API Keys → Apps」タブ → 作成したiOSアプリの
   **Public app-specific API key** をコピー → 6-3 のコード内 `RC_API_KEY` に貼る
8. プラグイン導入: `npm i @revenuecat/purchases-capacitor && npx cap sync ios`

### 6-2-b. StoreKitでローカルテスト(推奨・時短)

Sandbox環境(6-4)はApple側の同期待ちで反映まで時間がかかることがある。購入フローのUI/エラー
ハンドリングだけ素早く試したい場合は、Xcodeの**StoreKit Configuration File**を使うとネットワーク
接続なしで即座にテストできる:

1. Xcode → File → New → File →「StoreKit Configuration File」を作成(例 `Products.storekit`)
2. ファイル内で「+」→ 6-1と同じ商品ID・種類・価格を手入力(App Store Connectの内容を写すだけ)
3. Product → Scheme → Edit Scheme → Run → Options →「StoreKit Configuration」で今のファイルを選択
4. シミュレータ/実機のデバッグ実行で購入フローを動かすと、確認ダイアログは出るが実際の課金・
   ネットワーク通信は発生しない
5. **注意**: RevenueCat SDKはStoreKit Configurationと組み合わせても基本動作するが、環境によっては
   相性問題が報告されている。うまく動かない場合は素直に6-4のSandboxテストへ切り替える

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

1. **Sandboxテスターの作成**: App Store Connect →「ユーザとアクセス」→「Sandboxテスター」→「+」→
   実在しない/普段使わないメールアドレスで作成(本物のApple IDと重複不可。日本の価格表で確認したいなら
   「地域」を日本に設定)
2. **実機にログイン**:
   - iOS 16以降: 設定 →「App Store」→ 一番下の「サンドボックスアカウント」から直接ログイン
     (普段使いのApple IDをサインアウトする必要はない)
   - iOS 15以前: 設定 → 自分のApple ID → サインアウト → アプリ内で購入しようとした時に出る
     サインインダイアログにSandboxテスターの認証情報を入力
3. TestFlightまたはXcodeからのデバッグ実行でアプリを起動 → ストア画面で各商品をタップ →
   確認ダイアログに「環境: Sandbox」等の注記が出れば正しく接続できている
4. 確認項目: noads購入→ほんばんが広告なし / アプリ削除→再インストール→**リストアでnoads復活** /
   tip購入→⭐とお礼表示 / 同じtip商品を連続購入できる(消耗型であることの確認)

#### よくあるハマりどころ

| 症状 | 原因 / 対策 |
|---|---|
| 商品が読み込めない(0件) | App Store Connectの契約/税/口座が未完了、または商品が「送信準備完了」段階で審査未提出。反映まで最大24時間かかることがある |
| 「このApple IDは既に使用されています」 | 本番のApple IDでサインインしたまま購入しようとしている。サンドボックスアカウントでログインし直す |
| 購入ダイアログに Sandbox の表記がない | 本番環境に接続している(サンドボックスアカウントでのログインができていない) |
| `restorePurchases()` が空を返す | Entitlement `noads` への製品紐付け忘れ(6-2手順6)。またはRevenueCat側の同期待ち、数秒おいて再試行 |

## 6.5 分析(Firebase Analytics)と表示名のローカライズ

### 分析の接続(任意だが推奨) `♻️🆕` アカウントは再利用、プロジェクトは新規 or 既存流用

ゲーム内は `src/game/analytics.ts` の `logEvent()` に計測が集約済み(イベント一覧はファイル冒頭)。
開発ビルドではconsole出力のみ。iOSで実際に収集するには:

```bash
npm i @capacitor-firebase/analytics firebase && npx cap sync ios
```

前アプリと同じFirebaseアカウントを使い、以下のどちらかを選ぶ:
- **新規プロジェクトを作る**(推奨: アプリごとにAnalyticsを分離できる)
- **前アプリと同じプロジェクトに新規iOSアプリを追加する**(Analytics上で複数アプリが混在するが管理は1つで済む)

いずれの場合もFirebaseコンソールでiOSアプリを追加し、`GoogleService-Info.plist` を
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

## 7. プライバシーポリシー(必須) `♻️🆕` プロジェクトは6.5と共通化可、公開サイトはアプリごとに1つ必要

前アプリと同じ **Firebase Hosting** で公開する(前アプリの実績に合わせた標準手順)。
6.5でFirebaseプロジェクトを用意済みならそのまま流用でき、まだの場合は先に6.5を済ませておくと二度手間にならない。

1. `docs/privacy-policy.md` の `【】` 箇所(連絡先メール等)を埋める
2. Firebase CLI導入(初回のみ): `npm i -g firebase-tools && firebase login`(前アプリで使った
   Googleアカウントでログイン)
3. Markdownはそのままでは配信されないので、簡単なHTMLに変換して置く:
   ```bash
   mkdir -p privacy/public
   ```
   `privacy/public/index.html` を新規作成し、`docs/privacy-policy.md` の見出し/本文を
   `<h1>`/`<h2>`/`<p>` に置き換えて貼る(1ページだけなので手作業で十分。急ぐ場合は
   本文をまるごと `<pre style="white-space:pre-wrap;font-family:sans-serif;max-width:640px;margin:2em auto">…</pre>`
   で囲むだけでも公開できる)
4. **前アプリと同じFirebaseプロジェクトを使い回す場合**(推奨): Hostingの「複数サイト」機能で
   アプリごとにサイトだけ分ける
   ```bash
   firebase use <前アプリと共通のプロジェクトID>
   firebase hosting:sites:create climb30-privacy
   firebase target:apply hosting climb30-privacy climb30-privacy
   ```
   `firebase.json` の `hosting` に `"target": "climb30-privacy", "public": "privacy/public"` を設定し、
   ```bash
   firebase deploy --only hosting:climb30-privacy
   ```
   → `https://climb30-privacy.web.app` のようなURLが発行される
5. **新規にFirebaseプロジェクトを用意する場合**: `firebase init hosting` の対話で新規プロジェクトを選び、
   公開ディレクトリに `privacy/public` を指定して `firebase deploy`。この場合はデフォルトの
   `https://<プロジェクトID>.web.app` がそのままURLになる(手順4の複数サイト設定は不要)
6. いずれにせよ**URLはアプリごとに別物**になる(前アプリのURLをそのまま使い回すことはできない)
7. URL を以下 3 箇所に設定:
   - `src/game/config.ts` の `LEGAL.privacyUrl`(ストア画面にリンクが出る)
   - App Store Connect のアプリ情報「プライバシーポリシーURL」
   - AdMob のアプリ設定

(GitHub Pagesでも同様に公開できるが、前アプリの実績に合わせてFirebase Hostingを標準手順とした)

### App Store Connect「Appのプライバシー」申告表の書き方

| 収集データ | 該当 | 用途 | 紐づけ | トラッキング |
|---|---|---|---|---|
| 識別子 > ユーザID | 匿名プレイヤーID | アプリの機能(ランキング) | いいえ | いいえ |
| ユーザコンテンツ > その他 | ニックネーム | アプリの機能 | いいえ | いいえ |
| 識別子 > デバイスID | 広告識別子(IDFA) | 広告 | いいえ | **はい**(ATT許可時) |
| 使用状況データ | 広告SDKの計測 | 広告 | いいえ | はい |
| 使用状況データ > 製品の操作 | Firebase Analytics(プレイ回数等) | 分析 | いいえ | いいえ |

(AdMobのパーソナライズ広告を使わない設定にするならトラッキング「いいえ」+ATT省略も可)

## 8. App Store Connect でアプリ登録 `🆕 新規必須`

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
| チップ課金の誤解(3.2.1) | 各商品のReview Notes(6-1-b)に「追加機能のない任意の支援」と明記済み。アプリ内の説明文もその通りになっている |

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
