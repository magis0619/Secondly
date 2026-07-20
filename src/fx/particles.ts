/**
 * 固定長プールのパーティクル+リング+フロートテキスト+スイング残像。
 * 毎フレームのGCを避けるためパーティクルは配列を使い回す。
 * 座標は画面ピクセル(呼び出し側で極座標→画面座標へ変換して渡す)。
 */

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
}

export interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface SwingArc {
  angle: number; // 攻撃角(rad)
  halfArc: number; // 判定半角(rad)
  len: number; // 画面px
  life: number;
  maxLife: number;
  color: string;
}

const POOL_SIZE = 300;

export class Fx {
  particles: Particle[] = [];
  rings: Ring[] = [];
  floats: FloatText[] = [];
  arcs: SwingArc[] = [];
  private next = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.particles.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2,
        color: "#fff", rot: 0, vrot: 0,
      });
    }
  }

  burst(x: number, y: number, color: string, count: number, speed: number, size: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.next];
      this.next = (this.next + 1) % POOL_SIZE;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = 0.35 + Math.random() * 0.4;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.color = color;
      p.rot = Math.random() * Math.PI;
      p.vrot = (Math.random() * 2 - 1) * 8;
    }
  }

  ring(x: number, y: number, color: string, maxR: number, width = 3, life = 0.35): void {
    this.rings.push({ x, y, r: 0, maxR, life, maxLife: life, color, width });
  }

  float(x: number, y: number, text: string, color: string, size: number, life = 1.0): void {
    this.floats.push({ x, y, text, color, life, maxLife: life, size });
  }

  swingArc(angle: number, halfArc: number, len: number, color: string, life = 0.16): void {
    this.arcs.push({ angle, halfArc, len, life, maxLife: life, color });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
      p.rot += p.vrot * dt;
    }
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 28 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const a of this.arcs) a.life -= dt;
    this.arcs = this.arcs.filter((a) => a.life > 0);
  }
}
