// SpriteAnimator — frame index advance theo delta, loop/pingpong. 8 FPS = 125ms/frame.
// Pure logic (testable); Phaser Animation API wire ở scene (browser).
export type AnimMode = "loop" | "pingpong" | "once";

export interface AnimatorState {
  frame: number;
  elapsed: number;
  direction: 1 | -1; // pingpong flip
  done: boolean; // once mode
}

export const ANIM_FPS = 8;
export const ANIM_FRAME_MS = 1000 / ANIM_FPS; // 125

export function createAnimator(): AnimatorState {
  return { frame: 0, elapsed: 0, direction: 1, done: false };
}

/**
 * Advance animator theo deltaMs. Trả current frame index.
 * mode: loop = wrap; pingpong = bounce; once = stop ở last frame.
 */
export function advance(
  state: AnimatorState,
  deltaMs: number,
  frameCount: number,
  mode: AnimMode = "loop",
): number {
  if (state.done || frameCount <= 1) return state.frame;
  state.elapsed += deltaMs;
  while (state.elapsed >= ANIM_FRAME_MS) {
    state.elapsed -= ANIM_FRAME_MS;
    state.frame += state.direction;
    if (mode === "loop") {
      if (state.frame >= frameCount) state.frame = 0;
      else if (state.frame < 0) state.frame = frameCount - 1;
    } else if (mode === "pingpong") {
      if (state.frame >= frameCount - 1) {
        state.frame = frameCount - 1;
        state.direction = -1;
      } else if (state.frame <= 0) {
        state.frame = 0;
        state.direction = 1;
      }
    } else {
      // once
      if (state.frame >= frameCount - 1) {
        state.frame = frameCount - 1;
        state.done = true;
        break;
      }
    }
  }
  return state.frame;
}

export function reset(state: AnimatorState): void {
  state.frame = 0;
  state.elapsed = 0;
  state.direction = 1;
  state.done = false;
}
