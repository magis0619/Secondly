import { TAU } from "../core/math.ts";
import type { Viewport } from "../core/viewport.ts";
import { COLORS, ENEMY_AI, ENEMY_DEFS, PHYS } from "../game/config.ts";
import type { World } from "../game/world.ts";
import type { Layout } from "./layout.ts";
import { colX, depthY } from "./layout.ts";

/** プレイヤー機体+武器+マズルフラッシュ */
export function drawPlayer(ctx: CanvasRenderingContext2D, vp: Viewport, l: Layout, world: World): void {
  const p = world.player;
  const u = vp.unit;
  const x = colX(l, p.x);
  const y = depthY(l, world.camera.y, p.y);
  const r = PHYS.PLAYER_R * l.tile;
  const blink = p.invulnT > 0 && Math.sin(world.elapsed * 45) > 0;
  // 速度警告色(激突危険の常時可視化)
  const danger = p.vy > PHYS.SAFE_LAND ? COLORS.danger : p.vy > PHYS.SAFE_LAND * 0.7 ? COLORS.warn : COLORS.player;

  ctx.save();
  ctx.globalAlpha = blink ? 0.35 : 1;

  // オーバードライブのオーラ
  if (p.overdriveT > 0) {
    ctx.strokeStyle = COLORS.overdrive;
    ctx.globalAlpha *= 0.5 + 0.4 * Math.sin(world.elapsed * 20);
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.1, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = blink ? 0.35 : 1;
  }

  ctx.translate(x, y);
  // 進行方向に少し傾く
  ctx.rotate(Math.atan2(p.vx * 0.04, 1) * 0.8);

  // ブースター炎(落下中の下向き噴射感は出さず、射撃時のみ)
  // 本体
  ctx.fillStyle = danger;
  ctx.shadowColor = danger === COLORS.player ? COLORS.aim : danger;
  ctx.shadowBlur = 10 * u;
  ctx.beginPath();
  ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.55);
  ctx.fill();
  ctx.shadowBlur = 0;
  // 窓
  ctx.fillStyle = COLORS.aim;
  ctx.beginPath();
  ctx.arc(0, -r * 0.15, r * 0.42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.14, -r * 0.28, r * 0.15, 0, TAU);
  ctx.fill();
  ctx.rotate(-Math.atan2(p.vx * 0.04, 1) * 0.8);

  // 銃身(照準方向)
  ctx.rotate(p.aimAngle);
  ctx.fillStyle = "#4a5470";
  ctx.fillRect(r * 0.3, -2.6 * u, r * 1.5, 5.2 * u);
  // マズルフラッシュ
  if (p.muzzleT > 0) {
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.moveTo(r * 1.9, -4 * u);
    ctx.lineTo(r * 3.1, 0);
    ctx.lineTo(r * 1.9, 4 * u);
    ctx.lineTo(r * 2.2, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawBullets(ctx: CanvasRenderingContext2D, vp: Viewport, l: Layout, world: World): void {
  const u = vp.unit;
  ctx.save();
  for (const b of world.bullets) {
    if (!b.alive) continue;
    const x = colX(l, b.x);
    const y = depthY(l, world.camera.y, b.y);
    const a = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = COLORS.ammo;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-5 * u, -1.4 * u, 10 * u, 2.8 * u);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(-14 * u, -1 * u, 9 * u, 2 * u);
    ctx.restore();
  }
  // 敵弾(赤オーブ+グロー)
  for (const b of world.enemyBullets) {
    if (!b.alive) continue;
    const x = colX(l, b.x);
    const y = depthY(l, world.camera.y, b.y);
    ctx.fillStyle = COLORS.danger;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(x, y, 8 * u, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, 4 * u, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawEnemies(ctx: CanvasRenderingContext2D, vp: Viewport, l: Layout, world: World): void {
  const u = vp.unit;
  const cam = world.camera.y;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const x = colX(l, e.x);
    const y = depthY(l, cam, e.y);
    if (y < -60 || y > vp.h + 60) continue;
    const def = ENEMY_DEFS[e.kind];
    const r = def.r * l.tile;
    const color = COLORS.enemy[e.kind];
    const flash = e.hitFlash > 0;

    ctx.save();
    // 擬似グロー
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * 2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(x, y);
    ctx.fillStyle = flash ? "#ffffff" : color;

    if (e.kind === "fuwari") {
      // 白いクラゲ(踏める)
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI, 0);
      ctx.quadraticCurveTo(r, r * 0.55, r * 0.6, r * 0.6);
      for (let i = 2; i >= -2; i--) {
        ctx.quadraticCurveTo(i * r * 0.3 + r * 0.12, r * (0.85 + 0.12 * Math.sin(world.elapsed * 4 + i)), i * r * 0.3, r * 0.6);
      }
      ctx.quadraticCurveTo(-r, r * 0.55, -r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#38e1ff";
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.2, r * 0.14, 0, TAU);
      ctx.arc(r * 0.3, -r * 0.2, r * 0.14, 0, TAU);
      ctx.fill();
    } else if (e.kind === "togemaru") {
      // 赤トゲ球(踏めない)
      ctx.rotate(world.elapsed * 2.2 * e.dir);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.22) * r * 0.62, Math.sin(a - 0.22) * r * 0.62);
        ctx.lineTo(Math.cos(a) * r * 1.18, Math.sin(a) * r * 1.18);
        ctx.lineTo(Math.cos(a + 0.22) * r * 0.62, Math.sin(a + 0.22) * r * 0.62);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.68, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, TAU);
      ctx.fill();
    } else {
      // 砲台貝(壁付き)
      ctx.rotate(e.facing < 0 ? Math.PI : 0);
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = flash ? "#fff" : "#a8402f";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(e.facing < 0 ? -Math.PI : 0);
      // 砲身は照準方向
      ctx.rotate(e.aiState === 1 ? e.aimAngle : e.facing > 0 ? 0 : Math.PI);
      ctx.fillStyle = flash ? "#fff" : "#5c2418";
      ctx.fillRect(0, -2.2 * u, r * 1.3, 4.4 * u);
    }
    ctx.restore();

    // 予告レーザーサイト
    if (e.kind === "houdai" && e.aiState === 1) {
      ctx.save();
      ctx.strokeStyle = COLORS.danger;
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(world.elapsed * 24);
      ctx.lineWidth = 1.5 * u;
      ctx.setLineDash([6 * u, 5 * u]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(e.aimAngle) * ENEMY_AI.HOUDAI_RANGE * l.tile,
        y + Math.sin(e.aimAngle) * ENEMY_AI.HOUDAI_RANGE * l.tile,
      );
      ctx.stroke();
      ctx.restore();
    }
  }
}

export function drawPickups(ctx: CanvasRenderingContext2D, vp: Viewport, l: Layout, world: World): void {
  const u = vp.unit;
  for (const p of world.pickups) {
    if (!p.alive) continue;
    const x = colX(l, p.x);
    const y = depthY(l, world.camera.y, p.y);
    const fade = Math.min(p.life, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    ctx.rotate(p.rot);
    if (p.kind === "ammo") {
      ctx.fillStyle = COLORS.ammo;
      ctx.fillRect(-2.4 * u, -3.6 * u, 4.8 * u, 7.2 * u);
      ctx.fillStyle = "#c9a94e";
      ctx.fillRect(-2.4 * u, 1 * u, 4.8 * u, 2.6 * u);
    } else {
      const s = p.kind === "gemBig" ? 6.5 * u : 4.5 * u;
      ctx.fillStyle = COLORS.gem;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff2c8";
      ctx.fillRect(-s * 0.2, -s * 0.4, s * 0.4, s * 0.4);
    }
    ctx.restore();
  }
}
