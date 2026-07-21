import { clamp } from "../core/math.ts";
import type { RunMods, WeaponDef } from "./config.ts";
import { PHYS, PLAYER, WEAPONS } from "./config.ts";
import type { Terrain } from "./terrain.ts";
import { isSolid, kindAt } from "./terrain.ts";

/** 1フレームぶんの入力(照準は画面座標→タイル座標に変換済み) */
export interface PlayerCtrl {
  firing: boolean;
  aimX: number; // タイル座標
  aimY: number;
}

export interface PlayerHost {
  /** 弾を発射した(worldが弾を生成) */
  shoot(dirX: number, dirY: number, weapon: WeaponDef): void;
  emptyClick(): void;
  landed(speed: number, hard: boolean): void;
  steppedGlass(col: number, row: number): void;
}

/**
 * プレイヤー機体。移動手段は射撃の反動のみ。
 * AABB(半幅PHYS.PLAYER_R)でタイル地形と衝突。接地でフルリロード。
 */
export class Player {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  hp: number;
  ammo: number;
  invulnT = 0;
  grounded = false;
  /** 直近の射撃方向(描画用) */
  aimAngle = Math.PI / 2;
  muzzleT = 0; // マズルフラッシュ残り
  overdriveT = 0; // 弾消費ゼロの残り秒数
  private fireCooldown = 0;
  private wasGrounded = false;

  constructor(
    startX: number,
    startY: number,
    private mods: RunMods,
  ) {
    this.x = startX;
    this.y = startY;
    this.hp = mods.maxHp;
    this.ammo = mods.maxAmmo;
  }

  get maxHp(): number {
    return this.mods.maxHp;
  }
  get maxAmmo(): number {
    return this.mods.maxAmmo;
  }
  get weapon(): WeaponDef {
    return WEAPONS[this.mods.weapon];
  }

  refillAmmo(min: number): void {
    this.ammo = Math.max(this.ammo, min);
  }
  addAmmo(n: number): void {
    this.ammo = Math.min(this.ammo + n, this.mods.maxAmmo);
  }

  update(dt: number, ctrl: PlayerCtrl, t: Terrain, windAx: number, host: PlayerHost): void {
    this.invulnT = Math.max(this.invulnT - dt, 0);
    this.muzzleT = Math.max(this.muzzleT - dt, 0);
    this.overdriveT = Math.max(this.overdriveT - dt, 0);
    this.fireCooldown -= dt;

    // 射撃(反動)
    if (ctrl.firing) {
      const dx = ctrl.aimX - this.x;
      const dy = ctrl.aimY - this.y;
      const len = Math.hypot(dx, dy) || 1;
      this.aimAngle = Math.atan2(dy, dx);
      const w = this.weapon;
      while (this.fireCooldown <= 0) {
        this.fireCooldown += 1 / w.rate;
        if (this.ammo < w.cost && this.overdriveT <= 0) {
          host.emptyClick();
          break;
        }
        if (this.overdriveT <= 0) this.ammo -= w.cost;
        host.shoot(dx / len, dy / len, w);
        // 反動は撃った方向の逆
        this.vx -= (dx / len) * w.impulse;
        this.vy -= (dy / len) * w.impulse;
        this.muzzleT = 0.06;
      }
    } else if (this.fireCooldown < 0) {
      this.fireCooldown = 0;
    }

    // 物理
    this.vy += PHYS.GRAVITY * dt;
    this.vy = clamp(this.vy, -30, PHYS.TERMINAL);
    this.vx += windAx * dt;
    this.vx *= 1 - PHYS.AIR_DRAG * dt;

    // 軸ごとに移動+衝突解決
    const r = PHYS.PLAYER_R;
    this.x += this.vx * dt;
    this.resolveAxis(t, r, true);
    const fallSpeed = this.vy;
    this.y += this.vy * dt;
    const landedNow = this.resolveAxis(t, r, false);

    this.grounded = landedNow;
    if (landedNow && !this.wasGrounded) {
      // 接地イベント(激突判定+リロードはhost側)
      host.landed(fallSpeed, fallSpeed > PHYS.SAFE_LAND);
      // 乗ったガラスの通知
      const rowBelow = Math.floor(this.y + r + 0.06);
      for (const c of [Math.floor(this.x - r * 0.8), Math.floor(this.x + r * 0.8)]) {
        if (kindAt(t, c, rowBelow) === "glass") host.steppedGlass(c, rowBelow);
      }
    } else if (landedNow) {
      const rowBelow = Math.floor(this.y + r + 0.06);
      for (const c of [Math.floor(this.x - r * 0.8), Math.floor(this.x + r * 0.8)]) {
        if (kindAt(t, c, rowBelow) === "glass") host.steppedGlass(c, rowBelow);
      }
    }
    this.wasGrounded = landedNow;

    this.x = clamp(this.x, r + 0.02, t.cols - r - 0.02);
  }

  /** AABB vs タイルの軸別解決。垂直解決で床に乗ったらtrue */
  private resolveAxis(t: Terrain, r: number, horizontal: boolean): boolean {
    let onFloor = false;
    const x0 = Math.floor(this.x - r);
    const x1 = Math.floor(this.x + r);
    const y0 = Math.floor(this.y - r);
    const y1 = Math.floor(this.y + r);
    for (let row = y0; row <= y1; row++) {
      for (let col = x0; col <= x1; col++) {
        if (!isSolid(kindAt(t, col, row))) continue;
        // 重なり量
        const ox = Math.min(this.x + r - col, col + 1 - (this.x - r));
        const oy = Math.min(this.y + r - row, row + 1 - (this.y - r));
        if (ox <= 0 || oy <= 0) continue;
        if (horizontal) {
          if (ox < oy) {
            this.x += this.x < col + 0.5 ? -ox : ox;
            this.vx = 0;
          }
        } else {
          if (oy <= ox) {
            if (this.y < row + 0.5) {
              this.y -= oy;
              if (this.vy > 0) {
                this.vy = 0;
                onFloor = true;
              }
            } else {
              this.y += oy;
              if (this.vy < 0) this.vy = 0;
            }
          }
        }
      }
    }
    return onFloor;
  }

  takeDamage(
    cause: string,
    knockX: number,
    knockY: number,
    onDamaged: (hpLeft: number, cause: string) => void,
  ): boolean {
    if (this.invulnT > 0) return false;
    this.hp -= 1;
    this.invulnT = PLAYER.INVULN;
    this.vx = knockX;
    this.vy = knockY;
    onDamaged(this.hp, cause);
    return true;
  }
}
