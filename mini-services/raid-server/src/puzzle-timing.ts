import { hashStr, mulberry32 } from "./rng.js";

/**
 * Puzzle timing (iron chest — concept §8). Moving cursor trên bar, raider click
 * khi cursor ∈ window. Server gen window deterministic, client gửi idx, server compare.
 *
 * Anti-cheat: client gửi idx attempt, KHÔNG gửi "solved".
 */
export const TIMING_BAR_SIZE = 10;
export const TIMING_WINDOW = 3; // window 3 ô (balance — not too tight)

export interface TimingWindow {
  lo: number;
  hi: number; // inclusive
  size: number;
}

/** Sinh window deterministic từ seed + chestId. */
export function genTimingWindow(
  seed: string,
  chestId: string,
  size: number = TIMING_BAR_SIZE,
  window: number = TIMING_WINDOW,
): TimingWindow {
  const rng = mulberry32(hashStr(seed + ":" + chestId));
  const lo = Math.floor(rng() * (size - window + 1));
  return { lo, hi: lo + window - 1, size };
}

/** Validate idx ∈ [lo, hi]. */
export function validateTiming(w: TimingWindow, idx: number): boolean {
  return idx >= w.lo && idx <= w.hi;
}
