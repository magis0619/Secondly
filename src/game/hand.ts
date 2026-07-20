import { TAU, damp, degToRad, easeOutBack, lerp, normAngle } from "../core/math.ts";
import { HAND } from "./config.ts";

export type HandState = "idle" | "charging" | "attacking" | "recovery";

/**
 * 秒針。回転はどの状態でも止まらない。
 * idle → (押す) charging → (離す) attacking → recovery → idle
 * イベント順序に依存しないよう、押下状態は毎フレーム boolean で受け取る。
 */
export class Hand {
  angle = -Math.PI / 2; // 12時の位置から開始
  state: HandState = "idle";
  stateT = 0;
  chargeT = 0;
  /** 解放時にスナップショットされる攻撃角/ティア */
  attackAngle = 0;
  attackTier = 0;
  /** 同一スイング内の重複ヒット防止ID */
  swingId = 0;
  /** 描画・弾当たり用の現在針長(R比) */
  visLen: number = HAND.IDLE_LEN;
  /** このフレームで解放した(イベント発火用) */
  justReleased = false;
  /** このフレームでティアが上がった(1|2、0=なし) */
  justTierUp = 0;

  /** チャージ中の現在ティア(0..2) */
  get chargeTier(): number {
    return this.chargeT >= HAND.CHARGE_T3 ? 2 : this.chargeT >= HAND.CHARGE_T2 ? 1 : 0;
  }

  /** MAXまでの充填率0..1(HUDゲージ用) */
  get chargeRatio(): number {
    return Math.min(this.chargeT / HAND.CHARGE_T3, 1);
  }

  get hitActive(): boolean {
    return this.state === "attacking" && this.stateT <= HAND.HIT_TIME;
  }

  rotationPeriod(elapsed: number): number {
    return elapsed >= HAND.ROT_FAST_AT ? HAND.ROT_PERIOD_FAST : HAND.ROT_PERIOD;
  }

  update(dt: number, pressed: boolean, elapsed: number): void {
    this.justReleased = false;
    this.justTierUp = 0;
    this.angle = normAngle(this.angle + (TAU / this.rotationPeriod(elapsed)) * dt);
    this.stateT += dt;

    switch (this.state) {
      case "idle":
        this.visLen += (HAND.IDLE_LEN - this.visLen) * damp(HAND.GROW_RATE, dt);
        if (pressed) {
          this.state = "charging";
          this.stateT = 0;
          this.chargeT = 0;
        }
        break;

      case "charging": {
        const prevTier = this.chargeTier;
        this.chargeT += dt;
        if (this.chargeTier > prevTier) this.justTierUp = this.chargeTier;
        this.visLen += (HAND.SHRINK_LEN - this.visLen) * damp(HAND.SHRINK_RATE, dt);
        if (!pressed) {
          this.attackTier = this.chargeTier;
          this.attackAngle = normAngle(this.angle + degToRad(HAND.AIM_OFFSET_DEG));
          this.state = "attacking";
          this.stateT = 0;
          this.swingId++;
          this.justReleased = true;
        }
        break;
      }

      case "attacking": {
        const tier = HAND.TIERS[this.attackTier];
        const t = Math.min(this.stateT / HAND.ANIM_TIME, 1);
        // easeOutBack のオーバーシュートで「伸びすぎて戻る」snapを表現
        this.visLen = lerp(HAND.SHRINK_LEN, tier.len, easeOutBack(t));
        if (this.stateT >= HAND.ANIM_TIME) {
          this.state = "recovery";
          this.stateT = 0;
        }
        break;
      }

      case "recovery":
        this.visLen += (HAND.IDLE_LEN - this.visLen) * damp(HAND.GROW_RATE, dt);
        if (this.stateT >= HAND.RECOVERY) {
          this.state = "idle";
          this.stateT = 0;
        }
        break;
    }
  }
}
