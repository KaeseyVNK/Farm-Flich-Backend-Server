// Feedback bundle (ADR-020 game-feel juice tiers). 3 tier per combat event.
// Event: harvest, hit-enemy, blood-moon-start, level-up, death, warp.
// Hit-stop = real-time wait (ignore_time_scale=true) — không WaitForSeconds.
// Shake compose với camera follow (ADR-003) qua trauma² × noise.
// ponytail: 0 prod caller — wire khi FarmScene/combat hook emit game-feel events
// (harvest shake, hit-stop, particle burst). Pure logic ready, needs Phaser scene hook.

export type FeedbackTier = "small" | "medium" | "large";
export type FeedbackEvent =
  | "harvest"
  | "hit-enemy"
  | "blood-moon-start"
  | "level-up"
  | "death"
  | "warp";

export interface FeedbackSpec {
  shake: number; // trauma [0,1]
  hitStop: number; // seconds real-time
  particles: number;
  sfx: string;
}

export const FEEDBACK_TIERS: Record<FeedbackTier, FeedbackSpec> = {
  small: { shake: 0.15, hitStop: 0, particles: 0, sfx: "tick" },
  medium: { shake: 0.4, hitStop: 0.05, particles: 6, sfx: "hit" },
  large: { shake: 0.8, hitStop: 0.12, particles: 30, sfx: "boom" },
};

/** Event → tier mapping. */
export const EVENT_TIER: Record<FeedbackEvent, FeedbackTier> = {
  harvest: "small",
  "hit-enemy": "medium",
  "blood-moon-start": "large",
  "level-up": "large",
  death: "large",
  warp: "small",
};

/** Resolve spec cho event. */
export function specForEvent(event: FeedbackEvent): FeedbackSpec {
  return FEEDBACK_TIERS[EVENT_TIER[event]];
}

/**
 * Hit-stop scheduler. Hit-stop = real-time wait (KHÔNG time-scale).
 * Trả ms cần chờ (real-time). Caller busy-wait/sleep real ms, không scale.
 */
export function hitStopMs(spec: FeedbackSpec): number {
  return spec.hitStop * 1000;
}

/** Particle budget guard — clamp particle count theo budget pool. */
export function clampParticles(requested: number, budgetRemaining: number): number {
  return Math.max(0, Math.min(requested, budgetRemaining));
}

/**
 * prefers-reduced-motion: kill shake + hit-stop, giữ particles 0.
 * Phase 8 wire matchMedia; helper pure cho test.
 */
export function applyReducedMotion(spec: FeedbackSpec, reduced: boolean): FeedbackSpec {
  if (!reduced) return spec;
  return { ...spec, shake: 0, hitStop: 0, particles: 0 };
}
