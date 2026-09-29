import { hashStr, mulberry32 } from "./rng.js";

/**
 * W7c — Puzzle ghép hình (§8.1, rương KÉT thêm lựa chọn).
 * Ảnh 4×4 (16 ô) từ 1 icon — server giữ perm hiện tại ngầm: client gửi perm
 * (ô i hiển thị mảnh perm[i]); thắng = identity. Gen shuffle ≠ identity
 * (Fisher-Yates từ seed — deterministic cho replay).
 */
export const JIGSAW_N = 4;

export function genJigsaw(seed: string): number[] {
  const rng = mulberry32(hashStr(seed));
  const perm = Array.from({ length: JIGSAW_N * JIGSAW_N }, (_, i) => i);
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  if (perm.every((v, i) => v === i)) {
    [perm[0], perm[1]] = [perm[1], perm[0]]; // không sinh sẵn thắng
  }
  return perm;
}

/** Thắng: perm identity (mảnh i về ô i). */
export function validateJigsaw(attempt: number[]): boolean {
  if (attempt.length !== JIGSAW_N * JIGSAW_N) return false;
  return attempt.every((v, i) => v === i);
}
