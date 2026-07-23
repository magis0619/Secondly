import type { App } from "../app.ts";
import { clamp } from "../core/math.ts";
import { COLORS } from "../game/config.ts";
import { t } from "../game/i18n.ts";
import { loadSave } from "../game/save.ts";
import { Fx } from "../fx/particles.ts";
import { drawChara } from "../render/chara.ts";
import { drawFx } from "../render/fx.ts";
import { FONT } from "../render/ui.ts";

const AUTO_CLOSE = 3.8; // 秒。タップでも閉じられる

/**
 * おうえん(tip)購入後の御礼オーバーレイ。HowToModal と同じ軽量パターン
 * (Scene ではなく StoreScene が所有し update/draw/onUp を委譲。開いている間 onUp が true でタップ吸収)。
 * マスコットが手を振り、金の紙吹雪が舞う。tipサイズが大きいほど紙吹雪を手厚くする。
 */
export class ThankYouOverlay {
  private t = 0;
  open = false;
  private intensity = 1; // 1=小 2=中 3=大(紙吹雪の量)
  private supporter = 0;
  private firstTime = false;
  private chara = "pico";
  private skin = "pink";
  private fx = new Fx();
  private confettiAcc = 0;

  constructor(private app: App) {}

  /** tipId: "tip_s"|"tip_m"|"tip_l"、supporter: 加算後の累計、firstTime: 初回おうえん(⭐解放) */
  show(tipId: string, supporter: number, firstTime: boolean): void {
    this.open = true;
    this.t = 0;
    this.confettiAcc = 0;
    this.intensity = tipId === "tip_l" ? 3 : tipId === "tip_m" ? 2 : 1;
    this.supporter = supporter;
    this.firstTime = firstTime;
    const save = loadSave();
    this.chara = save.chara;
    this.skin = save.skin;
    // 登場と同時に金のはじけ+リング
    const { w, h, unit: u } = this.app.vp;
    this.fx.burst(w / 2, h * 0.4, COLORS.gold, 20 + this.intensity * 12, 240 * u, 4.5 * u);
    this.fx.ring(w / 2, h * 0.4, COLORS.gold, 150 * u, 4 * u, 0.5);
  }

  update(dt: number): void {
    if (!this.open) return;
    this.t += dt;
    this.fx.update(dt);
    // 紙吹雪の雨(intensityで量を変える)
    const interval = 0.26 / this.intensity;
    this.confettiAcc += dt;
    if (this.t < AUTO_CLOSE - 0.5 && this.confettiAcc >= interval) {
      this.confettiAcc = 0;
      const { w, h, unit: u } = this.app.vp;
      const colors = [COLORS.gold, COLORS.accent, COLORS.accent2, "#6fdc8c", "#fff8ef"];
      const cx = w * (0.12 + Math.random() * 0.76);
      this.fx.burst(cx, h * (0.05 + Math.random() * 0.18), colors[Math.floor(Math.random() * colors.length)], 4, 90 * u, 3.2 * u);
    }
    if (this.t >= AUTO_CLOSE) this.open = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.open) return;
    const { vp } = this.app;
    const { w, h, unit: u } = vp;

    // ぽよんと登場
    const at = clamp(this.t / 0.35, 0, 1);
    const c1 = 1.70158;
    const pop = 1 + (c1 + 1) * Math.pow(at - 1, 3) + c1 * Math.pow(at - 1, 2);

    ctx.save();
    ctx.fillStyle = "rgba(5,8,18,0.82)";
    ctx.fillRect(0, 0, w, h);

    const cw = w * 0.82;
    const cx0 = w / 2 - cw / 2;
    const hasStar = this.firstTime;
    const chh = (hasStar ? 250 : 226) * u;
    const cy0 = h / 2 - chh / 2;

    ctx.save();
    ctx.translate(w / 2, cy0 + chh / 2);
    ctx.scale(clamp(pop, 0, 1.15), clamp(pop, 0, 1.15));
    ctx.translate(-w / 2, -(cy0 + chh / 2));

    ctx.fillStyle = "#1c2743";
    ctx.beginPath();
    ctx.roundRect(cx0, cy0, cw, chh, 20 * u);
    ctx.fill();
    ctx.strokeStyle = COLORS.gold;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5 * u;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // マスコットが手を振る
    const r = 30 * u;
    const wave = 0.5 + 0.5 * Math.sin(this.t * 7);
    const bob = Math.sin(this.t * 3) * 3 * u;
    ctx.save();
    ctx.translate(w / 2, cy0 + 58 * u + bob);
    drawChara(ctx, { r, u, t: this.t, chara: this.chara, skin: this.skin, pose: { armLift: wave, legTuck: 0 } });
    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // タイトル
    ctx.fillStyle = COLORS.gold;
    ctx.font = `900 ${24 * u}px ${FONT}`;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 10 * u;
    ctx.fillText(t("thanksTitle"), w / 2, cy0 + 108 * u);
    ctx.shadowBlur = 0;
    // 本文(2行)
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 ${12.5 * u}px ${FONT}`;
    const lines = t("thanksBody").split("\n");
    lines.forEach((line, i) => ctx.fillText(line, w / 2, cy0 + 136 * u + i * 18 * u));
    // 累計おうえん
    ctx.fillStyle = COLORS.gold;
    ctx.font = `700 ${12 * u}px ${FONT}`;
    ctx.fillText(t("supportCount", { n: this.supporter }), w / 2, cy0 + (hasStar ? 182 : 190) * u);
    // 初回は⭐スキン解放
    if (hasStar) {
      ctx.fillStyle = "#fff8ef";
      ctx.font = `800 ${12.5 * u}px ${FONT}`;
      ctx.fillText(t("thanksStarUnlock"), w / 2, cy0 + 208 * u);
    }
    ctx.restore(); // pop scale

    // 紙吹雪(カードの上に描く)
    drawFx(ctx, vp, this.fx);
    ctx.restore();
  }

  /** trueを返したら呼び出し元は自前のヒットテストを行わず即returnする */
  onUp(_x: number, _y: number): boolean {
    if (!this.open) return false;
    // どこをタップしても閉じる(初回御礼はしっかり見せたいので即閉じでよい)
    if (this.t > 0.4) this.open = false;
    return true;
  }
}
