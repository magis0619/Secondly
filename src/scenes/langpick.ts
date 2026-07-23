import type { App } from "../app.ts";
import { clamp } from "../core/math.ts";
import { sfxStart } from "../audio/sfx.ts";
import { logEvent } from "../game/analytics.ts";
import { COLORS } from "../game/config.ts";
import type { Lang } from "../game/i18n.ts";
import { setLang } from "../game/i18n.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";

/**
 * 初回起動時に一度だけ出す言語選択オーバーレイ。HowToModal と同じ軽量パターン
 * (Sceneではなく Home が所有し draw/update/onUp を委譲。開いている間は onUp が true でタップ吸収)。
 * まだ言語が確定していない場面なので、見出し・案内は日英併記でどちらの話者にも読めるようにする。
 * キャンセルは無く、必ずどちらかを選ばせる(選ぶと onSelect が呼ばれて閉じる)。
 */
export class LanguagePickerModal {
  private t = 0;
  open = false;
  private jaRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private enRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  /** 選択され言語が確定した後に Home 側で呼ばれる(名前の付け直し等に使う) */
  onSelect: ((l: Lang) => void) | null = null;

  constructor(private app: App) {}

  show(): void {
    this.open = true;
    this.t = 0;
  }

  update(dt: number): void {
    if (this.open) this.t += dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.open) return;
    const { vp } = this.app;
    const { w, h, unit: u } = vp;

    // ぽよんと登場(オーバーシュート付き)
    const at = clamp(this.t / 0.35, 0, 1);
    const c1 = 1.70158;
    const pop = 1 + (c1 + 1) * Math.pow(at - 1, 3) + c1 * Math.pow(at - 1, 2);

    ctx.save();
    ctx.fillStyle = "rgba(5,8,18,0.85)";
    ctx.fillRect(0, 0, w, h);

    const cw = w * 0.82;
    const cx0 = w / 2 - cw / 2;
    const btnH = 58 * u;
    const btnGap = 14 * u;
    const chh = 96 * u + btnH * 2 + btnGap + 24 * u;
    const cy0 = h / 2 - chh / 2;

    ctx.translate(w / 2, cy0 + chh / 2);
    ctx.scale(clamp(pop, 0, 1.15), clamp(pop, 0, 1.15));
    ctx.translate(-w / 2, -(cy0 + chh / 2));

    ctx.fillStyle = "#1c2743";
    ctx.beginPath();
    ctx.roundRect(cx0, cy0, cw, chh, 20 * u);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.5 * u;
    ctx.stroke();

    // 見出し(日英併記)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.gold;
    ctx.font = `900 ${30 * u}px ${FONT}`;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 10 * u;
    ctx.fillText("🌐", w / 2, cy0 + 40 * u);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 ${14 * u}px ${FONT}`;
    ctx.fillText("ことばを えらんでね", w / 2, cy0 + 68 * u);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${12 * u}px ${FONT}`;
    ctx.fillText("Choose your language", w / 2, cy0 + 86 * u);

    // 縦2ボタン
    const bw = cw - 40 * u;
    const bx = cx0 + 20 * u;
    const by0 = cy0 + 96 * u;
    this.jaRect = { x: bx, y: by0, w: bw, h: btnH };
    this.enRect = { x: bx, y: by0 + btnH + btnGap, w: bw, h: btnH };
    drawButton(ctx, u, this.jaRect, "日本語", { bg: COLORS.accent2, fg: "#fff", fontPx: 18 * u });
    drawButton(ctx, u, this.enRect, "English", { bg: "#3b74d0", fg: "#fff", fontPx: 18 * u });

    ctx.restore();
  }

  /** trueを返したら呼び出し元は自前のヒットテストを行わず即returnする */
  onUp(x: number, y: number): boolean {
    if (!this.open) return false;
    let picked: Lang | null = null;
    if (inRect(this.jaRect, x, y)) picked = "ja";
    else if (inRect(this.enRect, x, y)) picked = "en";
    if (picked) {
      setLang(picked);
      logEvent("lang_change", { lang: picked });
      sfxStart();
      this.open = false;
      this.onSelect?.(picked);
    }
    return true; // 開いている間は背後へタップを通さない
  }
}
