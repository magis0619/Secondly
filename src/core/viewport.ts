/**
 * 画面サイズ/DPR/セーフエリアの管理。
 * ゲーム座標は「文字盤中心が原点・短辺基準の相似形」:
 *   unit = min(w, h) / 400、文字盤半径 R = 170 * unit
 * 描画コンテキストは CSSピクセル座標(dprはsetTransformで吸収)。
 */
export interface Viewport {
  w: number; // CSS px
  h: number;
  dpr: number;
  unit: number;
  R: number; // 文字盤半径(CSS px)
  cx: number; // 文字盤中心
  cy: number;
  safeTop: number;
  safeBottom: number;
}

export function createViewport(canvas: HTMLCanvasElement): Viewport {
  const vp: Viewport = {
    w: 0, h: 0, dpr: 1, unit: 1, R: 100, cx: 0, cy: 0, safeTop: 0, safeBottom: 0,
  };

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const cs = getComputedStyle(document.documentElement);
    vp.safeTop = parseFloat(cs.getPropertyValue("--sat")) || 0;
    vp.safeBottom = parseFloat(cs.getPropertyValue("--sab")) || 0;
    vp.w = w;
    vp.h = h;
    vp.dpr = dpr;
    vp.unit = Math.min(w, h) / 400;
    vp.R = 170 * vp.unit;
    vp.cx = w / 2;
    // 縦持ちでは中心をわずかに上へ(下部HUD/親指の余白)。横長環境では中央。
    vp.cy = h > w ? h * 0.47 : h / 2;
  };

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  return vp;
}
