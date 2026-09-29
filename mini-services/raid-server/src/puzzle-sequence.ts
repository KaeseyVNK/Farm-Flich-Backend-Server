import { hashStr, mulberry32 } from "./rng.js";

/**
 * Puzzle sequence (safe chest — concept §8). Buttons light theo seq, raider lặp lại.
 * Giống memory nhưng validate có deadlineMs (lit-only window).
 * Server gen seq deterministic, client gửi attempt, server compare.
 */
export const SEQ_BUTTONS = 4; // grid 4 nút
export const SAFE_SEQ_LEN = 4; // safe chest: seq len 4

export function genSequence(
  seed: string,
  chestId: string,
  len: number = SAFE_SEQ_LEN,
  buttons: number = SEQ_BUTTONS,
): number[] {
  const rng = mulberry32(hashStr(seed + ":seq:" + chestId));
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(Math.floor(rng() * buttons));
  return out;
}

/** Validate attempt đúng thứ tự + độ dài. Deadline check ở caller (wall-clock). */
export function validateSequence(seq: number[], attempt: number[]): boolean {
  if (seq.length !== attempt.length) return false;
  return seq.every((v, i) => v === attempt[i]);
}

/** Deadline check — true nếu còn hạn. */
export function withinDeadline(startMs: number, deadlineMs: number, now: number): boolean {
  return now - startMs <= deadlineMs;
}
