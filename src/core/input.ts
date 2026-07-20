/**
 * 入力はPointer Eventsに統一(タッチ/マウス両対応)。
 * ゲームの操作は「押す」「離す」の2つだけ。プライマリポインタのみ追跡し、
 * pointercancel(通知センター引き出し等)は「離す」と同じ扱いにする。
 * 開発用にスペースキーでも同じ操作ができる。
 */
export interface InputHandler {
  onDown?(x: number, y: number): void;
  onUp?(x: number, y: number): void;
}

export interface Input {
  /** 現在押下中か(イベント取りこぼし対策に毎フレーム参照できる) */
  readonly pressed: boolean;
  setHandler(h: InputHandler): void;
}

export function createInput(canvas: HTMLCanvasElement): Input {
  let handler: InputHandler = {};
  let pressed = false;
  let activeId: number | null = null;

  const down = (e: PointerEvent) => {
    e.preventDefault();
    if (activeId !== null) return; // マルチタッチの2本目以降は無視
    activeId = e.pointerId;
    pressed = true;
    handler.onDown?.(e.clientX, e.clientY);
  };
  const up = (e: PointerEvent) => {
    e.preventDefault();
    if (e.pointerId !== activeId) return;
    activeId = null;
    pressed = false;
    handler.onUp?.(e.clientX, e.clientY);
  };

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && !pressed) {
      pressed = true;
      handler.onDown?.(innerWidth / 2, innerHeight / 2);
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && pressed) {
      pressed = false;
      handler.onUp?.(innerWidth / 2, innerHeight / 2);
    }
  });

  return {
    get pressed() {
      return pressed;
    },
    setHandler(h: InputHandler) {
      handler = h;
    },
  };
}
