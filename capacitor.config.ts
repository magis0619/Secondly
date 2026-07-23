import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor（ネイティブiOSラッパ）設定の雛形。
// このファイルは tsconfig の include(["src"]) 外なので Web の `tsc` ビルドには影響しない。
// ネイティブ化は Mac 上で行う（手順は docs/ios-setup.md 参照）:
//   npm i @capacitor/core @capacitor/cli @capacitor/ios
//   CAPACITOR=1 npm run build
//   npx cap add ios && npx cap sync ios
const config: CapacitorConfig = {
  // ★リリース前に必ず自分の Bundle ID へ変更すること（例: com.yourname.climb30）。
  //   App Store で一意である必要があり、後から変更できない。docs/release-checklist.md 参照。
  appId: "com.example.secondly",
  // 英語圏でのデフォルト表示名。日本語の「のぼれ！30秒」は InfoPlist.strings で
  // ローカライズする(docs/release-checklist.md「表示名のローカライズ」参照)。
  appName: "Climb 30",
  webDir: "dist",
  ios: {
    // WKWebView の背景色（起動直後/セーフエリア外に見える色）。
    // スプラッシュ（assets/appstore/splash-2732.png）の山の色に合わせている。
    backgroundColor: "#472a66",
    // ステータスバー領域は content 側で扱う（index.html は viewport-fit=cover 対応済み）。
    contentInset: "never",
  },
};

export default config;
