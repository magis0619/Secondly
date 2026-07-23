/**
 * ★触覚フィードバックの差し替えポイント。
 * @capacitor/haptics はWeb実装(navigator.vibrateフォールバック)も内蔵しているため、
 * Web/iOSどちらでもこのファイルだけで完結する。
 */
import { Haptics, ImpactStyle } from "@capacitor/haptics";

function impact(style: ImpactStyle): void {
  void Haptics.impact({ style }).catch(() => {
    // 非対応環境は無視
  });
}

/** ホップ成功などの軽い反応 */
export function hapticLight(): void {
  impact(ImpactStyle.Light);
}

/** ミス落下などの中程度の反応 */
export function hapticMedium(): void {
  impact(ImpactStyle.Medium);
}

/** フィーバー発動・上位入賞・購入成功などの強い反応 */
export function hapticHeavy(): void {
  impact(ImpactStyle.Heavy);
}
