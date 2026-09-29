// Zone scenery solid dispatch + generic renderer contract tests.
// No Phaser import: SceneryScene is a plain structural mock.
import { describe, it, expect } from "vitest";
import {
  getZoneScenery,
  isZoneScenerySolid,
  registerZoneScenery,
} from "../../src/lib/game/scenery";
import type { SpritePlacement, ZoneScenery } from "../../src/lib/game/scenery/types";
import { ZoneSceneryRenderer } from "../../src/components/game/phaser/zone-scenery-renderer";
import { TILE_SIZE } from "../../src/lib/game/constants";

describe("isZoneScenerySolid dispatch", () => {
  it("returns false for an unknown zone", () => {
    expect(isZoneScenerySolid("atlantis", 5, 5)).toBe(false);
    expect(getZoneScenery("atlantis")).toBeUndefined();
  });

  it("routes farm to the isFarmScenerySolid fallback", () => {
    expect(isZoneScenerySolid("farm", 12, 9)).toBe(true); // farmhouse wall
    expect(isZoneScenerySolid("farm", 12, 12)).toBe(false); // courtyard spawn
  });

  it("serves registered zones from the registry", () => {
    const placements: readonly SpritePlacement[] = [
      { key: "obj.missing", tx: 2, ty: 3, cols: 2, rows: 2, fallbackColor: 0x123456 },
    ];
    const fake: ZoneScenery = {
      placements,
      isSolid: (tx, ty) => tx === 1 && ty === 2,
    };
    registerZoneScenery("fake-solid-zone", fake);
    expect(isZoneScenerySolid("fake-solid-zone", 1, 2)).toBe(true);
    expect(isZoneScenerySolid("fake-solid-zone", 0, 0)).toBe(false);
    expect(getZoneScenery("fake-solid-zone")).toBe(fake);
  });
});
