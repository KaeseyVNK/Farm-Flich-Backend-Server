import { describe, it, expect } from "bun:test";
import { RaidRoom } from "../src/room.js";
import { LIVE_RAID_CHESTS } from "../src/live-chests.js";

describe("LIVE_RAID_CHESTS", () => {
  it("3 kind wood/iron/safe, không trùng entry (1,1)", () => {
    expect(LIVE_RAID_CHESTS).toHaveLength(3);
    expect(LIVE_RAID_CHESTS.map((c) => c.kind).sort()).toEqual(["iron", "safe", "wood"]);
    for (const c of LIVE_RAID_CHESTS) {
      expect(c.x === 1 && c.y === 1).toBe(false);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(30);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(22);
    }
  });

  it("RaidRoom start với đủ 3 kind", () => {
    const room = new RaidRoom({
      terrain: new Array(660).fill(0),
      enterTile: { x: 1, y: 1 },
      dogs: [{ x: 15, y: 10 }],
      chests: LIVE_RAID_CHESTS,
      seed: "sess",
    });
    expect(room.chests).toHaveLength(3);
    expect(new Set(room.chests.map((c) => c.kind))).toEqual(new Set(["wood", "iron", "safe"]));
  });
});
