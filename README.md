# CLIMB 30 ― 30びょうで どこまで のぼれる?

左右タップだけで足場を登る、**30秒スコアアタック**のシンプルなゲーム。

技術スタック: **TypeScript + HTML5 Canvas + Vite**(外部アセット・外部ライブラリゼロ。音はWeb Audio合成、絵はすべてコード描画)。iOSへはCapacitorで書き出し(`docs/ios-setup.md`)。

> 過去のプロトタイプ(秒針ヒーロー/SPRING DRILL/RECOIL RISER)はすべて破棄済み。git履歴に保全されている。

---

## ルール

- **制限時間30秒・ステージは1つ**。スコア=時間内の**最高到達高度(m)**
- 足場は**左か右かの2種のみ**(ランダム、同一側の連続は最大7)。**画面には2つ上の足場まで**見え、その先は霧
- **画面の左半分/右半分をタップ**して、次の足場がある側へジャンプ
- **ミス(逆側をタップ)すると、その側の「直近下の足場」まで落下**。同じ側が続いているほど、逆側へのミスの落下距離が大きくなる(地面が最終セーフティ。死なない)

## 画面(4つ)

```
ホーム(タイトル+ベスト+プレイヤー名(タップで変更)+[あそぶ][ランキング])
→ ゲーム(3,2,1,GO! → 30秒 → TIME UP!)
→ リザルト(高度カウントアップ+ベスト更新+順位)
⇄ ランキング(🌏せかい=オンラインTOP50 / 📱じぶん=ローカルTOP10)
```

## 背景ゾーン(高度で変化)

ゆうぐれ(0m〜、山と夕日) → よぞら(25m〜、月と星) → くものうえ(50m〜、流れる雲) → うちゅう(80m〜、惑星とオーロラ)。ゾーン到達でマイルストーン演出。足場の装飾も変わる(草→灯り→雲→クリスタル)。定義は `config.ts` の `ZONES`。

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
- 自己ベスト更新時に自動送信。通信失敗時は次回ランキング画面で再送
- プレイヤー名は初回に「ノボラー1234」形式で自動生成、ホームで変更可(12文字)

## 開発・実行

```bash
npm install
npm run dev      # 開発サーバ(クリック=タップ。←→キーでも操作可)
npm run build    # 型チェック+本番ビルド(dist/)
```

iOS書き出し(Mac上): `docs/ios-setup.md` 参照。**先に本ブランチをcheckoutすること**(mainにはコードがない)。

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
