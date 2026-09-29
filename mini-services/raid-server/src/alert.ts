import {
  ALERT_STEALTH,
  ALERT_CAUTION,
  ALERT_ALARM,
  ALERT_DECAY_PER_SEC,
  ALERT_DECAY_GRACE_MS,
} from "./constants.js";
import type { AlertLevel } from "./types.js";

/**
 * Alert FSM (concept §9, design §Raid HUD).
 * Internal score 0-100; UI 3 cấp Stealth/Caution/Alarm.
 * Triggers: puzzle fail, dog vision hit, trap sprung, lockdown.
 * Decay: -5/s sau 4s không trigger.
 */

export function levelFromScore(score: number): AlertLevel {
  if (score < ALERT_STEALTH) return "stealth"; // <25
  if (score < ALERT_ALARM) return "caution"; // 25..79
  return "alarm"; // ≥80
}

/** Bump score (+n), clamp [0,100]. Trả score mới. */
export function bumpScore(cur: number, n: number): number {
  return Math.max(0, Math.min(100, cur + n));
}

/**
 * Decay score. Không decay trong grace period (4s sau trigger cuối).
 * dtMs = delta từ tick trước; sinceTriggerMs = ms kể từ trigger cuối.
 * decayMult = alertDecayMult (phantom mask 1.5) × biome.decayMul (phase 4/7).
 */
export function decayScore(
  cur: number,
  dtMs: number,
  sinceTriggerMs: number,
  decayMult = 1,
): number {
  if (sinceTriggerMs < ALERT_DECAY_GRACE_MS) return cur;
  return Math.max(0, cur - ALERT_DECAY_PER_SEC * decayMult * (dtMs / 1000));
}

/** AlertState đầy đủ — room giữ + tick. */
export class AlertState {
  score = 0;
  lastTriggerMs = 0;
  constructor(private nowMs: () => number = Date.now) {}

  get level(): AlertLevel {
    return levelFromScore(this.score);
  }

  bump(n: number): AlertLevel {
    this.score = bumpScore(this.score, n);
    this.lastTriggerMs = this.nowMs();
    return this.level;
  }

  tick(dtMs: number, decayMult = 1): AlertLevel {
    this.score = decayScore(this.score, dtMs, this.nowMs() - this.lastTriggerMs, decayMult);
    return this.level;
  }
}
