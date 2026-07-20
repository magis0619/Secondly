import { defineConfig } from "vite";

// ネイティブ（iOS/Capacitor）ビルドかどうか。`CAPACITOR=1 vite build` のように指定する。
// WKWebView は capacitor://localhost のルートから配信するため、アセットは相対パス（./）にする。
const isCapacitor = process.env.CAPACITOR === "1";

export default defineConfig({
  base: isCapacitor ? "./" : "/",
});
