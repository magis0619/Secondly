import { clamp } from "./math.ts";

export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  onDown?(x: number, y: number): void;
  onUp?(x: number, y: number): void;
}

const FADE_TIME = 0.3;

/** シーン遷移(背景色へのフェード付き)を管理する */
export class SceneManager {
  private current: Scene;
  private next: Scene | null = null;
  /** 0=表示中, 1=完全に隠れている */
  private fade = 1; // 起動時はフェードインから始める
  private fadingOut = false;

  constructor(
    first: Scene,
    private fadeColor: string,
  ) {
    this.current = first;
    first.enter?.();
  }

  switchTo(scene: Scene): void {
    if (this.next) return; // 遷移中の二重要求は無視
    this.next = scene;
    this.fadingOut = true;
  }

  update(dt: number): void {
    if (this.fadingOut) {
      this.fade = clamp(this.fade + dt / FADE_TIME, 0, 1);
      if (this.fade >= 1 && this.next) {
        this.current.exit?.();
        this.current = this.next;
        this.next = null;
        this.current.enter?.();
        this.fadingOut = false;
      }
    } else if (this.fade > 0) {
      this.fade = clamp(this.fade - dt / FADE_TIME, 0, 1);
    }
    this.current.update(dt);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.current.draw(ctx);
    if (this.fade > 0) {
      ctx.save();
      ctx.globalAlpha = this.fade;
      ctx.fillStyle = this.fadeColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  onDown(x: number, y: number): void {
    if (!this.fadingOut) this.current.onDown?.(x, y);
  }
  onUp(x: number, y: number): void {
    this.current.onUp?.(x, y);
  }
}
