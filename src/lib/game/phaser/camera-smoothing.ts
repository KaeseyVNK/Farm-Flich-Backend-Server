// Camera exponential smoothing (ADR-003). Frame-rate independent: không lerp per-frame.
// pos += (target - pos) * (1 - exp(-rate * dt)). rate=8 → snappy mà không jitter.
// 30/60/144 FPS cho cùng kết quả (test verify). Deadzone box + look-ahead + shake hook.

export const CAMERA_RATE = 8; // smoothing rate
export const DEADZONE_W = 48; // box width (px) — player ra ngoài → chase
export const DEADZONE_H = 32;
export const LOOKAHEAD = 24; // px offset theo velocity direction
export const LOOKAHEAD_RATE = 5; // ease look-ahead in/out

export interface CamState {
  x: number;
  y: number;
  lookaheadX: number;
  lookaheadY: number;
}

export function createCamState(x = 0, y = 0): CamState {
  return { x, y, lookaheadX: 0, lookaheadY: 0 };
}

/**
 * Exponential smoothing — frame-rate independent. dt tính bằng giây.
 * Pure function: same (pos, target, dt) → same output bất kể FPS.
 */
export function smoothExp(pos: number, target: number, dt: number, rate = CAMERA_RATE): number {
  return pos + (target - pos) * (1 - Math.exp(-rate * dt));
}

/**
 * Update camera theo target + deadzone + look-ahead. Trả new state.
 * Deadzone: chỉ chase khi target ra ngoài box quanh camera center.
 * Look-ahead: offset theo velocity (vx/vy px/s), eased.
 */
export function updateCamera(
  cam: CamState,
  targetX: number,
  targetY: number,
  vx: number,
  vy: number,
  dt: number,
): CamState {
  // Deadzone: target offset từ cam center.
  const dx = targetX - cam.x;
  const dy = targetY - cam.y;
  let chaseX = cam.x;
  let chaseY = cam.y;
  if (Math.abs(dx) > DEADZONE_W / 2) chaseX = targetX - Math.sign(dx) * (DEADZONE_W / 2);
  if (Math.abs(dy) > DEADZONE_H / 2) chaseY = targetY - Math.sign(dy) * (DEADZONE_H / 2);

  // Look-ahead target (eased toward velocity direction).
  const laTargetX = Math.sign(vx) * Math.min(Math.abs(vx) / 100, 1) * LOOKAHEAD;
  const laTargetY = Math.sign(vy) * Math.min(Math.abs(vy) / 100, 1) * LOOKAHEAD;

  return {
    x: smoothExp(cam.x, chaseX, dt),
    y: smoothExp(cam.y, chaseY, dt),
    lookaheadX: smoothExp(cam.lookaheadX, laTargetX, dt, LOOKAHEAD_RATE),
    lookaheadY: smoothExp(cam.lookaheadY, laTargetY, dt, LOOKAHEAD_RATE),
  };
}

/** Final camera position = smoothed + look-ahead + shake offset. */
export function cameraFinalPos(cam: CamState, shakeX = 0, shakeY = 0): { x: number; y: number } {
  return { x: cam.x + cam.lookaheadX + shakeX, y: cam.y + cam.lookaheadY + shakeY };
}

/** Trauma² × noise → shake offset. trauma [0,1]. expose cho game-feel phase 4. */
export function shakeOffset(trauma: number, noise: number): number {
  return trauma * trauma * noise;
}

/** Clamp camera trong world bounds.
 *  `viewW`/`viewH` là kích thước canvas (px màn). `zoom` (mặc định 1) đổi sang
 *  world visible — zoom 2/3 → thấy 1.5× canvas; không chia zoom thì half-view
 *  hẹp hơn thực tế và cam có thể trôi sát mép thế giới hơn Phaser setBounds.
 *  Zone nhỏ hơn viewport (nhà 16×12) → ghim tâm map, không invert min/max. */
export function clampCamera(
  x: number,
  y: number,
  worldW: number,
  worldH: number,
  viewW: number,
  viewH: number,
  zoom = 1,
): { x: number; y: number } {
  const visW = zoom > 0 ? viewW / zoom : viewW;
  const visH = zoom > 0 ? viewH / zoom : viewH;
  return {
    x: clampAxis(x, worldW, visW),
    y: clampAxis(y, worldH, visH),
  };
}

function clampAxis(pos: number, world: number, vis: number): number {
  if (world <= vis) return world / 2;
  const half = vis / 2;
  return Math.max(half, Math.min(pos, world - half));
}

/** Làm tròn world-px sao cho `x * zoom` là số nguyên px màn — zoom 2/3 không
 *  shimmer khi pan (pixelArt + roundPixels đánh với phân số 0.666…). */
export function quantizeForZoom(x: number, zoom: number): number {
  if (!(zoom > 0) || !Number.isFinite(x)) return x;
  const step = 1 / zoom;
  return Math.round(x / step) * step;
}
