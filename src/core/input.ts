/**
 * 入力はPointer Eventsに統一(タッチ/マウス両対応)。
 * 「押す/離す」に加え、押下中の横ドラッグ量(dragDX)を追跡する。
 * プライマリポインタのみ追跡し、pointercancel(通知センター等)は「離す」と同じ扱い。
 * 開発用: スペース=押す/離す、←→=横移動(keyDir)。
 */
export interface InputHandler {
  onDown?(x: number, y: number): void;
  onUp?(x: number, y: number): void;
  onMove?(x: number, y: number): void;
}

export interface Input {
  /** 現在押下中か(イベント取りこぼし対策に毎フレーム参照できる) */
  readonly pressed: boolean;
  /** キーボード←→の方向(-1/0/+1)。タッチと併用可(開発用) */
  readonly keyDir: number;
  /** 最後に把握しているポインタ座標(CSS px)。照準に使う */
  readonly pointerX: number;
  readonly pointerY: number;
  /** 前回消費から累積した横ドラッグ量(px)を取り出してリセットする */
  consumeDragDX(): number;
  setHandler(h: InputHandler): void;
}

export function createInput(canvas: HTMLCanvasElement): Input {
  let handler: InputHandler = {};
  let pressed = false;
  let activeId: number | null = null;
  let lastX = 0;
  let dragDX = 0;
  let left = false;
  let right = false;
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight * 0.8;

  const down = (e: PointerEvent) => {
    e.preventDefault();
    if (activeId !== null) return; // マルチタッチの2本目以降は無視
    activeId = e.pointerId;
    pressed = true;
    lastX = e.clientX;
    pointerX = e.clientX;
    pointerY = e.clientY;
    handler.onDown?.(e.clientX, e.clientY);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    e.preventDefault();
    dragDX += e.clientX - lastX;
    lastX = e.clientX;
    pointerX = e.clientX;
    pointerY = e.clientY;
    handler.onMove?.(e.clientX, e.clientY);
  };
  const up = (e: PointerEvent) => {
    e.preventDefault();
    if (e.pointerId !== activeId) return;
    activeId = null;
    pressed = false;
    handler.onUp?.(e.clientX, e.clientY);
  };

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && !pressed) {
      pressed = true;
      handler.onDown?.(innerWidth / 2, innerHeight / 2);
    }
    if (e.code === "ArrowLeft") left = true;
    if (e.code === "ArrowRight") right = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && pressed) {
      pressed = false;
      handler.onUp?.(innerWidth / 2, innerHeight / 2);
    }
    if (e.code === "ArrowLeft") left = false;
    if (e.code === "ArrowRight") right = false;
  });

  return {
    get pressed() {
      return pressed;
    },
    get keyDir() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    get pointerX() {
      return pointerX;
    },
    get pointerY() {
      return pointerY;
    },
    consumeDragDX() {
      const dx = dragDX;
      dragDX = 0;
      return dx;
    },
    setHandler(h: InputHandler) {
      handler = h;
    },
  };
}
