import { describe, expect, it } from "vitest";
import { slideMove } from "@/lib/game/phaser/axis-move";

/** Horizontal wall: y < 100 is solid. */
function wall(x: number, y: number): boolean {
  return y < 100;
}

describe("slideMove", () => {
  it("stops at a wall instead of embedding, so later moves still work", () => {
    const after = slideMove(50, 108, 0, -16, wall);
    expect(after.y).toBeGreaterThanOrEqual(100);
    expect(wall(after.x, after.y)).toBe(false);
    const down = slideMove(after.x, after.y, 0, 16, wall);
    expect(down.y).toBe(after.y + 16);
  });

  it("slides along a wall when moving diagonally into it", () => {
    const after = slideMove(50, 108, 12, -16, wall);
    expect(after.x).toBe(62);
    expect(wall(after.x, after.y)).toBe(false);
  });

  it("pulls a body already inside a solid back into free space", () => {
    const after = slideMove(50, 90, 0, 0, wall);
    expect(wall(after.x, after.y)).toBe(false);
  });
});

describe("broken both-axes-then-revert (characterization)", () => {
  it("documents why FarmScene used to freeze after touching a wall", () => {
    let x = 50;
    let y = 108;
    const vx = 0;
    // widen kiểu number — literal -16 khiến so sánh `vy !== 0` bị TS coi là luôn đúng.
    const vy: number = -16;
    x += vx;
    y += vy;
    if (vx !== 0 && wall(x - vx, y)) x -= vx;
    if (vy !== 0 && wall(x, y - vy)) y -= vy;
    expect(wall(x, y)).toBe(true);
  });
});
