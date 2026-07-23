/**
 * ★触覚フィードバックの差し替えポイント。
 * Webスタブ: navigator.vibrate があれば使う(iOS Safariは非対応=無音no-op)。
 * iOS化: @capacitor/haptics の Haptics.impact({ style: ImpactStyle.Light/Medium/Heavy })
 * に差し替える(docs/release-checklist.md参照)。
 */
function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 非対応環境は無視
  }
}

/** ホップ成功などの軽い反応 */
export function hapticLight(): void {
  vibrate(8); // TODO(iOS): ImpactStyle.Light
}

/** ミス落下などの中程度の反応 */
export function hapticMedium(): void {
  vibrate(18); // TODO(iOS): ImpactStyle.Medium
}

/** フィーバー発動・上位入賞・購入成功などの強い反応 */
export function hapticHeavy(): void {
  vibrate(30); // TODO(iOS): ImpactStyle.Heavy
}
