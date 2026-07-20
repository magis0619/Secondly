import { TAU } from "../core/math.ts";
import type { Viewport } from "../core/viewport.ts";
import { BULLET, CHIME, COLORS, ENEMY_DEFS } from "../game/config.ts";
import type { World } from "../game/world.ts";

/** スポーン予告: 外周リング上の収縮アーク+内向きシェブロン */
export function drawTelegraphs(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const { cx, cy, R, unit } = vp;
  for (const tg of world.telegraphs) {
    const ratio = tg.t / tg.total; // 1→0
    const color = COLORS.enemy[tg.kind];
    const blink = 0.45 + 0.55 * Math.abs(Math.sin((1 - ratio) * 22));
    const half = (3 + 14 * ratio) * (Math.PI / 180);
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * unit;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.05, tg.angle - half, tg.angle + half);
    ctx.stroke();
    // シェブロン(内向き三角)
    const bx = cx + Math.cos(tg.angle) * R * 1.12;
    const by = cy + Math.sin(tg.angle) * R * 1.12;
    ctx.translate(bx, by);
    ctx.rotate(tg.angle + Math.PI); // 中心向き
    ctx.beginPath();
    ctx.moveTo(6 * unit, 0);
    ctx.lineTo(-4 * unit, 5 * unit);
    ctx.lineTo(-4 * unit, -5 * unit);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
}

/** 敵本体。shadowBlurは使わず「下に大きな半透明円」の擬似グローで軽くする */
export function drawEnemies(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const { cx, cy, R, unit } = vp;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const def = ENEMY_DEFS[e.kind];
    const x = cx + Math.cos(e.angle) * e.dist * R;
    const y = cy + Math.sin(e.angle) * e.dist * R;
    const s = def.size * R;
    const color = COLORS.enemy[e.kind];
    const flash = e.hitFlash > 0;

    ctx.save();
    // 擬似グロー
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, s * 2.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.translate(x, y);
    ctx.fillStyle = flash ? "#ffffff" : color;

    if (e.kind === "tick") {
      // ゆらゆら回る菱形
      ctx.rotate(e.wobble + world.elapsed * 1.2);
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.8, 0);
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === "rush") {
      // 中心を向く鋭い三角+尾
      ctx.rotate(e.angle + Math.PI);
      ctx.beginPath();
      ctx.moveTo(s * 1.3, 0);
      ctx.lineTo(-s * 0.9, s * 0.75);
      ctx.lineTo(-s * 0.5, 0);
      ctx.lineTo(-s * 0.9, -s * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, 0);
      ctx.lineTo(-s * 2.4, 0);
      ctx.lineWidth = 2 * unit;
      ctx.strokeStyle = color;
      ctx.stroke();
    } else {
      // Chime: 六角形+次弾チャージインジケータ
      ctx.rotate(world.elapsed * 0.5 + e.wobble);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const px = Math.cos(a) * s;
        const py = Math.sin(a) * s;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-(world.elapsed * 0.5 + e.wobble));
      if (e.dist <= CHIME.STOP_DIST) {
        // 発射までの充填率を細いリングで見せる(=弾のテレグラフ)
        const charge = 1 - e.fireT / CHIME.FIRE_INTERVAL;
        ctx.strokeStyle = flash ? "#ffffff" : COLORS.bullet;
        ctx.lineWidth = 2 * unit;
        ctx.beginPath();
        ctx.arc(0, 0, s * 1.5, -Math.PI / 2, -Math.PI / 2 + charge * TAU);
        ctx.stroke();
      }
      ctx.fillStyle = flash ? "#ffffff" : "#3a2a10";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawBullets(ctx: CanvasRenderingContext2D, vp: Viewport, world: World): void {
  const { cx, cy, R, unit } = vp;
  for (const b of world.bullets) {
    if (!b.alive) continue;
    const x = cx + Math.cos(b.angle) * b.dist * R;
    const y = cy + Math.sin(b.angle) * b.dist * R;
    const s = BULLET.SIZE * R;
    ctx.save();
    // 尾(進行方向の後ろ=外側へ)
    ctx.strokeStyle = COLORS.bullet;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.6 * unit;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(b.angle) * s * 4, y + Math.sin(b.angle) * s * 4);
    ctx.stroke();
    // 擬似グロー+本体
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = COLORS.bullet;
    ctx.beginPath();
    ctx.arc(x, y, s * 2.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
