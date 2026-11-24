import type { App } from "../app.ts";
import { clamp } from "../core/math.ts";
import { sfxBest, sfxStart } from "../audio/sfx.ts";
import { COLORS, SKINS, STREAK } from "../game/config.ts";
import { t } from "../game/i18n.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";

export interface StreakInfo {
  streak: number;
  bestStreak: number;
  /** 今日もらったチケット(0なら表示しない。広告除去済みなど不要な時も0で渡す) */
  bonus: number;
  unlockedFlame: boolean;
}

/**
 * 連続ログインの案内オーバーレイ。HowToModal/LanguagePickerModal と同じ軽量パターン
 * (Homeが所有しdraw/update/onUpを委譲。開いている間はonUpがtrueでタップを吸収)。
 * 起動後の初回表示(ボーナス獲得時)と、ホームの🔥チップのタップ(確認用)の両方で使う。
 */
export class StreakModal {
  private t = 0;
  open = false;
  private info: StreakInfo = { streak: 0, bestStreak: 0, bonus: 0, unlockedFlame: false };
  private closeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private app: App) {}

  show(info: StreakInfo, celebrate: boolean): void {
    this.info = info;
    this.open = true;
    this.t = 0;
    if (celebrate) sfxBest();
  }

  update(dt: number): void {
    if (this.open) this.t += dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.open) return;
    const { w, h, unit: u } = this.app.vp;
    const { streak, bestStreak, bonus, unlockedFlame } = this.info;

    const at = clamp(this.t / 0.35, 0, 1);
    const c1 = 1.70158;
    const pop = 1 + (c1 + 1) * Math.pow(at - 1, 3) + c1 * Math.pow(at - 1, 2);

    ctx.save();
    ctx.fillStyle = "rgba(5,8,18,0.8)";
    ctx.fillRect(0, 0, w, h);

    const cw = Math.min(w * 0.86, 330 * u);
    const chh = 332 * u;
    const cx0 = w / 2 - cw / 2;
    const cy0 = h / 2 - chh / 2;
    ctx.translate(w / 2, h / 2);
    ctx.scale(clamp(pop, 0, 1.12), clamp(pop, 0, 1.12));
    ctx.translate(-w / 2, -h / 2);

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
    ctx.fillText(t("streakTitle"), w / 2, cy0 + 32 * u);

    // 大きな連続日数
    ctx.fillStyle = COLORS.text;
    ctx.font = `900 ${30 * u}px ${FONT}`;
    ctx.shadowColor = "#ff7a2f";
    ctx.shadowBlur = 14 * u;
    ctx.fillText(t("streakDays", { n: streak }), w / 2, cy0 + 76 * u);
    ctx.shadowBlur = 0;

    // 1週間ぶんの丸(今週の何日目か)。WEEKの倍数日は大きなご褒美なので最後の丸を金色に
    const inWeek = ((streak - 1) % STREAK.WEEK) + 1;
    const dotR = 13 * u;
    const gap = (cw - 48 * u - dotR * 2) / (STREAK.WEEK - 1);
    for (let i = 0; i < STREAK.WEEK; i++) {
      const dx = cx0 + 24 * u + dotR + i * gap;
      const dy = cy0 + 124 * u;
      const done = i < inWeek;
      const last = i === STREAK.WEEK - 1;
      ctx.fillStyle = done ? (last ? COLORS.gold : "#ff7a2f") : "#2a3556";
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
      ctx.fill();
      if (i === inWeek - 1) {
        ctx.strokeStyle = "#fff8ef";
        ctx.lineWidth = 2.5 * u;
        ctx.stroke();
      }
      ctx.fillStyle = done ? "#2b1600" : COLORS.textDim;
      ctx.font = `900 ${10.5 * u}px ${FONT}`;
      ctx.fillText(last ? "🎟" : String(i + 1), dx, dy + 1 * u);
    }

    // 今日のごほうび / 次の目標
    let y = cy0 + 170 * u;
    if (unlockedFlame) {
      ctx.fillStyle = "#ff9a55";
      ctx.font = `900 ${14 * u}px ${FONT}`;
      ctx.fillText(t("streakUnlock"), w / 2, y);
      y += 26 * u;
    }
    if (bonus > 0) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = `900 ${15 * u}px ${FONT}`;
      ctx.fillText(t("streakBonus", { n: bonus }), w / 2, y);
      y += 26 * u;
    }
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 ${11.5 * u}px ${FONT}`;
    const flameDays = SKINS.find((k) => k.id === "flame")?.cond.n ?? 7;
    if (bestStreak < flameDays) {
      ctx.fillText(t("streakNextFlame", { d: flameDays - bestStreak }), w / 2, y);
    } else {
      ctx.fillText(t("streakNextWeek", { w: STREAK.WEEK, n: STREAK.WEEK_BONUS }), w / 2, y);
    }
    ctx.fillText(t("streakKeep"), w / 2, y + 22 * u);

    this.closeRect = { x: w / 2 - 80 * u, y: cy0 + chh - 62 * u, w: 160 * u, h: 44 * u };
    drawButton(ctx, u, this.closeRect, t("close"), { bg: COLORS.accent, fontPx: 15 * u });
    ctx.restore();
  }

  /** trueを返したら呼び出し元は自前のヒットテストを行わず即returnする */
  onUp(x: number, y: number): boolean {
    if (!this.open) return false;
    if (this.t > 0.25 && inRect(this.closeRect, x, y)) {
      sfxStart();
      this.open = false;
    }
    return true; // 開いている間は背後へタップを通さない
  }
}
