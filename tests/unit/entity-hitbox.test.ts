import { describe, it, expect } from "vitest";
import { entityHitbox, hitboxesOverlap, clampHitbox } from "../../src/lib/game/entity-hitbox";
import { TILE_SIZE } from "../../src/lib/game/constants";

describe("Entity hitbox (tách render vs collision)", () => {
  it("hitbox nhỏ hơn render box (ratio 0.6)", () => {
    const box = entityHitbox(0, 0, TILE_SIZE, TILE_SIZE, 0.6);
    expect(box.w).toBe(TILE_SIZE * 0.6);
    expect(box.h).toBe(TILE_SIZE * 0.6);
    expect(box.w).toBeLessThan(TILE_SIZE);
  });

  it("hitbox center-aligned với render rect", () => {
    const renderX = 100;
    const box = entityHitbox(renderX, 100, TILE_SIZE, TILE_SIZE, 0.6);
    const renderCenterX = renderX + TILE_SIZE / 2;
    const boxCenterX = box.x + box.w / 2;
    expect(boxCenterX).toBeCloseTo(renderCenterX);
  });

  it("hitboxesOverlap: overlap true; separate false", () => {
    const a = entityHitbox(0, 0, 48, 48, 1);
    const b = entityHitbox(40, 0, 48, 48, 1);
    expect(hitboxesOverlap(a, b)).toBe(true);
    const c = entityHitbox(100, 0, 48, 48, 1);
    expect(hitboxesOverlap(a, c)).toBe(false);
  });

  it("clampHitbox: trong world bounds", () => {
    const worldW = 2880;
    const box = { x: worldW - 10, y: 0, w: 48, h: 48 };
    const clamped = clampHitbox(box, worldW, 2880);
    expect(clamped.x).toBe(worldW - 48);
    expect(clamped.x).toBeGreaterThanOrEqual(0);
  });

  it("hitbox ≠ render box mặc định (ratio < 1)", () => {
    const box = entityHitbox(0, 0, TILE_SIZE, TILE_SIZE);
    expect(box.w).not.toBe(TILE_SIZE);
  });
});
