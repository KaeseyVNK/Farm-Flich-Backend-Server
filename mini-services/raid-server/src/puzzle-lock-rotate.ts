import { hashStr, mulberry32 } from "./rng.js";

/**
 * W7c — Puzzle xoay vòng khóa (§8.1, rương SẮT thêm lựa chọn).
 * 3 vòng đồng tâm, mỗi vòng 1 viên khắc; chu kỳ mỗi vòng khác nhau (4/6/8).
 * Gen: từ vị trí thắng (mọi vòng 0) xáo offset random ≠ 0 → LUÔN có nghiệm
 * (xoay vòng về 0). Client submit offsets hiện tại (3 số); server validate thắng.
 */
export const LOCK_RING_SIZES = [4, 6, 8];

export function genLockRotate(seed: string): { offsets: number[]; sizes: number[] } {
  const rng = mulberry32(hashStr(seed));
  const offsets = LOCK_RING_SIZES.map((size) => {
    let o = Math.floor(rng() * size);
    if (o === 0) o = 1 % size; // không sinh sẵn thắng
    return o;
  });
  return { offsets, sizes: [...LOCK_RING_SIZES] };
}

/** Thắng: mọi vòng về 0 (mod size). */
export function validateLockRotate(attempt: number[]): boolean {
  if (attempt.length !== LOCK_RING_SIZES.length) return false;
  return LOCK_RING_SIZES.every((size, i) => {
    const v = attempt[i];
    return Number.isInteger(v) && ((v % size) + size) % size === 0;
  });
}
