# iOS ネイティブ化手順（Capacitor）

> **App Store へのリリース準備は [`release-checklist.md`](./release-checklist.md) に一本化した。**
> 本ファイルは開発ビルドを実機で動かすまでの最短手順。

本プロジェクトは Web（TypeScript + Canvas + Vite）で完結しており、iOS への書き出しは
Capacitor で行う。**ネイティブ化の作業は Mac + Xcode が必要**。Linux/CI 上では
`npm run dev` / `npm run build` によるブラウザ動作確認までを行う。

## 前提

- macOS + Xcode（App Store 提出には Apple Developer Program 加入が必要）
- Node.js 18+

## 初回セットアップ（Mac上）

```bash
git clone <このリポジトリ> && cd Secondly
npm install

# Capacitor 本体を追加（package.json に入れていないので初回に導入する）
npm i @capacitor/core @capacitor/cli @capacitor/ios

# ネイティブ用 Web ビルド（相対パス base で dist/ を生成）
CAPACITOR=1 npm run build

# iOS プロジェクト生成と同期
npx cap add ios
npx cap sync ios

# Xcode で開く
npx cap open ios
```

## 2回目以降の反映

```bash
CAPACITOR=1 npm run build && npx cap sync ios
```

## Xcode 側の最低限の設定

1. **Bundle Identifier**: `capacitor.config.ts` の `appId` を自分のものに変更してから
   `npx cap sync ios`（例: `com.yourname.secondly`）
2. **Signing & Capabilities**: 自分の Team を選択
3. **Deployment Info**: Portrait のみにチェック（本作は縦持ち専用）
4. アイコン/起動画面: `ios/App/App/Assets.xcassets` に設定

## 動作確認のポイント

- 実機でタッチの「押す/離す」遅延がないか（本作は操作がこの2つだけ）
- 消音スイッチON時の音の挙動（Web Audio は消音スイッチに従う）
- セーフエリア（ノッチ/ホームバー）で HUD が欠けないか
- バックグラウンド→復帰でポーズ画面が出ること
