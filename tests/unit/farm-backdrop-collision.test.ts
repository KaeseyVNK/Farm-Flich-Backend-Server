import { describe, expect, it } from "vitest";
import { pointHitsBackdropSolid } from "@/lib/game/phaser/farm-backdrop";

describe("farm backdrop collision", () => {
  it("path crossroads at painting center is walkable", () => {
    expect(pointHitsBackdropSolid(0.5, 0.5)).toBe(false);
  });

  it("cottage blocks movement", () => {
    expect(pointHitsBackdropSolid(0.5, 0.22)).toBe(true);
  });

  it("pond blocks movement", () => {
    expect(pointHitsBackdropSolid(0.5, 0.78)).toBe(true);
  });

  it("outside the perimeter fence is solid", () => {
    expect(pointHitsBackdropSolid(0.02, 0.5)).toBe(true);
    expect(pointHitsBackdropSolid(0.5, 0.02)).toBe(true);
    expect(pointHitsBackdropSolid(0.28, 0.52)).toBe(false);
  });
});
