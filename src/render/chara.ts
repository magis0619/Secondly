/**
 * キャラクター描画の共通化。game(プレイ中)/home(マスコット)/skins(一覧)の3箇所から使う。
 * 呼び出し側で translate(位置) と rotate を済ませてから呼ぶ。scale(sx,sy)はここで掛ける。
 * キャラ(体型・パーツ)とバンダナ(色)は独立して組み合わせられる。
 */
import { TAU } from "../core/math.ts";
import { COLORS, skinColor } from "../game/config.ts";

export interface CharaPose {
  /** つぶれ/のび */
  sx: number;
  sy: number;
  /** 0=腕を下ろす 1=ばんざい */
  armLift: number;
  /** 0=脚を伸ばす 1=たたむ(ホップ中) */
  legTuck: number;
  /** 落下中(目がぐるぐる) */
  falling: boolean;
  /** 目線(-1=左 0=正面 +1=右) */
  nextDir: number;
  /** フィーバー中(虹色オーラ) */
  fever: boolean;
}

const IDLE: CharaPose = { sx: 1, sy: 1, armLift: 0, legTuck: 0, falling: false, nextDir: 0, fever: false };

/** キャラごとの体色(ピコは従来のCOLORS.player) */
function bodyColor(chara: string): string {
  switch (chara) {
    case "neko":
      return "#ffedd6";
    case "obake":
      return "#e6ecff";
    case "pengin":
      return "#37426b";
    default:
      return COLORS.player;
  }
}

export function drawChara(
  ctx: CanvasRenderingContext2D,
  opts: { r: number; u: number; t: number; chara: string; skin: string; pose?: Partial<CharaPose> },
): void {
  const { r, u, t, chara, skin } = opts;
  const pose: CharaPose = { ...IDLE, ...opts.pose };
  const { sx, sy, armLift, legTuck, falling, nextDir, fever } = pose;
  const body = bodyColor(chara);
  const dark = "#1c2743";
  const blink = !falling && Math.sin(t * 0.9 + 2) > 0.985;
  const ghost = chara === "obake";

  ctx.save();
  ctx.scale(sx, sy);
  if (ghost) {
    // ふわふわ浮遊+わずかに透ける
    ctx.translate(0, Math.sin(t * 2.4) * 2 * u);
    ctx.globalAlpha *= 0.92;
  }

  // 腕(おばけは短め、ペンギンは羽)
  ctx.strokeStyle = body;
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.3;
  const armLen = chara === "obake" ? 0.55 : 0.9;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (chara === "pengin") {
      // 羽: 体に沿って下向き、ばんざいで少し開く
      ctx.moveTo(s * r * 0.72, -r * 0.15);
      ctx.lineTo(s * r * (0.95 + 0.25 * armLift), r * 0.45 - armLift * r * 0.9);
    } else {
      ctx.moveTo(s * r * 0.7, -r * 0.05);
      ctx.lineTo(s * r * (1.05 + 0.1 * armLift), -r * 0.05 - armLift * r * armLen);
    }
    ctx.stroke();
  }

  // 脚(おばけは無し、ペンギンはオレンジの短い脚)
  if (!ghost) {
    ctx.strokeStyle = chara === "pengin" ? "#ff9d3c" : body;
    ctx.lineWidth = r * 0.32;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.35, r * 0.85);
      ctx.lineTo(s * r * 0.42, r * (1.25 - legTuck * 0.35));
      ctx.stroke();
    }
  }

  // ネコのしっぽ(体の後ろで揺れる細いカーブ)
  if (chara === "neko") {
    ctx.strokeStyle = body;
    ctx.lineWidth = r * 0.18;
    const sw = Math.sin(t * 3.1) * 0.2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, r * 0.75);
    ctx.quadraticCurveTo(-r * 1.35, r * (0.65 + sw), -r * (1.45 + sw * 0.3), -r * 0.1);
    ctx.stroke();
  }

  // 体(フィーバー中は虹色のオーラ)
  ctx.fillStyle = body;
  ctx.shadowColor = fever ? `hsl(${Math.floor((t * 400) % 360)}, 95%, 60%)` : COLORS.accent;
  ctx.shadowBlur = (fever ? 20 : 10) * u;
  ctx.beginPath();
  if (ghost) {
    // 下すぼみのおばけボディ(裾が3つの波)
    const w = r * 0.82;
    ctx.moveTo(-w, r * 0.75);
    ctx.quadraticCurveTo(-w, -r, 0, -r);
    ctx.quadraticCurveTo(w, -r, w, r * 0.75);
    for (let i = 0; i < 3; i++) {
      const x0 = w - ((i + 0) * 2 * w) / 3;
      const x1 = w - ((i + 1) * 2 * w) / 3;
      ctx.quadraticCurveTo((x0 + x1) / 2, r * (1.05 + 0.06 * Math.sin(t * 3 + i)), x1, r * 0.75);
    }
    ctx.closePath();
  } else {
    ctx.roundRect(-r * 0.82, -r, r * 1.64, r * 2, r * 0.72);
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // ネコの耳(体の上に三角×2、内側ピンク)
  if (chara === "neko") {
    for (const s of [-1, 1]) {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(s * r * 0.2, -r * 0.92);
      ctx.lineTo(s * r * 0.72, -r * 0.9);
      ctx.lineTo(s * r * 0.48, -r * 1.38);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffb3c9";
      ctx.beginPath();
      ctx.moveTo(s * r * 0.34, -r * 0.95);
      ctx.lineTo(s * r * 0.62, -r * 0.94);
      ctx.lineTo(s * r * 0.49, -r * 1.2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ペンギンの白いおなか(バンダナより先に描いて上から巻く)
  if (chara === "pengin") {
    ctx.fillStyle = "#f4f7ff";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.35, r * 0.58, r * 0.62, 0, 0, TAU);
    ctx.fill();
  }

  // バンダナ(きせかえ)+なびくむすび目
  ctx.fillStyle = skinColor(skin, t);
  if (ghost) {
    ctx.fillRect(-r * 0.8, -r * 0.72, r * 1.6, r * 0.3);
  } else {
    ctx.fillRect(-r * 0.82, -r * 0.72, r * 1.64, r * 0.3);
  }
  const wob = Math.sin(t * 9) * 3 * u;
  ctx.beginPath();
  ctx.moveTo(r * 0.7, -r * 0.6);
  ctx.quadraticCurveTo(r * 1.3, -r * 0.5 + wob, r * 1.7, -r * 0.2 + wob * 1.4);
  ctx.quadraticCurveTo(r * 1.25, -r * 0.28, r * 0.75, -r * 0.38);
  ctx.fill();

  // ペンギンのくちばし
  if (chara === "pengin") {
    ctx.fillStyle = "#ff9d3c";
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, -r * 0.14);
    ctx.lineTo(r * 0.16, -r * 0.14);
    ctx.lineTo(0, r * 0.08);
    ctx.closePath();
    ctx.fill();
  }

  // 目(暗い体色のキャラは白目を敷く)
  const eyeBg = chara === "pengin";
  for (const s of [-1, 1]) {
    const ex = s * r * 0.28 + nextDir * r * 0.1;
    const ey = -r * 0.22;
    if (eyeBg) {
      ctx.fillStyle = "#f4f7ff";
      ctx.beginPath();
      ctx.arc(s * r * 0.28, ey, r * 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = dark;
    if (falling) {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath();
      ctx.arc(s * r * 0.28, ey, r * 0.15, t * 14, t * 14 + 4.5);
      ctx.stroke();
    } else if (blink) {
      ctx.fillRect(ex - r * 0.14, ey, r * 0.28, r * 0.08);
    } else {
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.14, 0, TAU);
      ctx.fill();
    }
  }

  // ネコのひげ
  if (chara === "neko") {
    ctx.strokeStyle = "rgba(28,39,67,0.55)";
    ctx.lineWidth = 1.2 * u;
    for (const s of [-1, 1]) {
      for (const dy of [-0.04, 0.08]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.5, r * (dy + 0.02));
        ctx.lineTo(s * r * 0.95, r * dy);
        ctx.stroke();
      }
    }
  }

  // ほっぺ(ペンギンはおなかに紛れるので省略)
  if (chara !== "pengin") {
    ctx.fillStyle = "rgba(255,79,163,0.35)";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 0.52, r * 0.05, r * 0.12, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}
