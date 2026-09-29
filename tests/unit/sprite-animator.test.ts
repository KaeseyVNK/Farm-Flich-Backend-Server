import { describe, it, expect, beforeEach } from "vitest";
import { createAnimator, advance, reset, ANIM_FRAME_MS } from "../../src/lib/game/sprite-animator";

describe("SpriteAnimator", () => {
  let a: ReturnType<typeof createAnimator>;
  beforeEach(() => {
    a = createAnimator();
  });

  it("loop: wrap khi quá frameCount", () => {
    // 4 frame, advance 1.5 frame-time → frame 1
    advance(a, ANIM_FRAME_MS * 1.5, 4, "loop");
    expect(a.frame).toBe(1);
    // advance đủ wrap
    advance(a, ANIM_FRAME_MS * 4, 4, "loop");
    expect(a.frame).toBeLessThan(4);
  });

  it("loop frame index luôn < frameCount", () => {
    for (let i = 0; i < 50; i++) advance(a, ANIM_FRAME_MS, 4, "loop");
    expect(a.frame).toBeGreaterThanOrEqual(0);
    expect(a.frame).toBeLessThan(4);
  });

  it("pingpong: bounce tại boundary, đổi direction", () => {
    // 3 frame [0,1,2]. Advance qua 2 → frame 2, direction -1.
    advance(a, ANIM_FRAME_MS * 2, 3, "pingpong");
    expect(a.frame).toBe(2);
    expect(a.direction).toBe(-1);
    // advance 2 nữa → frame 0, direction 1
    advance(a, ANIM_FRAME_MS * 2, 3, "pingpong");
    expect(a.frame).toBe(0);
    expect(a.direction).toBe(1);
  });

  it("once: stop ở last frame, done=true", () => {
    advance(a, ANIM_FRAME_MS * 10, 3, "once");
    expect(a.frame).toBe(2);
    expect(a.done).toBe(true);
  });

  it("once done: advance tiếp không đổi frame", () => {
    advance(a, ANIM_FRAME_MS * 10, 3, "once");
    const f = a.frame;
    advance(a, ANIM_FRAME_MS * 5, 3, "once");
    expect(a.frame).toBe(f);
  });

  it("frameCount=1: luôn frame 0", () => {
    advance(a, ANIM_FRAME_MS * 5, 1, "loop");
    expect(a.frame).toBe(0);
  });

  it("reset clears state", () => {
    advance(a, ANIM_FRAME_MS * 3, 4, "loop");
    reset(a);
    expect(a.frame).toBe(0);
    expect(a.elapsed).toBe(0);
    expect(a.done).toBe(false);
  });

  it("ANIM_FRAME_MS = 125 (8 FPS)", () => {
    expect(ANIM_FRAME_MS).toBe(125);
  });
});
