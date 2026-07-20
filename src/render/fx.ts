import { easeOutCubic } from "../core/math.ts";
import type { Viewport } from "../core/viewport.ts";
import type { Fx } from "../fx/particles.ts";

/** パーティクル(破片)・衝撃波リング・スイング残像・フロートテキストの描画 */
export function drawFx(ctx: CanvasRenderingContext2D, vp: Viewport, fx: Fx): void {
  const { cx, cy, unit } = vp;

  // スイング残像(扇形のフェード)
  for (const a of fx.arcs) {
    const ratio = a.life / a.maxLife;
    ctx.save();
    ctx.globalAlpha = 0.28 * ratio;
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, a.len, a.angle - a.halfArc, a.angle + a.halfArc);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.5 * ratio;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5 * unit;
    ctx.beginPath();
    ctx.arc(cx, cy, a.len, a.angle - a.halfArc, a.angle + a.halfArc);
    ctx.stroke();
    ctx.restore();
  }

  // 衝撃波リング
  for (const r of fx.rings) {
    const t = 1 - r.life / r.maxLife;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * (1 - t * 0.6);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.maxR * easeOutCubic(t), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 破片
  for (const p of fx.particles) {
    if (!p.active) continue;
    const ratio = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = ratio;
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }

  // フロートテキスト
  for (const f of fx.floats) {
    const ratio = f.life / f.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.min(ratio * 2, 1);
    ctx.fillStyle = f.color;
    ctx.font = `800 ${f.size}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(10,14,26,0.8)";
    ctx.lineWidth = 3 * unit;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}
