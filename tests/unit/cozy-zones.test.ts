import { describe, expect, it } from "vitest";
import { CAVE_ZONE, FARM_ZONE, HOUSE_ZONE, getZone, isBedTile, type ZoneId } from "@/lib/game/zones";
import { T } from "@/lib/game/constants";
import { useWorldStore } from "@/store/worldStore";
import { FARM_TREES, isFarmScenerySolid } from "@/lib/game/farm-scenery-layout";

describe("Tidecrest zones", () => {
  it("exposes 5 walkable zones with warps", () => {
    expect(["farm", "house", "village", "cave", "beach"].map((id) => getZone(id as ZoneId)).every((z) => z.warps.length > 0)).toBe(true);
  });

  it("house has a bed and a door back to the farm", () => {
    expect(isBedTile(HOUSE_ZONE, 4, 3)).toBe(true);
    expect(HOUSE_ZONE.warps[0]?.to).toBe("farm");
    expect(HOUSE_ZONE.terrain[11 * HOUSE_ZONE.cols + 8]).toBe(T.PATH);
  });

  it("farm door and village gate are walkable scenery", () => {
    expect(isFarmScenerySolid(11, 10)).toBe(false);
    expect(isFarmScenerySolid(51, 0)).toBe(false);
    expect(isFarmScenerySolid(20, 0)).toBe(false);
    expect(isFarmScenerySolid(20, 58)).toBe(false);
  });

  it("meadow has flower tiles and a tree ring, not three lone trees", () => {
    const flowers = FARM_ZONE.terrain.filter((t) => t === T.GRASS_FLOWER).length;
    expect(flowers).toBeGreaterThan(50);
    expect(FARM_TREES.length).toBeGreaterThan(20);
  });

  it("cave rocks sit on authored ROCK tiles", () => {
    for (const rock of CAVE_ZONE.rocks) {
      expect(CAVE_ZONE.terrain[rock.y * CAVE_ZONE.cols + rock.x]).toBe(T.ROCK);
    }
  });

  it("farm pond is water", () => {
    const i = 23 * FARM_ZONE.cols + 9;
    expect(FARM_ZONE.terrain[i]).toBe(T.WATER);
  });
});

describe("worldStore well + water", () => {
  it("refills the can after the well is repaired", () => {
    useWorldStore.getState().reset();
    expect(useWorldStore.getState().wellRepaired).toBe(false);
    useWorldStore.getState().repairWell();
    useWorldStore.getState().refillCan();
    expect(useWorldStore.getState().waterCharges).toBe(40);
  });

  it("enterZone records pending spawn", () => {
    useWorldStore.getState().enterZone("house", { x: 8, y: 9 });
    expect(useWorldStore.getState().zone).toBe("house");
    expect(useWorldStore.getState().pendingSpawn).toEqual({ x: 8, y: 9 });
  });
});
