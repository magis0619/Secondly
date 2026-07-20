/**
 * rAF + 固定タイムステップ(1/60s)のゲームループ。
 * update は常に固定dtで呼ばれ、draw は毎フレーム1回。
 * ヒットストップ等の timeScale は呼び出し側(シーン)が dt に乗せる。
 */
export const FIXED_DT = 1 / 60;

export interface Loop {
  /** ポーズ復帰時などに蓄積時間を捨てる */
  reset(): void;
}

export function startLoop(update: (dt: number) => void, draw: () => void): Loop {
  let acc = 0;
  let last = performance.now();

  const frame = (now: number) => {
    let ft = (now - last) / 1000;
    last = now;
    if (ft > 0.1) ft = 0.1; // タブ復帰などの巨大フレームでのスパイラル防止
    acc += ft;
    while (acc >= FIXED_DT) {
      update(FIXED_DT);
      acc -= FIXED_DT;
    }
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    reset() {
      acc = 0;
      last = performance.now();
    },
  };
}
