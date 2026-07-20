import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor（ネイティブiOSラッパ）設定の雛形。
// このファイルは tsconfig の include(["src"]) 外なので Web の `tsc` ビルドには影響しない。
// ネイティブ化は Mac 上で行う（手順は docs/ios-setup.md 参照）:
//   npm i @capacitor/core @capacitor/cli @capacitor/ios
//   CAPACITOR=1 npm run build
//   npx cap add ios && npx cap sync ios
const config: CapacitorConfig = {
  // App Store の Bundle ID。公開前に本人のものへ確定すること（例: com.yourname.secondly）。
  appId: "com.example.secondly",
  appName: "SPRING DRILL",
  webDir: "dist",
  ios: {
    // WKWebView の背景色（セーフエリア外/スクロールバウンス時に見える色）。テーマに合わせる。
    backgroundColor: "#0a0e1a",
    // ステータスバー領域は content 側で扱う（index.html は viewport-fit=cover 対応済み）。
    contentInset: "never",
  },
};

export default config;
