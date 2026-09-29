// Đường cong ánh sáng ngày/đêm — keyframe lerp thuần, unit-test được.
// timeMinutes 0–1440. Đêm max alpha 0.55 tint xanh đậm; hoàng hôn tint cam-tím.
export interface DayLight {
  tint: number;
  alpha: number;
}

interface Keyframe {
  at: number;
  tint: number;
  alpha: number;
}

const KEYS: Keyframe[] = [
  { at: 0, tint: 0x10162e, alpha: 0.55 }, // nửa đêm
  { at: 270, tint: 0x10162e, alpha: 0.55 }, // 4:30 trước bình minh
  { at: 360, tint: 0xd9a06b, alpha: 0.22 }, // 6:00 bình minh cam
  { at: 420, tint: 0xffffff, alpha: 0 }, // 7:00 hết
  { at: 1020, tint: 0xffffff, alpha: 0 }, // 17:00 bắt đầu hoàng hôn
  { at: 1110, tint: 0xc76b3f, alpha: 0.3 }, // 18:30 cam
  { at: 1230, tint: 0x2b1a4d, alpha: 0.5 }, // 20:30 tím xanh
  { at: 1440, tint: 0x10162e, alpha: 0.55 }, // wrap nửa đêm
];

/** Scalar lerp — dùng cho alpha. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Lerp màu TỪNG KÊNH R/G/B — KHÔNG lerp packed-int trực tiếp.
 * Packed-int borrow giữa kênh khi một kênh giảm qua biên mượn của kênh
 * kế tiếp (vd 18:30→20:30: 0xc76b3f→0x2b1a4d cho blue sai 0xC6 thay 0x46).
 */
function lerpColor(c0: number, c1: number, t: number): number {
  const r = (lerp((c0 >> 16) & 0xff, (c1 >> 16) & 0xff, t) | 0) & 0xff;
  const g = (lerp((c0 >> 8) & 0xff, (c1 >> 8) & 0xff, t) | 0) & 0xff;
  const b = (lerp(c0 & 0xff, c1 & 0xff, t) | 0) & 0xff;
  return (r << 16) | (g << 8) | b;
}

export function dayLightAt(timeMinutes: number): DayLight {
  const m = ((timeMinutes % 1440) + 1440) % 1440;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const k0 = KEYS[i];
    const k1 = KEYS[i + 1];
    if (m >= k0.at && m <= k1.at) {
      const t = (m - k0.at) / (k1.at - k0.at);
      return { tint: lerpColor(k0.tint, k1.tint, t), alpha: lerp(k0.alpha, k1.alpha, t) };
    }
  }
  return { tint: 0x10162e, alpha: 0.55 };
}
