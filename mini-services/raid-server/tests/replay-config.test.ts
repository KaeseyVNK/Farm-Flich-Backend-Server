import { describe, it, expect } from "bun:test";
import { replayConfigFromSession } from "../src/replay-config.js";

/** W7 audit-fix — /replay re-sim dùng DefenseConfig snapshot thay default hardcode. */
describe("replayConfigFromSession (W7 audit-fix)", () => {
  const terrain = [0, 0, 0];

  it("snapshot đầy đủ → dùng nguyên (dogs breed/patrol, traps, levels, chests, enterTile)", () => {
    const cfg = replayConfigFromSession(
      {
        mapId: "beach",
        thiefMaskId: "fox",
        bloodMoon: true,
        guardBonus: true,
        configSnapshot: {
          enterTile: { x: 2, y: 3 },
          dogs: [{ x: 5, y: 6, breed: "hound", patrol: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }],
          chests: [{ id: "chest-iron-1", x: 9, y: 9, kind: "iron" }],
          traps: [{ id: "trap-1", kind: "bear", tile: 40, durability: 5, level: 2 }],
          dogLevel: 3,
          trapLevel: 2,
        },
      },
      terrain,
      "sess-1",
    );
    expect(cfg.enterTile).toEqual({ x: 2, y: 3 });
    expect(cfg.dogs).toEqual([{ x: 5, y: 6, breed: "hound", patrol: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }]);
    expect(cfg.chests).toEqual([{ id: "chest-iron-1", x: 9, y: 9, kind: "iron" }]);
    expect(cfg.traps).toEqual([{ id: "trap-1", kind: "bear", tile: 40, durability: 5, level: 2 }]);
    expect(cfg.dogLevel).toBe(3);
    expect(cfg.trapLevel).toBe(2);
    expect(cfg.seed).toBe("sess-1");
    expect(cfg.mapId).toBe("beach");
    expect(cfg.maskId).toBe("fox");
    expect(cfg.bloodMoon).toBe(true);
    expect(cfg.guardBonus).toBe(true);
    expect(cfg.terrain).toBe(terrain);
  });

  it("session cũ KHÔNG snapshot → fallback default pre-snapshot (1 dog giữa, 1 chest, 0 trap)", () => {
    const cfg = replayConfigFromSession({}, undefined, "s2");
    expect(cfg.dogs).toEqual([{ x: 15, y: 10 }]);
    expect(cfg.chests).toEqual([{ id: "chest-wood-1", x: 20, y: 10, kind: "wood" }]);
    expect(cfg.enterTile).toEqual({ x: 1, y: 1 });
    expect(cfg.traps).toBeUndefined();
    expect(cfg.dogLevel).toBeUndefined();
    expect(cfg.terrain).toHaveLength(660);
  });

  it("snapshot rác (dog out-of-bounds, chest thiếu id, trap kind lạ) → drop entry rác, không crash", () => {
    const cfg = replayConfigFromSession(
      {
        configSnapshot: {
          enterTile: { x: 99, y: -1 },
          dogs: [{ x: 5, y: 6 }, { x: 999, y: 0 }, null, "x"],
          chests: [{ x: 1, y: 1 }, { id: "ok", x: 2, y: 2 }],
          traps: [{ id: "t1", tile: 10 }, { id: "t2", kind: "lava", tile: 12 }],
          dogLevel: 99,
          trapLevel: "bad",
        } as never,
      },
      terrain,
      "s3",
    );
    // enterTile rác → default; dog rác drop (còn 1 hợp lệ); chest thiếu id drop;
    // trap kind lạ coerce spike; levels clamp về 1.
    expect(cfg.enterTile).toEqual({ x: 1, y: 1 });
    expect(cfg.dogs).toEqual([{ x: 5, y: 6 }]);
    expect(cfg.chests).toEqual([{ id: "ok", x: 2, y: 2, kind: undefined }]);
    expect(cfg.traps).toEqual([
      { id: "t1", kind: "spike", tile: 10, durability: 3, level: 1 },
      { id: "t2", kind: "spike", tile: 12, durability: 3, level: 1 },
    ]);
    expect(cfg.dogLevel).toBe(1);
    expect(cfg.trapLevel).toBe(1);
  });

  it("snapshot dogs/chests sanitize rỗng hết → fallback default (không re-sim map trống)", () => {
    const cfg = replayConfigFromSession(
      { configSnapshot: { enterTile: { x: 0, y: 0 }, dogs: [], chests: [], traps: [], dogLevel: 2, trapLevel: 2 } as never },
      terrain,
      "s4",
    );
    expect(cfg.dogs).toEqual([{ x: 15, y: 10 }]);
    expect(cfg.chests).toEqual([{ id: "chest-wood-1", x: 20, y: 10, kind: "wood" }]);
  });
});
