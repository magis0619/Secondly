/**
 * 画面サイズ/DPR/セーフエリアの管理。
 * 縦持ちゲームなので、横長の画面(PC・タブレット横)では中央に縦フレームを
 * 切り出してレターボックス表示する(vp.w=フレーム幅, offsetX=左帯の幅)。
 * ゲーム座標は unit = min(vp.w, h) / 400 の相似形。
 */
export interface Viewport {
  /** ゲームフレームの幅(CSS px)。シーンはこれを画面幅として使う */
  w: number;
  h: number;
  /** 物理画面の幅 */
  realW: number;
  /** フレームの左端オフセット(レターボックスの帯幅) */
  offsetX: number;
  dpr: number;
  unit: number;
  R: number;
  cx: number;
  cy: number;
  safeTop: number;
  safeBottom: number;
}

/** これより横長ならフレームをクランプする(iPhone縦 ≒ 0.46〜0.56) */
const MAX_ASPECT = 0.62;
const FRAME_ASPECT = 0.56;

/**
 * iOSネイティブ(Capacitor)で env(safe-area-inset-top) が0を返した場合の保険。
 * ダイナミックアイランド機のステータスバーは59pt。ノッチ無し機はそもそもenvが
 * 正しく0以外を返すため、この値が使われるのは読み取りに失敗した時だけ。
 */
const IOS_NATIVE_MIN_TOP = 59;

function isNativeIos(): boolean {
  const capacitor = location.protocol === "capacitor:" || "Capacitor" in window;
  return capacitor && /iPhone|iPod/.test(navigator.userAgent);
}

export function createViewport(canvas: HTMLCanvasElement): Viewport {
  const vp: Viewport = {
    w: 0, h: 0, realW: 0, offsetX: 0, dpr: 1, unit: 1, R: 100, cx: 0, cy: 0, safeTop: 0, safeBottom: 0,
  };

  const resize = () => {
    const rw = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(rw * dpr);
    canvas.height = Math.round(h * dpr);
    const cs = getComputedStyle(document.documentElement);
    vp.safeTop = parseFloat(cs.getPropertyValue("--sat")) || 0;
    vp.safeBottom = parseFloat(cs.getPropertyValue("--sab")) || 0;
    // ダイナミックアイランド/ノッチにHUDが被らないための保険(env()が読めなかった時)
    if (vp.safeTop === 0 && isNativeIos()) vp.safeTop = IOS_NATIVE_MIN_TOP;
    const frameW = rw / h > MAX_ASPECT ? Math.round(h * FRAME_ASPECT) : rw;
    vp.realW = rw;
    vp.w = frameW;
    vp.offsetX = Math.round((rw - frameW) / 2);
    vp.h = h;
    vp.dpr = dpr;
    vp.unit = Math.min(frameW, h) / 400;
    vp.R = 170 * vp.unit;
    vp.cx = frameW / 2;
    vp.cy = h > frameW ? h * 0.47 : h / 2;
  };

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  // セーフエリアのCSS変数はスタイル適用後でないと読めないことがある(特にWKWebView)。
  // load後と起動1秒後にもう一度読み直す。
  window.addEventListener("load", resize);
  setTimeout(resize, 1000);
  return vp;
}
