// Clock hand rotation math (phase 5). timeMinutes 0..1439 → angle deg.
// Pure logic (testable). Wire CSS transform trong component.
// 0 min = midnight (hand lên top); 360 min = 6h; 720 = noon.

/** Minutes 0..1439 → hour-hand angle (0 deg = top, clockwise). 24h full rotation. */
export function hourHandAngle(timeMinutes: number): number {
  const dayMin = 1440;
  const t = ((timeMinutes % dayMin) + dayMin) % dayMin;
  return (t / dayMin) * 360;
}

/** Minute-hand angle (full rotation per hour). */
export function minuteHandAngle(timeMinutes: number): number {
  const minPerHour = 60;
  const m = ((timeMinutes % minPerHour) + minPerHour) % minPerHour;
  return (m / minPerHour) * 360;
}

/** Convert angle deg → CSS transform rotate string. */
export function rotateTransform(angleDeg: number): string {
  return `rotate(${angleDeg}deg)`;
}

/** Normalize angle về [0, 360). */
export function normalizeAngle(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}
