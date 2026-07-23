import type { App } from "../app.ts";
import { clamp } from "../core/math.ts";
import { sfxStart } from "../audio/sfx.ts";
import { COLORS } from "../game/config.ts";
import { t } from "../game/i18n.ts";
import { markHowtoSeen } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";

type Item = { icon: string; color: string; text: () => string; demo?: boolean };

/** 6項目を2ページに分割。1ページ目の先頭だけ絵文字の代わりに図解(drawTapDemo)を描く */
const PAGES: Item[][] = [
  [
    { icon: "👉", color: COLORS.accent, text: () => t("howtoTap"), demo: true },
    { icon: "💥", color: COLORS.danger, text: () => t("howto3") },
    { icon: "⏱️", color: COLORS.gold, text: () => t("howto4") },
  ],
  [
    { icon: "🔥", color: "#ff8a3c", text: () => t("howto5") },
    { icon: "🌏", color: "#43d9a3", text: () => t("howto6") },
  ],
];

/** 「あしばがある側をタップ」の図解。画面を左右に見立て、右側(タップすべき側)を光らせ、
 * 今いる足場→つぎの足場へ矢印を引き、タップ波紋を添える。文章より一目で伝わるように */
function drawTapDemo(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number): void {
  const w = 132 * u;
  const h = 76 * u;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  ctx.save();

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 10 * u);
  ctx.stroke();

  // タップすべき右半分をハイライト
  ctx.fillStyle = "rgba(124,214,255,0.16)";
  ctx.beginPath();
  ctx.roundRect(cx, y0, w / 2, h, [0, 10 * u, 10 * u, 0]);
  ctx.fill();

  ctx.setLineDash([4 * u, 4 * u]);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.moveTo(cx, y0 + 4 * u);
  ctx.lineTo(cx, y0 + h - 4 * u);
  ctx.stroke();
  ctx.setLineDash([]);

  // 足場(左下=今いる場所、右上=つぎの足場)
  const barW = 34 * u;
  const barH = 9 * u;
  const leftBar = { x: x0 + 10 * u, y: y0 + h - 22 * u };
  const rightBar = { x: x0 + w - barW - 10 * u, y: y0 + 13 * u };
  ctx.fillStyle = "#8a76c9";
  for (const b of [leftBar, rightBar]) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, barW, barH, 4 * u);
    ctx.fill();
  }

  // キャラ(左足場の上のまる)
  const charaX = leftBar.x + barW / 2;
  const charaY = leftBar.y - 9 * u;
  ctx.fillStyle = "#fff2df";
  ctx.beginPath();
  ctx.arc(charaX, charaY, 8 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a2260";
  for (const dx of [-2.6, 2.6]) {
    ctx.beginPath();
    ctx.arc(charaX + dx * u, charaY - 1 * u, 1.3 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // 矢印(キャラ → つぎの足場)
  const tipX = rightBar.x + barW / 2 - 5 * u;
  const tipY = rightBar.y + barH + 7 * u;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2.4 * u;
  ctx.beginPath();
  ctx.moveTo(charaX + 6 * u, charaY - 5 * u);
  ctx.quadraticCurveTo(cx, y0 + 4 * u, tipX, tipY);
  ctx.stroke();
  const ang = Math.atan2(tipY - (y0 + 4 * u), tipX - cx);
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(ang - 0.25);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-6 * u, -2.2 * u);
  ctx.lineTo(-6 * u, 2.2 * u);
  ctx.closePath();
  ctx.fillStyle = COLORS.gold;
  ctx.fill();
  ctx.restore();

  // タップ波紋(右半分の下)
  const tapX = x0 + w * 0.74;
  const tapY = y0 + h - 14 * u;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.6 * u;
  for (const rr of [5, 9]) {
    ctx.globalAlpha = rr === 5 ? 0.9 : 0.4;
    ctx.beginPath();
    ctx.arc(tapX, tapY, rr * u, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(tapX, tapY, 2.4 * u, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 「あそびかた」の2ページポップアップ。Scene本体ではなく、各シーン(Home/Settings)が
 * インスタンスを持って draw()/update()/onUp() を委譲する軽量オーバーレイ。
 * 初回起動時はHomeが自動でshow()し、以後はSettingsからいつでも開ける。
 * 1ページ目は「つぎへ」のみ、2ページ目で「とじる」を出す(両方見てから閉じる動線)。
 */
export class HowToModal {
  private t = 0;
  open = false;
  private page = 0;
  private nextRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private closeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  show(): void {
    this.open = true;
    this.page = 0;
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

    const items = PAGES[this.page];
    const cw = w * 0.88;
    const cx0 = w / 2 - cw / 2;
    const btnH = 50 * u;
    const demoRowH = 96 * u;
    const rowH = 60 * u;
    const dotsH = 20 * u;
    const contentH = items.reduce((s, it) => s + (it.demo ? demoRowH : rowH), 0);
    const desired = 58 * u + contentH + dotsH + 16 * u + btnH + 14 * u;
    const available = h - safeTop - safeBottom - 40 * u;
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
    ctx.font = `900 ${19 * u}px ${FONT}`;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 10 * u;
    ctx.fillText(t("howtoTitle"), w / 2, cy0 + 26 * u);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${11.5 * u}px ${FONT}`;
    const pageLabel = this.page === 0 ? t("howtoPage1") : t("howtoPage2");
    ctx.fillText(`${this.page + 1}/${PAGES.length} · ${pageLabel}`, w / 2, cy0 + 44 * u);

    let ry = cy0 + 58 * u;
    items.forEach((item) => {
      const rh = item.demo ? demoRowH : rowH;
      const midY = ry + rh / 2;

      if (item.demo) {
        drawTapDemo(ctx, cx0 + cw / 2, ry + 40 * u, u);
        ctx.textAlign = "center";
        ctx.fillStyle = COLORS.text;
        ctx.font = `800 ${13 * u}px ${FONT}`;
        ctx.fillText(item.text(), cx0 + cw / 2, ry + 84 * u);
      } else {
        ctx.fillStyle = item.color;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(cx0 + 40 * u, midY, 20 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.textAlign = "center";
        ctx.font = `${20 * u}px ${FONT}`;
        ctx.fillText(item.icon, cx0 + 40 * u, midY + 1 * u);

        const lines = item.text().split("\n");
        ctx.textAlign = "left";
        ctx.fillStyle = COLORS.text;
        ctx.font = `700 ${12.5 * u}px ${FONT}`;
        const lineH = 16 * u;
        const startY = midY - ((lines.length - 1) * lineH) / 2;
        lines.forEach((line, li) => ctx.fillText(line, cx0 + 72 * u, startY + li * lineH));
        ctx.textAlign = "center";
      }
      ry += rh;
    });

    // ページドット
    const dotY = ry + 10 * u;
    const dotGap = 16 * u;
    const dotsX0 = cx0 + cw / 2 - ((PAGES.length - 1) * dotGap) / 2;
    PAGES.forEach((_, i) => {
      ctx.beginPath();
      ctx.fillStyle = i === this.page ? COLORS.gold : "rgba(255,255,255,0.28)";
      ctx.arc(dotsX0 + i * dotGap, dotY, i === this.page ? 4.5 * u : 3.5 * u, 0, Math.PI * 2);
      ctx.fill();
    });

    const btnY = cy0 + chh - btnH - 14 * u;
    const totalBtnW = cw - 40 * u;
    if (this.page < PAGES.length - 1) {
      this.nextRect = { x: cx0 + 20 * u, y: btnY, w: totalBtnW, h: btnH };
      this.backRect = { x: 0, y: 0, w: 0, h: 0 };
      this.closeRect = { x: 0, y: 0, w: 0, h: 0 };
      drawButton(ctx, u, this.nextRect, t("next"), { bg: COLORS.accent2, fg: "#fff", fontPx: 16 * u });
    } else {
      const gap = 10 * u;
      const backW = totalBtnW * 0.34;
      const closeW = totalBtnW - gap - backW;
      this.nextRect = { x: 0, y: 0, w: 0, h: 0 };
      this.backRect = { x: cx0 + 20 * u, y: btnY, w: backW, h: btnH };
      this.closeRect = { x: cx0 + 20 * u + backW + gap, y: btnY, w: closeW, h: btnH };
      drawButton(ctx, u, this.backRect, t("back"), { bg: "#25314f", fg: COLORS.text, fontPx: 13 * u });
      drawButton(ctx, u, this.closeRect, t("close"), { bg: COLORS.accent2, fg: "#fff", fontPx: 15 * u });
    }
    ctx.restore();
  }

  /** trueを返したら呼び出し元は自前のヒットテストを行わず即returnする */
  onUp(x: number, y: number): boolean {
    if (!this.open) return false;
    if (this.page < PAGES.length - 1) {
      if (inRect(this.nextRect, x, y)) {
        sfxStart();
        this.page++;
        this.t = 0;
      }
    } else {
      if (inRect(this.backRect, x, y)) {
        sfxStart();
        this.page--;
        this.t = 0;
      } else if (inRect(this.closeRect, x, y)) {
        sfxStart();
        this.open = false;
        markHowtoSeen();
      }
    }
    return true; // 開いている間は背後のボタンへタップを通さない
  }

  constructor(private app: App) {}
}
