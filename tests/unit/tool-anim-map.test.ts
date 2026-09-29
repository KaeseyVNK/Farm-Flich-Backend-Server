// @vitest-environment jsdom
// Import farm-scene kéo theo Phaser (cần DOM + canvas) — mock phaser để tránh
// side-effect canvas trong jsdom (convention farm-scene-run-anim.test.ts).
import { describe, it, expect, vi } from "vitest";

vi.mock("phaser", () => {
  class Scene {}
  return { Phaser: { Scene }, default: { Scene } };
});

import { TOOL_ANIM_FOR_KIND, TOOL_SHEET_FRAMES } from "@/components/game/scenes/farm-scene";

describe("tool anim mapping", () => {
  it("action kind → sheet anim", () => {
    expect(TOOL_ANIM_FOR_KIND.till).toBe("hoe");
    expect(TOOL_ANIM_FOR_KIND.water).toBe("water");
    expect(TOOL_ANIM_FOR_KIND.chop).toBe("axe");
    expect(TOOL_ANIM_FOR_KIND.mine).toBe("pickaxe");
  });
  it("kind không dùng tool → undefined", () => {
    // as const object không có key harvest/npc → index qua record cast.
    const map = TOOL_ANIM_FOR_KIND as Record<string, string | undefined>;
    expect(map.harvest).toBeUndefined();
    expect(map.npc).toBeUndefined();
  });
  it("sheet frame counts đúng grid pack", () => {
    expect(TOOL_SHEET_FRAMES).toEqual({ hoe: 6, water: 8, axe: 6, pickaxe: 6, sword: 10 });
  });
});
