// Anim state machine thuần cho locomotion (idle/walk/run × 4 hướng).
export type Facing = "up" | "down" | "left" | "right";
export type Locomotion = "idle" | "walk" | "run";
export interface LocomotionState {
  anim: Locomotion;
  facing: Facing;
}

/**
 * speed = |velocity| hiện tại. Hysteresis ở quanh runMin để không nhấp nháy
 * walk↔run khi tốc độ dao động quanh ngưỡng (giữ anim cũ nếu nằm giữa 2 ngưỡng).
 */
export function nextLocomotion(
  prev: LocomotionState,
  speed: number,
  facing: Facing,
  opts?: { walkMin?: number; runMin?: number },
): LocomotionState {
  const walkMin = opts?.walkMin ?? 15;
  const runMin = opts?.runMin ?? 165;
  let anim: Locomotion;
  if (speed < walkMin) anim = "idle";
  else if (speed >= runMin) anim = "run";
  else anim = prev.anim === "run" ? "run" : "walk"; // hysteresis band
  return { anim, facing };
}
