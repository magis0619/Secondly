import type { App } from "../app.ts";
import type { Scene } from "../core/scene.ts";
import { TAU } from "../core/math.ts";
import { sfxStart } from "../audio/sfx.ts";
import { logEvent } from "../game/analytics.ts";
import { COLORS, TICKETS, skinColor } from "../game/config.ts";
import { currentLang, t, toggleLang } from "../game/i18n.ts";
import { ensureIdentity, getTickets } from "../game/save.ts";
import type { Rect } from "../render/ui.ts";
import { FONT, drawButton, inRect } from "../render/ui.ts";
import { startRanked } from "./adgate.ts";
import { GameScene } from "./game.ts";
import { RankingScene } from "./ranking.ts";
import { SettingsScene } from "./settings.ts";
import { SkinsScene } from "./skins.ts";
import { StoreScene } from "./store.ts";

/** タイトルのテーマ色(本編ゆうぐれゾーンの明るい版) */
const SKY = { top: "#6b4a9e", mid: "#e0704a", bottom: "#ffc46e" };
const MOUNTAIN = "#472a66";
const GROUND = "#33204d";
const INK = "#3a2260"; // ロゴの縁取り

export class HomeScene implements Scene {
  private t = 0;
  private best = 0;
  private name = "";
  private adFree = false;
  private supporter = 0;
  private skin = "pink";
  private tickets = 0;
  private skinRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private practiceRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private rankedRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private rankRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private storeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private nameRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private gearRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private langRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private app: App) {}

  enter(): void {
    const save = ensureIdentity(t("defaultNamePrefix"));
    this.best = save.best;
    this.name = save.playerName;
    this.adFree = save.adFree;
    this.supporter = save.supporter;
    this.skin = save.skin;
    this.tickets = getTickets(TICKETS.DAILY);
  }

  update(dt: number): void {
    this.t += dt;
  }

  // ==================== 背景 ====================

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    const { w, h, unit: u } = this.app.vp;
    // 夕焼けグラデ
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, SKY.top);
    g.addColorStop(0.55, SKY.mid);
    g.addColorStop(0.85, SKY.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 大きな太陽(にじむ光つき)
    const sx = w * 0.84;
    const sy = h * 0.415;
    ctx.fillStyle = "rgba(255,220,150,0.35)";
    ctx.beginPath();
    ctx.arc(sx, sy, 58 * u, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffdf8e";
    ctx.beginPath();
    ctx.arc(sx, sy, 36 * u, 0, TAU);
    ctx.fill();

    // ふわふわ雲(ゆっくり流れる)
    ctx.fillStyle = "rgba(255,245,235,0.5)";
    const clouds: [number, number, number][] = [
      [0.16, 40, 1.0],
      [0.30, 90, 0.8],
      [0.44, 160, 1.15],
    ];
    for (let i = 0; i < clouds.length; i++) {
      const [hy, off, sc] = clouds[i];
      const cx = ((off + this.t * (7 + i * 4) * u) % (w + 220 * u)) - 110 * u;
      const cy = h * hy;
      for (const [ox, oy, r] of [[0, 0, 26], [22, -7, 19], [-23, -4, 17], [9, 7, 21]] as const) {
        ctx.beginPath();
        ctx.arc(cx + ox * sc * u, cy + oy * sc * u, r * sc * u, 0, TAU);
        ctx.fill();
      }
    }

    // 山なみ2層+地面(ボタンの下地になる濃い帯)
    const ridge = (baseY: number, amp: number, seedStep: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, h + 10);
      for (let x = 0; x <= w; x += w / 7) {
        const k = Math.floor(x / (w / 7)) + seedStep;
        const bump = (Math.sin(k * 12.9898) * 43758.5453) % 1;
        ctx.lineTo(x, baseY - (12 + Math.abs(bump) * amp) * u);
      }
      ctx.lineTo(w, h + 10);
      ctx.fill();
    };
    ridge(h * 0.62, 70, 3, "rgba(90,50,130,0.45)");
    ridge(h * 0.66, 55, 11, MOUNTAIN);
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, h * 0.72, w, h);
  }

  // ==================== ロゴ ====================

  private drawLogo(ctx: CanvasRenderingContext2D): void {
    const { w, h, unit: u } = this.app.vp;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    // 1行目(JA=「のぼれ!」/ EN=「CLIMB」): 1文字ずつ時間差でぷよん
    const ja = currentLang() === "ja";
    const word = ja ? "のぼれ!" : "CLIMB";
    const lw = (ja ? 52 : 44) * u;
    const x0 = w / 2 - ((word.length - 1) * lw) / 2;
    const baseY = h * 0.105;
    for (let i = 0; i < word.length; i++) {
      const bounce = Math.max(0, Math.sin(this.t * 2.6 - i * 0.55));
      const rot = Math.sin(this.t * 1.4 + i * 1.7) * 0.05;
      ctx.save();
      ctx.translate(x0 + i * lw, baseY - bounce * 9 * u);
      ctx.rotate(rot);
      ctx.font = `900 ${(ja ? 46 : 50) * u}px ${FONT}`;
      // 落ち影 → 縁取り → 白文字
      ctx.fillStyle = "rgba(58,34,96,0.35)";
      ctx.fillText(word[i], 3 * u, 4 * u);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 9 * u;
      ctx.strokeText(word[i], 0, 0);
      ctx.fillStyle = "#fff8ef";
      ctx.fillText(word[i], 0, 0);
      ctx.restore();
    }

    // 2行目(JA=「30びょう」/ EN=「30」): ゴールドのバッジ風(ゆらゆら)
    ctx.save();
    ctx.translate(w / 2, h * 0.195);
    ctx.rotate(-0.06 + Math.sin(this.t * 1.8) * 0.025);
    const badge = (text: string, px: number, py: number, size: number) => {
      ctx.font = `900 ${size * u}px ${FONT}`;
      ctx.fillStyle = "rgba(58,34,96,0.35)";
      ctx.fillText(text, px + 4 * u, py + 5 * u);
      ctx.strokeStyle = "#fff8ef";
      ctx.lineWidth = Math.max(size * 0.17, 6) * u;
      ctx.strokeText(text, px, py);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(size * 0.065, 2.6) * u;
      ctx.strokeText(text, px, py);
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(text, px, py);
    };
    if (ja) {
      badge("30", -54 * u, 0, 58);
      badge("びょう", 40 * u, 7 * u, 30);
    } else {
      badge("30", 0, 0, 64);
    }
    ctx.restore();

    // キャッチコピー
    const tag = t("tagline");
    ctx.font = `800 ${14 * u}px ${FONT}`;
    ctx.strokeStyle = "rgba(58,34,96,0.55)";
    ctx.lineWidth = 4 * u;
    ctx.strokeText(tag, w / 2, h * 0.255);
    ctx.fillStyle = "#fff8ef";
    ctx.fillText(tag, w / 2, h * 0.255);
  }

  // ==================== マスコット ====================

  private drawMascot(ctx: CanvasRenderingContext2D): void {
    const { w, h, unit: u } = this.app.vp;
    const px = w / 2;
    const platY = h * 0.54;
    const r = 30 * u;

    // 浮かぶ足場(草つき)
    const pw = 150 * u;
    ctx.fillStyle = "rgba(58,34,96,0.35)";
    ctx.beginPath();
    ctx.roundRect(px - pw / 2 + 3 * u, platY + 4 * u, pw, 20 * u, 10 * u);
    ctx.fill();
    ctx.fillStyle = "#5d4a94";
    ctx.beginPath();
    ctx.roundRect(px - pw / 2, platY, pw, 20 * u, 10 * u);
    ctx.fill();
    ctx.fillStyle = "#8a76c9";
    ctx.beginPath();
    ctx.roundRect(px - pw / 2, platY, pw, 6 * u, [10 * u, 10 * u, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = "#5a8c4a";
    ctx.lineWidth = 2 * u;
    for (const gx of [-0.32, 0.08, 0.38]) {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(px + gx * pw + i * 4 * u, platY);
        ctx.quadraticCurveTo(px + gx * pw + i * 6 * u, platY - 6 * u, px + gx * pw + i * 8 * u, platY - 9 * u);
        ctx.stroke();
      }
    }

    // きせかえボタン(足場の右横)
    this.skinRect = { x: px + pw / 2 + 8 * u, y: platY - 8 * u, w: 82 * u, h: 32 * u };
    drawButton(ctx, u, this.skinRect, t("skinsBtn"), { bg: "#fff8ef", fg: "#5a3a8c", fontPx: 10.5 * u, depth: 3 });

    // ぴょんぴょん跳ねるキャラ(本編と同じ見た目を大きく)
    const hop = Math.abs(Math.sin(this.t * 2.3));
    const grounded = hop < 0.22;
    const sq = grounded ? (0.22 - hop) / 0.22 : 0;
    const sy = 1 - sq * 0.22 + (grounded ? 0 : 0.06 * hop);
    const sx = 1 + sq * 0.18 - (grounded ? 0 : 0.04 * hop);
    const armLift = Math.max(0, (hop - 0.25) / 0.75);
    const blink = Math.sin(this.t * 0.9 + 2) > 0.985;

    ctx.save();
    ctx.translate(px, platY - r - 5 * u - hop * 40 * u);
    ctx.scale(sx, sy);

    // 腕
    ctx.strokeStyle = COLORS.player;
    ctx.lineCap = "round";
    ctx.lineWidth = 8 * u;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.7, -r * 0.05);
      ctx.lineTo(s * r * (1.05 + 0.12 * armLift), -r * 0.05 - armLift * r * 0.95);
      ctx.stroke();
    }
    // 脚
    ctx.lineWidth = 9 * u;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.35, r * 0.85);
      ctx.lineTo(s * r * 0.42, r * (1.25 - armLift * 0.3));
      ctx.stroke();
    }
    // 体
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.roundRect(-r * 0.82, -r, r * 1.64, r * 2, r * 0.72);
    ctx.fill();
    // バンダナ+しっぽ(きせかえ反映)
    ctx.fillStyle = skinColor(this.skin, this.t);
    ctx.fillRect(-r * 0.82, -r * 0.72, r * 1.64, r * 0.3);
    const wob = Math.sin(this.t * 9) * 3.5 * u;
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.6);
    ctx.quadraticCurveTo(r * 1.3, -r * 0.5 + wob, r * 1.7, -r * 0.2 + wob * 1.4);
    ctx.quadraticCurveTo(r * 1.25, -r * 0.28, r * 0.75, -r * 0.38);
    ctx.fill();
    // 目とほっぺ
    ctx.fillStyle = "#1c2743";
    for (const s of [-1, 1]) {
      if (blink) {
        ctx.fillRect(s * r * 0.28 - r * 0.14, -r * 0.22, r * 0.28, 2 * u);
      } else {
        ctx.beginPath();
        ctx.arc(s * r * 0.28, -r * 0.22, r * 0.14, 0, TAU);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(255,79,163,0.4)";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.52, r * 0.05, r * 0.13, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==================== 全体 ====================

  draw(ctx: CanvasRenderingContext2D): void {
    const { vp } = this.app;
    const { w, h, unit: u } = vp;

    this.drawBackdrop(ctx);
    ctx.save();
    this.drawMascot(ctx);
    this.drawLogo(ctx);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // プレイヤー名(タップで変更)。支援者は⭐
    this.nameRect = { x: w / 2 - 110 * u, y: h * 0.285, w: 220 * u, h: 30 * u };
    ctx.font = `800 ${13 * u}px ${FONT}`;
    const nameLabel = `${this.supporter > 0 ? "⭐ " : ""}${this.name} ✏️`;
    ctx.strokeStyle = "rgba(58,34,96,0.5)";
    ctx.lineWidth = 3.5 * u;
    ctx.strokeText(nameLabel, w / 2, this.nameRect.y + 15 * u);
    ctx.fillStyle = "#fff2df";
    ctx.fillText(nameLabel, w / 2, this.nameRect.y + 15 * u);

    if (this.best > 0) {
      const bestText = `👑 ${t("bestLabel")} ${this.best}m`;
      ctx.font = `900 ${15 * u}px ${FONT}`;
      ctx.strokeStyle = "rgba(58,34,96,0.55)";
      ctx.lineWidth = 4 * u;
      ctx.strokeText(bestText, w / 2, h * 0.335);
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(bestText, w / 2, h * 0.335);
    }

    // 左上: 言語切り替え / 右上: 設定
    this.langRect = { x: 10 * u, y: vp.safeTop + 10 * u, w: 86 * u, h: 30 * u };
    this.gearRect = { x: w - 46 * u, y: vp.safeTop + 10 * u, w: 36 * u, h: 36 * u };
    drawButton(ctx, u, this.langRect, t("langPill"), { bg: "rgba(58,34,96,0.55)", fg: "#fff2df", fontPx: 10.5 * u, depth: 2 });
    ctx.font = `800 ${20 * u}px ${FONT}`;
    ctx.fillStyle = "rgba(255,242,223,0.9)";
    ctx.fillText("⚙", this.gearRect.x + 18 * u, this.gearRect.y + 18 * u);

    // ボタン(座標は従来のまま。ふわっと浮遊)
    const floatY = Math.sin(this.t * 1.7) * 2 * u;
    const bw = 250 * u;
    const bx = w / 2 - bw / 2;
    this.practiceRect = { x: bx, y: h * 0.6, w: bw, h: 50 * u };
    this.rankedRect = { x: bx, y: h * 0.6 + 64 * u, w: bw, h: 56 * u };
    ctx.save();
    ctx.translate(0, floatY);
    drawButton(ctx, u, this.practiceRect, t("practice"), { bg: "#43d9a3", fg: "#0c3527", fontPx: 17 * u });
    drawButton(ctx, u, this.rankedRect, t("ranked"), { bg: COLORS.accent2, fg: "#fff", fontPx: 19 * u });
    ctx.restore();
    // チケット表示(常に1行。レイアウトを固定するため)
    let rowY = this.rankedRect.y + this.rankedRect.h + 12 * u;
    ctx.font = `800 ${10.5 * u}px ${FONT}`;
    ctx.fillStyle = "rgba(255,242,223,0.9)";
    ctx.fillText(
      this.adFree ? t("ticketsUnlimited") : t("ticketsLeft", { n: this.tickets, r: TICKETS.AD_REWARD }),
      w / 2,
      rowY,
    );
    rowY += 20 * u;
    const half = (bw - 10 * u) / 2;
    this.rankRect = { x: bx, y: rowY, w: half, h: 44 * u };
    this.storeRect = { x: bx + half + 10 * u, y: rowY, w: half, h: 44 * u };
    drawButton(ctx, u, this.rankRect, t("rankingBtn"), { bg: "#7a5cc9", fg: "#fff", fontPx: 12.5 * u });
    drawButton(ctx, u, this.storeRect, t("storeBtn"), { bg: "#f5a03c", fg: "#4a2c00", fontPx: 12.5 * u });
    ctx.restore();
  }

  onUp(x: number, y: number): void {
    if (inRect(this.practiceRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new GameScene(this.app, "practice"));
    } else if (inRect(this.rankedRect, x, y)) {
      sfxStart();
      // 無制限(広告除去) or チケット消費で即開始 / チケット切れなら補充画面へ
      startRanked(this.app);
    } else if (inRect(this.skinRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new SkinsScene(this.app));
    } else if (inRect(this.rankRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new RankingScene(this.app));
    } else if (inRect(this.storeRect, x, y)) {
      sfxStart();
      this.app.manager.switchTo(new StoreScene(this.app));
    } else if (inRect(this.langRect, x, y)) {
      sfxStart();
      const lang = toggleLang();
      logEvent("lang_change", { lang });
    } else if (inRect(this.gearRect, x, y) || inRect(this.nameRect, x, y)) {
      sfxStart();
      // 名前の変更は設定画面へ集約
      this.app.manager.switchTo(new SettingsScene(this.app));
    }
  }
}
