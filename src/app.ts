import type { Input } from "./core/input.ts";
import type { SceneManager } from "./core/scene.ts";
import type { Viewport } from "./core/viewport.ts";

/** シーンへ渡す共有コンテキスト */
export interface App {
  vp: Viewport;
  input: Input;
  manager: SceneManager;
}
