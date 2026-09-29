// Wave 1 P2 — fishing state machine (pure). Bảng chuyển:
// idle → casting → wait → bite → tap: common caught / medium+rài reel → caught|escaped.
// Miss cửa sổ bite → escaped; cancel bất kỳ → idle; tap trong wait = no-op.
// now (ms) + rng inject → deterministic cho unit test + e2e seed.
import { FISH, fishForZone, type FishDef, type WaterZone } from "@/lib/game/fish-catalog";
import { initReel, updateReel, type ReelState, type Rng } from "./reel-bar";

export type Rng2 = Rng;

/** Mọi hằng số timing tập trung đây (P4/P6 human gate tune — không đổi logic). */
export const FISHING_TUNE = {
  /** Thời gian anim quẳng cần (ms). */
  castMs: 600,
  /** Khoảng chờ cá cắn (ms) — roll đều trong [min, max]. */
  waitMinMs: 2500,
  waitMaxMs: 9000,
  /** Cửa sổ tap khi cá cắn (ms) — càng hiếm càng hẹp. */
  biteWindow: { common: 1200, medium: 1000, rare: 800 } as const,
} as const;

export type FishingPhase = "idle" | "casting" | "wait" | "bite" | "reel" | "caught" | "escaped";

export interface FishingSession {
  phase: FishingPhase;
  /** Cá đã roll lúc cast — ẩn với player đến khi caught. */
  fishId?: string;
  castAt?: number;
  /** Thời điểm cá cắn (kết thúc wait). */
  biteAt?: number;
  /** Hết hạn cửa sổ tap. */
  biteDeadline?: number;
  reel?: ReelState;
}

export function idleSession(): FishingSession {
  return { phase: "idle" };
}

export type FishingEvent =
  | { type: "cast"; now: number; zone: WaterZone; level: number }
  | { type: "tick"; now: number; dt?: number; holding?: boolean }
  | { type: "tap"; now: number }
  | { type: "cancel" };

const RARITY_WEIGHT = { common: 0.7, medium: 0.25, rare: 0.05 } as const;

/** Roll cá theo pool (zone + level) với weight rarity — common 70 / medium 25 / rare 5. */
export function rollFish(zone: WaterZone, level: number, rng: Rng): FishDef {
  const pool = fishForZone(zone, level);
  const list = pool.length > 0 ? pool : [...FISH];
  const byRarity = { common: 0, medium: 0, rare: 0 } as Record<string, number>;
  for (const f of list) byRarity[f.rarity]++;
  let acc = 0;
  const cum = list.map((f) => {
    acc += RARITY_WEIGHT[f.rarity] / byRarity[f.rarity];
    return acc;
  });
  const x = rng() * acc;
  for (let i = 0; i < list.length; i++) {
    if (x <= cum[i]) return list[i];
  }
  return list[list.length - 1];
}

function rarityOf(fishId: string): FishDef["rarity"] {
  return FISH.find((f) => f.id === fishId)?.rarity ?? "common";
}

/** Bước chuyển state machine — pure, trả state mới. */
export function nextFishing(
  s: FishingSession,
  e: FishingEvent,
  rng: Rng,
): FishingSession {
  switch (e.type) {
    case "cast": {
      const fish = rollFish(e.zone, e.level, rng);
      const wait = FISHING_TUNE.waitMinMs + rng() * (FISHING_TUNE.waitMaxMs - FISHING_TUNE.waitMinMs);
      return {
        phase: "casting",
        fishId: fish.id,
        castAt: e.now,
        biteAt: e.now + FISHING_TUNE.castMs + wait,
      };
    }
    case "tick": {
      switch (s.phase) {
        case "casting":
          if (s.castAt != null && e.now >= s.castAt + FISHING_TUNE.castMs) {
            return { ...s, phase: "wait" };
          }
          return s;
        case "wait":
          if (s.biteAt != null && e.now >= s.biteAt) {
            const window = FISHING_TUNE.biteWindow[rarityOf(s.fishId ?? "")];
            return { ...s, phase: "bite", biteDeadline: e.now + window };
          }
          return s;
        case "bite":
          if (s.biteDeadline != null && e.now > s.biteDeadline) {
            return { ...s, phase: "escaped" };
          }
          return s;
        case "reel": {
          if (!s.reel) return s;
          const { state, outcome } = updateReel(
            s.reel,
            e.dt ?? 0,
            e.holding ?? false,
            rng,
          );
          if (outcome === "caught") return { ...s, phase: "caught", reel: state };
          if (outcome === "escaped") return { ...s, phase: "escaped", reel: state };
          return { ...s, reel: state };
        }
        default:
          return s;
      }
    }
    case "tap": {
      if (s.phase === "bite") {
        const rarity = rarityOf(s.fishId ?? "");
        if (rarity === "common") return { ...s, phase: "caught" };
        return { ...s, phase: "reel", reel: initReel(rarity, rng) };
      }
      // Tap khi chưa cắn: no-op (không phạt giật sớm).
      return s;
    }
    case "cancel":
      return idleSession();
  }
}
