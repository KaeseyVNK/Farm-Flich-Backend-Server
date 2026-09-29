import { hashStr, mulberry32 } from "./rng.js";

/**
 * W7c — mỗi chest random 1 trong 2 puzzle cùng mức (concept §8.1):
 * - wood: memory | circuit
 * - iron: timing | lock-rotate
 * - safe: sequence | jigsaw
 * Deterministic từ sessionId+chestId (cùng convention seed ":") — replay/validate
 * lại cùng kind, client không thể chọn kind dễ hơn.
 */

export type PuzzleKind =
  | "memory"
  | "circuit"
  | "timing"
  | "lock-rotate"
  | "sequence"
  | "jigsaw";

const TIER_PAIRS: Record<string, [PuzzleKind, PuzzleKind]> = {
  wood: ["memory", "circuit"],
  iron: ["timing", "lock-rotate"],
  safe: ["sequence", "jigsaw"],
};

/** Chọn puzzle kind cho chest — deterministic theo sessionId+chestId. */
export function chestPuzzleKind(
  chestKind: string,
  sessionId: string,
  chestId: string,
): PuzzleKind {
  const pair = TIER_PAIRS[chestKind] ?? TIER_PAIRS.wood;
  const rng = mulberry32(hashStr(sessionId + ":" + chestId));
  return pair[Math.floor(rng() * 2)];
}
