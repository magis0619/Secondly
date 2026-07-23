import type { App } from "../app.ts";
import { clamp } from "../core/math.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import { t } from "../game/i18n.ts";
import { markHowtoSeen } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";

const ITEMS: { icon: string; color: string; text: () => string }[] = [
  { icon: "👉", color: COLORS.accent, text: () => t("howto1") },
  { icon: "🪜", color: COLORS.accent2, text: () => t("howto2") },
  { icon: "💥", color: COLORS.danger, text: () => t("howto3") },
  { icon: "⏱️", color: COLORS.gold, text: () => t("howto4") },
  { icon: "🔥", color: "#ff8a3c", text: () => t("howto5") },
  { icon: "🌏", color: "#43d9a3", text: () => t("howto6") },
];

/**
 * 「あそびかた」の1画面ポップアップ。Scene本体ではなく、各シーン(Home/Settings)が
 * インスタンスを持って draw()/update()/onUp() を委譲する軽量オーバーレイ。
 * 初回起動時はHomeが自動でshow()し、以後はSettingsからいつでも開ける。
 */
export class HowToModal {
  private t = 0;
  open = false;
  private closeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

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
    const { w, h, unit: u, safeTop, safeBottom } = vp;

    // ぽよんと登場(オーバーシュート付き)
    const at = clamp(this.t / 0.35, 0, 1);
    const c1 = 1.70158;
    const pop = 1 + (c1 + 1) * Math.pow(at - 1, 3) + c1 * Math.pow(at - 1, 2);

    ctx.save();
    ctx.fillStyle = "rgba(5,8,18,0.75)";
    ctx.fillRect(0, 0, w, h);

    const cw = w * 0.88;
    const cx0 = w / 2 - cw / 2;
    const btnH = 50 * u;
    const rowH = 56 * u;
    const available = h - safeTop - safeBottom - 40 * u;
    // 内容ぶんの高さ(タイトル+6行+ボタン)。画面が小さい時だけ縮めて収める
    const desired = 62 * u + rowH * ITEMS.length + 24 * u + btnH + 14 * u;
    const chh = Math.min(desired, available);
    const cy0 = safeTop + 20 * u + (available - chh) / 2;

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

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.gold;
    ctx.font = `900 ${20 * u}px ${FONT}`;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 10 * u;
    ctx.fillText(t("howtoTitle"), w / 2, cy0 + 32 * u);
    ctx.shadowBlur = 0;

    const listTop = cy0 + 62 * u;

    ITEMS.forEach((item, i) => {
      const ry = listTop + i * rowH;
      const midY = ry + rowH / 2;
      // アイコンの丸
      ctx.fillStyle = item.color;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(cx0 + 34 * u, midY, 17 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = `${17 * u}px ${FONT}`;
      ctx.fillText(item.icon, cx0 + 34 * u, midY + 1 * u);

      // テキスト(\nで最大2行)
      const lines = item.text().split("\n");
      ctx.textAlign = "left";
      ctx.fillStyle = COLORS.text;
      ctx.font = `700 ${11.5 * u}px ${FONT}`;
      const lineH = 15 * u;
      const startY = midY - ((lines.length - 1) * lineH) / 2;
      lines.forEach((line, li) => ctx.fillText(line, cx0 + 60 * u, startY + li * lineH));
      ctx.textAlign = "center";
    });

    this.closeRect = { x: cx0 + 20 * u, y: cy0 + chh - btnH - 14 * u, w: cw - 40 * u, h: btnH };
    drawButton(ctx, u, this.closeRect, t("close"), { bg: COLORS.accent2, fg: "#fff", fontPx: 16 * u });
    ctx.restore();
  }

  /** trueを返したら呼び出し元は自前のヒットテストを行わず即returnする */
  onUp(x: number, y: number): boolean {
    if (!this.open) return false;
    if (inRect(this.closeRect, x, y)) {
      sfxStart();
      this.open = false;
      markHowtoSeen();
    }
    return true; // 開いている間は背後のボタンへタップを通さない
  }

  constructor(private app: App) {}
}
