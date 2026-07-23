import { FEVER, GAME } from "./config.ts";

/** 0=左, 1=右 */
export type Side = 0 | 1;

export type Phase = "count" | "play" | "done";

export type TowerEvent =
  | { type: "count"; n: number } // 3,2,1
  | { type: "go" }
  | { type: "hop"; h: number; side: Side }
  | { type: "fall"; from: number; to: number; side: Side }
  | { type: "landed"; h: number } // ホップ着地(足場の沈み・ぼよん演出用)
  | { type: "fellLanded"; h: number; dist: number } // 落下の着地
  | { type: "tick"; left: number } // 残りURGENT秒のカウント
  | { type: "timeup"; score: number };

export type Anim =
  | { kind: "idle" }
  | { kind: "hop"; t: number; dur: number; from: number }
  | { kind: "fall"; t: number; dur: number; from: number };

/**
 * ゲーム全ロジック。足場は高さhに1枚、side(h)が左右ランダム(連続はMAX_RUNまで)。
 * h=0は全幅の地面(どちら側とも一致扱い=最終セーフティ)。
 * ミス: 押した側の直近下の足場まで落下(同じ側が続くほど代償が大きい)。
 */
export class Tower {
  sides: Side[] = [1]; // sides[0]はダミー(地面)。sides[h]がh段目
  h = 0;
  maxH = 0;
  phase: Phase = "count";
  timeLeft: number = GAME.TIME;
  countdown: number = GAME.COUNTDOWN + 0.5;
  anim: Anim = { kind: "idle" };
  events: TowerEvent[] = [];

  private lastCount = GAME.COUNTDOWN + 1;
  private lastTick = GAME.URGENT + 1;
  private run = 1;
  /** フィーバー: この高さ以上の足場が中央1本になる(-1=無効) */
  private feverFromH = -1;
  /** フィーバー終了直後の猶予: この高さへは左右どちらのタップでも登れる(-1=なし) */
  private graceH = -1;

  constructor() {
    this.ensure(8);
  }

  /** h段目の足場のサイド。h=0(地面)は両側一致扱いなので呼び出し側で特別扱い */
  side(h: number): Side {
    this.ensure(h);
    return this.sides[h];
  }

  private ensure(h: number): void {
    while (this.sides.length <= h + 4) {
      const prev = this.sides[this.sides.length - 1];
      let next: Side = Math.random() < 0.5 ? 0 : 1;
      if (next === prev && this.run >= GAME.MAX_RUN) next = (1 - prev) as Side;
      this.run = next === prev ? this.run + 1 : 1;
      this.sides.push(next);
    }
  }

  /**
   * フィーバーの切替。ON: 次の段から足場が中央1本(どちらをタップしても登れる)。
   * OFF: 足場が左右に戻る。復帰直後の1段だけは両側OKの猶予(理不尽ミス防止)。
   */
  setFever(on: boolean): void {
    if (on) {
      this.feverFromH = this.h + 1;
      this.graceH = -1;
    } else if (this.feverFromH >= 0) {
      this.feverFromH = -1;
      this.graceH = this.h + 1;
    }
  }

  /** h段目の足場が中央(フィーバー)か */
  isCenter(h: number): boolean {
    return this.feverFromH >= 0 && h >= this.feverFromH;
  }

  /** 描画用の列位置(-1=左, 0=中央, +1=右)。地面とフィーバー足場は中央 */
  col(h: number): number {
    if (h === 0 || this.isCenter(h)) return 0;
    return this.side(h) === 0 ? -1 : 1;
  }

  /** 左右タップ。受け付けたらtrue */
  tap(d: Side): boolean {
    if (this.phase !== "play") return false;
    if (this.anim.kind === "fall") return false; // 落下中は操作不能(ペナルティの一部)
    if (this.anim.kind === "hop" && this.anim.t < GAME.HOP_BUFFER) return false;

    const next = this.h + 1;
    const anySide = this.isCenter(next) || next === this.graceH;
    if (anySide || this.side(next) === d) {
      this.h += 1;
      this.maxH = Math.max(this.maxH, this.h);
      if (this.graceH >= 0 && this.h >= this.graceH) this.graceH = -1; // 猶予は1段だけ
      const dur = this.isCenter(this.h) ? FEVER.HOP_TIME : GAME.HOP_TIME;
      this.anim = { kind: "hop", t: 0, dur, from: this.h - 1 };
      this.events.push({ type: "hop", h: this.h, side: d });
    } else {
      // 押した側の直近下の足場へ落下(なければ地面h=0)
      let to = 0;
      for (let k = this.h; k >= 1; k--) {
        if (this.sides[k] === d) {
          to = k;
          break;
        }
      }
      const dist = this.h + 1 - to;
      const dur = Math.min(GAME.FALL_BASE + GAME.FALL_PER_STEP * dist, GAME.FALL_MAX);
      this.anim = { kind: "fall", t: 0, dur, from: this.h };
      this.events.push({ type: "fall", from: this.h, to, side: d });
      this.h = to;
    }
    return true;
  }

  update(dt: number): void {
    // アニメ進行(完了時に着地イベント)
    if (this.anim.kind !== "idle") {
      this.anim.t += dt;
      if (this.anim.t >= this.anim.dur) {
        if (this.anim.kind === "hop") {
          this.events.push({ type: "landed", h: this.h });
        } else {
          this.events.push({ type: "fellLanded", h: this.h, dist: this.anim.from - this.h });
        }
        this.anim = { kind: "idle" };
      }
    }

    if (this.phase === "count") {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n < this.lastCount && n >= 1) {
        this.lastCount = n;
        this.events.push({ type: "count", n });
      }
      if (this.countdown <= 0) {
        this.phase = "play";
        this.events.push({ type: "go" });
      }
      return;
    }

    if (this.phase === "play") {
      this.timeLeft -= dt;
      const t = Math.ceil(this.timeLeft);
      if (this.timeLeft <= GAME.URGENT && t < this.lastTick && t >= 1) {
        this.lastTick = t;
        this.events.push({ type: "tick", left: t });
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.phase = "done";
        this.events.push({ type: "timeup", score: this.maxH });
      }
    }
  }

  /** 描画用: 現在のプレイヤー高さ(アニメ補間込み) */
  visualH(): number {
    if (this.anim.kind === "hop") {
      const t = Math.min(this.anim.t / this.anim.dur, 1);
      return this.anim.from + t;
    }
    if (this.anim.kind === "fall") {
      const t = Math.min(this.anim.t / this.anim.dur, 1);
      return this.anim.from + (this.h - this.anim.from) * (t * t); // 加速落下
    }
    return this.h;
  }

  /** 描画用: プレイヤーの横位置(-1=左, 0=中央, +1=右)。フィーバー中央も反映 */
  visualSide(): number {
    if (this.anim.kind === "hop" || this.anim.kind === "fall") {
      const t = Math.min(this.anim.t / this.anim.dur, 1);
      const from = this.col(this.anim.from);
      const to = this.col(this.h);
      return from + (to - from) * t;
    }
    return this.col(this.h);
  }

  drainEvents(): TowerEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
