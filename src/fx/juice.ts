/**
 * 「気持ちよさ」系のグローバル状態: ヒットストップ(timeScale)と画面シェイク(trauma方式)。
 * update() には非スケールの実dtを渡すこと(ストップ中も減衰が進むように)。
 */
export class Juice {
  timeScale = 1;
  offX = 0;
  offY = 0;
  /** 画面全体フラッシュ(被弾の赤など)。alphaとして使う */
  flash = 0;
  flashColor = "#ff3b5c";

  private hitstopT = 0;
  private trauma = 0;

  hitstop(sec: number): void {
    this.hitstopT = Math.max(this.hitstopT, sec);
  }

  shake(amount: number): void {
    this.trauma = Math.min(this.trauma + amount, 1);
  }

  flashScreen(color: string, alpha: number): void {
    this.flashColor = color;
    this.flash = Math.max(this.flash, alpha);
  }

  update(dtReal: number, maxOffset: number): void {
    this.hitstopT = Math.max(this.hitstopT - dtReal, 0);
    this.timeScale = this.hitstopT > 0 ? 0.05 : 1;

    this.trauma *= Math.exp(-5 * dtReal);
    if (this.trauma < 0.005) this.trauma = 0;
    const amp = this.trauma * this.trauma * maxOffset;
    this.offX = (Math.random() * 2 - 1) * amp;
    this.offY = (Math.random() * 2 - 1) * amp;

    this.flash = Math.max(this.flash - dtReal * 2.5, 0);
  }
}
