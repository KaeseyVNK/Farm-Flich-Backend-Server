import { hashStr, mulberry32 } from "./rng.js";

/**
 * Puzzle memory (MVP — rương gỗ, concept §8).
 * Server-side gen từ seed = hash(farmId, chestId, raidId). Client gửi attempt, server compare.
 * Anti-cheat: client KHÔNG bao giờ gửi "solved", chỉ gửi attempt (red-team #3).
 */

export const MEMORY_TILES = 4; // grid 2×2 hoặc 4 nút
export const WOOD_MEMORY_LEN = 3; // rương gỗ: 5-8s → seq len 3

/** Sinh memory sequence deterministic từ seed. */
export function genMemorySeq(seed: string, len: number = WOOD_MEMORY_LEN): number[] {
  const rng = mulberry32(hashStr(seed));
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(Math.floor(rng() * MEMORY_TILES));
  return out;
}

/** Validate attempt. True nếu đúng full sequence (cùng độ dài + đúng thứ tự). */
export function validateMemory(seq: number[], attempt: number[]): boolean {
  if (seq.length !== attempt.length) return false;
  return seq.every((v, i) => v === attempt[i]);
}
