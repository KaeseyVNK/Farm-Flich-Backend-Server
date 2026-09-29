// Wave 1 P2 — reel bar physics (pure, không Phaser/DOM). Hybrid 2 lớp:
// chỉ cá medium/rare vào reel. Hold = bar tăng tốc LÊN, thả = rơi;
// bar chồng fishTarget → progress tăng, lệch → giảm. >=1 caught, <=0 escaped.
// Mọi hằng số tập trung REEL_TUNE để human gate chỉnh nhanh (plan P4 risk).
import type { FishRarity } from "@/lib/game/fish-catalog";

export type Rng = () => number;

export interface ReelState {
  /** Vị trí thanh bar 0..1 (0 = đáy, 1 = đỉnh). */
  barPos: number;
  barVel: number;
  /** Vị trí cá 0..1 — medium: sin deterministic; rare: random-walk theo rng. */
  fishPos: number;
  /** 0..1 — đạt 1 caught, chạm 0 escaped. */
  progress: number;
  /** Thời gian tích luỹ trong reel (giây) — phase cho sin. */
  t: number;
  /** Kiểu di chuyển cá theo rarity (common không bao giờ vào reel). */
  kind: "medium" | "rare";
}

export const REEL_TUNE = {
  /** Gia tốc khi hold (/s²) và trọng lực khi thả (/s²). */
  accUp: 2.2,
  gravity: 2.0,
  /** Bar chồng fish khi |barPos - fishPos| <= overlapHalf. */
  overlapHalf: 0.12,
  /** Tốc progress khi chồng / lệch (/s). */
  rateUp: 0.3,
  rateDown: 0.38,
  progressStart: 0.4,
  /** Tốc độ cá: medium sin chậm, rare walk nhanh. */
  fishSpeed: { medium: 0.35, rare: 0.9 } as const,
} as const;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function initReel(rarity: FishRarity, rng: Rng): ReelState {
  const kind = rarity === "rare" ? "rare" : "medium";
  return {
    barPos: 0.5,
    barVel: 0,
    fishPos: clamp01(rng()),
    progress: REEL_TUNE.progressStart,
    t: 0,
    kind,
  };
}

export interface ReelUpdate {
  state: ReelState;
  outcome: "caught" | "escaped" | null;
}

/** Một bước vật lý dt giây. Pure: không mutate input, dt <= 0 là no-op. */
export function updateReel(s: ReelState, dt: number, holding: boolean, rng: Rng): ReelUpdate {
  if (dt <= 0) return { state: s, outcome: null };
  const t = s.t + dt;

  // Bar: hold đẩy lên, thả rơi; chạm biên dừng hẳn (vel = 0, không bật lại).
  const vel = s.barVel + (holding ? REEL_TUNE.accUp : -REEL_TUNE.gravity) * dt;
  let barPos = s.barPos + vel * dt;
  let barVel = vel;
  if (barPos <= 0) {
    barPos = 0;
    barVel = 0;
  } else if (barPos >= 1) {
    barPos = 1;
    barVel = 0;
  }

  // Fish: medium sin(t) deterministic (không rng); rare random-walk theo rng.
  let fishPos: number;
  if (s.kind === "medium") {
    fishPos = (Math.sin(t * REEL_TUNE.fishSpeed.medium * Math.PI * 2) + 1) / 2;
  } else {
    const step = (rng() - 0.5) * REEL_TUNE.fishSpeed.rare * dt * 2;
    fishPos = clamp01(s.fishPos + step);
  }

  const overlap = Math.abs(barPos - fishPos) <= REEL_TUNE.overlapHalf;
  const progress = overlap
    ? s.progress + REEL_TUNE.rateUp * dt
    : s.progress - REEL_TUNE.rateDown * dt;

  const next: ReelState = { barPos, barVel, fishPos, progress, t, kind: s.kind };
  if (progress >= 1) return { state: { ...next, progress: 1 }, outcome: "caught" };
  if (progress <= 0) return { state: { ...next, progress: 0 }, outcome: "escaped" };
  return { state: next, outcome: null };
}
