# のぼれ！30秒 (Climb 30) ― 30びょうで どこまで のぼれる?

左右タップだけで足場を登る、**30秒スコアアタック**のシンプルなゲーム。
日本語/英語の2言語対応(ホーム左上の🌐で切替。文言は `src/game/i18n.ts` に集約)。

技術スタック: **TypeScript + HTML5 Canvas + Vite**(外部アセット・外部ライブラリゼロ。音はWeb Audio合成、絵はすべてコード描画)。iOSへはCapacitorで書き出し(`docs/ios-setup.md`)。

> 過去のプロトタイプ(秒針ヒーロー/SPRING DRILL/RECOIL RISER)はすべて破棄済み。git履歴に保全されている。

---

## ルール

- **制限時間30秒・ステージは1つ**。スコア=時間内の**最高到達高度(m)**
- 足場は**左か右かの2種のみ**(ランダム、同一側の連続は最大7)。**画面には3つ上の足場まで**見え、さらに1つ上がうっすら透けて見える(その先は不明)
- **画面の左半分/右半分をタップ**して、次の足場がある側へジャンプ
- **ミス(逆側をタップ)すると、その側の「直近下の足場」まで落下**。同じ側が続いているほど、逆側へのミスの落下距離が大きくなる(地面が最終セーフティ。死なない)

## モードと画面

- **れんしゅう** … 無料でいつでも。記録はローカルランキング(📱)のみ
- **🌏 ほんばん** … 世界ランキングに挑戦するモード。**1日3回無料**(🎟チケット制)。使い切ったら**広告1回の視聴で+3回**。広告除去購入者は**無制限**。残数はホームに常時表示
- **🔥 フィーバー** … ノーミスで12回登るとゲージ満タン→5秒間フィーバー。**足場が中央1本になり、どちらをタップしても登れる(=連打で一気に登る)**。ホップも高速化。終了すると足場は左右に戻る(直後の1段だけは両側OKの猶予)。ミスで即終了&ゲージリセット
- **👕 きせかえ** … 累計プレイ/ベスト高度/おうえん購入でバンダナを解放(`config.ts`の`SKINS`)。ホームのキャラ横から変更
- **⚙ せってい** … 名前の変更・言語・プライバシーポリシー・バージョン(ホーム右上)

```
ホーム(タイトル+ベスト+名前+[れんしゅう][🌏ほんばん][🏆ランキング][🛒ストア][👕きせかえ])
→ (ほんばんでチケット切れのとき)補充画面(「広告を見て+3回」→ 広告)
→ ゲーム(3,2,1,GO! → 30秒 → TIME UP!)
→ リザルト(モードバッジ+高度カウントアップ+世界への送信結果)
⇄ ランキング(🌏ほんばん=オンラインTOP50 / 📱れんしゅう=ローカルTOP10)
⇄ ストア(広告じょきょ/開発者おうえん×3/リストア)
```

## 背景ゾーン(高度で変化)

ゆうぐれ(0m〜、山と夕日) → よぞら(35m〜、月と星) → くものうえ(75m〜、流れる雲) → うちゅう(120m〜、惑星とオーロラ)。ゾーン到達でマイルストーン演出。足場の装飾も変わる(草→灯り→雲→クリスタル)。定義は `config.ts` の `ZONES`。

## 音(BGM+SFX、全てWeb Audio合成)

- BGM 3曲(`src/audio/bgm.ts` のステップシーケンサ): メニュー(ゆったり)/登り中(軽快)/フィーバー中(高揚)。シーン遷移とフィーバー開始・終了で自動切替
- リザルトでローカル1〜3位に入るとファンファーレSE(1位は特別ロング版)+巨大な順位表示(1位は回転光線+紙吹雪)

## オンラインランキング(Firebase Firestore、無料)

**未設定の間は自動的にオフライン(ローカルのみ)で動作**。有効化する手順:

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクト作成(Sparkプラン=無料。書込2万/日・読取5万/日で十分)
2. 「Firestore Database」を作成(本番モード)→「ルール」に以下を貼る:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{playerId} {
      allow read: if true;
      allow write: if request.resource.data.score is int
                   && request.resource.data.score >= 0
                   && request.resource.data.score <= 1000
                   && request.resource.data.name is string
                   && request.resource.data.name.size() <= 12;
      allow delete: if false;
    }
  }
}
```

3. プロジェクト設定 → 全般 から **プロジェクトID** と **ウェブAPIキー** をコピーし、`src/game/config.ts` の `ONLINE.projectId` / `ONLINE.apiKey` に貼る

- 実装はFirestore REST直叩き(`src/game/online.ts`、SDK依存なし)。1プレイヤー=1ドキュメント(匿名ID)なので同一人物がランキングに並ばない
- **送信されるのは「ほんばん」の自己ベスト(`rankedBest`)のみ**。送信済みスコアを`lastSynced`に記録し、`rankedBest > lastSynced` の間は ほんばん終了時とランキング画面表示時に自動送信する(通信失敗しても次の機会に再送。名前変更時は`lastSynced`を0に戻して新しい名前で再送)
- プレイヤー名は初回に「ノボラー1234」形式で自動生成、ホームで変更可(12文字)

## 広告と課金(iOS接続はmonetize.tsだけ)

**開発/Webビルドはすべてスタブ**: 広告=キャンバス内の擬似広告5秒(「開発ビルドのため擬似広告」と表示)、課金=confirmダイアログで成功扱い(請求なし)。

商品(価格は仮。ストア接続後は実価格を表示すること):

| ID | 内容 |
|---|---|
| `noads` | 広告じょきょ ¥480(かいきり)。ほんばん前の広告が消える |
| `tip_s/m/tip_l` | 開発者おうえん ¥160/¥480/¥1,200(何度でも)。ホームの名前に⭐ |

**iOS製品化の差し替えポイントは `src/game/monetize.ts` のみ**:

1. `AD_STUB = false` にして `showNativeAd()` を AdMob インタースティシャル(Capacitorプラグイン `@capacitor-community/admob` 等)に実装
2. `purchase()` / `restorePurchases()` を StoreKit(`@revenuecat/purchases-capacitor` 等)に実装
3. App Store Connect に上記4商品を登録(noads=非消耗型、tip系=消耗型)

## 分析(アナリティクス)

`src/game/analytics.ts` の `logEvent()` に集約(開発ビルドはconsole+`window.__analytics`のみ。iOSでのFirebase Analytics接続は `docs/release-checklist.md` 参照)。イベント:
`app_open` / `play_start{mode}` / `play_end{mode,score,maxCombo,fever}` / `fever_start` / `ad_shown` / `ticket_refill` / `purchase{id}` / `restore` / `ranking_view{tab}` / `name_change` / `skin_select{id}` / `lang_change{lang}`

## 開発・実行

```bash
npm install
npm run dev      # 開発サーバ(クリック=タップ。←→キーでも操作可)
npm run build    # 型チェック+本番ビルド(dist/)
```

iOS書き出し(Mac上): `docs/ios-setup.md` 参照。**先に本ブランチをcheckoutすること**(mainにはコードがない)。

**App Storeリリース**: 手順書 `docs/release-checklist.md`(AdMob/課金の差し替えコード・審査対策込み)。プライバシーポリシー雛形は `docs/privacy-policy.md`、ストア掲載文は `docs/store-listing.md`、アイコン/起動画面は `assets/appstore/`。

## 構成(最小)

```
src/
  core/     ループ・シーン遷移・入力・画面/DPR・数学・乱数(汎用基盤)
  game/
    config.ts  調整定数(制限時間/アニメ/レイアウト)
    tower.ts   全ゲームロジック(足場生成・タップ判定・落下・タイマー)
    save.ts    ベスト+ランキングTOP10(localStorage)
  scenes/   home / game / result / ranking(描画は各シーン内)
  fx/ audio/ render/ui  パーティクル・シェイク / 合成SFX / ボタン部品
```

- 調整は `src/game/config.ts`(時間・落下ペナルティ・連続上限・テンポ)だけで完結
- devビルドはゲーム画面で `window.__climb`(`state()`/`tap(0|1)`/`skip()`)を公開(動作確認用)

> 本作は完全オリジナルです。名称・グラフィック・音はすべて新規制作。
