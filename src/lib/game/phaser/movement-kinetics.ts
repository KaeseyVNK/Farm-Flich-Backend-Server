// Kinetics thuần — gia tốc/làm chậm cho player. Không phụ thuộc Phaser (unit-test được).
export interface KineticsConfig {
  walkSpeed: number; // px/s
  runSpeed: number; // px/s
  accel: number; // px/s² khi có input
  braking: number; // px/s² khi thả phím
}

export const DEFAULT_KINETICS: KineticsConfig = {
  walkSpeed: 120,
  runSpeed: 190,
  accel: 900,
  braking: 1600,
};

/**
 * Tiệm cận velocity mục tiêu theo accel/braking. dir là vector input thô
 * (chưa normalize, ví dụ 1,1) — được normalize bên trong. dt giây.
 */
export function advanceVelocity(
  vx: number,
  vy: number,
  dirX: number,
  dirY: number,
  running: boolean,
  cfg: KineticsConfig,
  dt: number,
): { vx: number; vy: number } {
  const len = Math.hypot(dirX, dirY);
  let tvx = 0;
  let tvy = 0;
  if (len > 0) {
    const speed = running ? cfg.runSpeed : cfg.walkSpeed;
    tvx = (dirX / len) * speed;
    tvy = (dirY / len) * speed;
  }
  const rate = len > 0 ? cfg.accel : cfg.braking;
  const maxDelta = rate * dt;
  let nvx = vx + Math.max(-maxDelta, Math.min(maxDelta, tvx - vx));
  let nvy = vy + Math.max(-maxDelta, Math.min(maxDelta, tvy - vy));
  // Snap khi đã sát target — tránh float jitter quanh giá trị đích.
  if (Math.abs(nvx - tvx) < 0.5) nvx = tvx;
  if (Math.abs(nvy - tvy) < 0.5) nvy = tvy;
  return { vx: nvx, vy: nvy };
}

/** W6: kinetics khi cưỡi — nhân tốc, giữ accel/braking (không lướt vô trọng lực). */
export function mountKinetics(walkMult: number, runMult: number): KineticsConfig {
  const base = DEFAULT_KINETICS;
  return {
    ...base,
    walkSpeed: Math.round(base.walkSpeed * walkMult),
    runSpeed: Math.round(base.runSpeed * runMult),
  };
}
