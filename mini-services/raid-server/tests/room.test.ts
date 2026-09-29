import { describe, it, expect } from "bun:test";
import { RaidRoom } from "../src/room";
import { MAP_COLS, T, MAX_BITES } from "../src/constants";

const grass = (): number[] => new Array(MAP_COLS * 22).fill(T.GRASS);
const withWall = (t: number[], x: number, y: number) => {
  const o = [...t];
  o[y * MAP_COLS + x] = T.ROCK;
  return o;
};

function makeRoom(opts: Partial<ConstructorParameters<typeof RaidRoom>[0]> = {}) {
  return new RaidRoom({
    terrain: opts.terrain ?? grass(),
    enterTile: opts.enterTile ?? { x: 1, y: 1 },
    dogs: opts.dogs ?? [{ x: 15, y: 10 }],
    chests: opts.chests ?? [{ id: "c1", x: 20, y: 10 }],
    seed: opts.seed ?? "test-raid",
    mapId: opts.mapId,
    bloodMoon: opts.bloodMoon,
  });
}

describe("RaidRoom init", () => {
  it("raider ở enter tile, dog ở vị trí mình, chest đóng", () => {
    const r = makeRoom();
    expect(r.raider.x === 1 && r.raider.y === 1).toBe(true);
    expect(r.dogs).toHaveLength(1);
    expect(r.dogs[0].x === 15 && r.dogs[0].y === 10).toBe(true);
    expect(r.chests[0].open).toBe(false);
    expect(r.ended).toBeNull();
  });
});

describe("applyMove + collision", () => {
  it("move hợp lệ → đổi vị trí", () => {
    const r = makeRoom();
    r.applyMove(1, 0);
    expect(r.raider.x).toBe(2);
    expect(r.raider.facing).toBe("right");
  });
  it("va tile solid → KHÔNG di chuyển", () => {
    const t = withWall(grass(), 2, 1);
    const r = makeRoom({ terrain: t });
    r.applyMove(1, 0);
    expect(r.raider.x).toBe(1); // bị chặn
  });
});

describe("dog AI", () => {
  it("patrol khi không thấy raider (alert thấp)", () => {
    const r = makeRoom();
    r.tick(100);
    // dog không bite (xa raider)
    expect(r.bites).toBe(0);
  });
  it("chase + bump alert khi thấy raider (LOS clear, trong tầm)", () => {
    // dog cạnh raider, grass → thấy
    const r = makeRoom({ dogs: [{ x: 5, y: 1 }] });
    // raider ở (1,1), dog (5,1): dist 4 <= vision 6, LOS clear grass
    r.tick(100);
    expect(r.alert.score).toBeGreaterThan(0);
  });
  it("bite 3 = caught → room ended", () => {
    // dog cùng tile raider → bite mỗi tick
    const r = makeRoom({ dogs: [{ x: 1, y: 1 }] });
    for (let i = 0; i < MAX_BITES; i++) r.tick(100);
    expect(r.bites).toBeGreaterThanOrEqual(MAX_BITES);
    expect(r.ended?.reason).toBe("caught");
  });
});

describe("snapshot (audit C3 — velocity, KHÔNG trap)", () => {
  it("kèm dx,dy + không có field trap", () => {
    const r = makeRoom();
    r.applyMove(1, 0);
    const snap = r.snapshot();
    expect(snap.you.dx).toBe(1);
    expect(snap.you.dy).toBe(0);
    expect(snap.dogs[0]).toHaveProperty("dx");
    expect(snap.dogs[0]).toHaveProperty("dy");
    // trap KHÔNG trong snapshot (audit H5/§3.2)
    expect(JSON.stringify(snap)).not.toContain("trap");
  });
});

describe("trap collision (phase 1)", () => {  it("raider dẫm trap → pendingTrapEvents + decay durability + remove", () => {
    const r = new RaidRoom({
      terrain: new Array(MAP_COLS * 22).fill(T.GRASS),
      enterTile: { x: 1, y: 1 },
      dogs: [],
      chests: [],
      seed: "s",
      traps: [{ id: "t1", kind: "spike", tile: 1 * MAP_COLS + 2, durability: 1, level: 1 }],
    });
    // di chuyển raider sang tile trap (x: 1→2 cùng y=1, tile = 1*30+2 = 32... đặt trap đúng tile)
    // trap tile = 1*MAP_COLS+2 = 32. Raider ở (1,1) tile=31. move +1 → (2,1) tile=32 = trap.
    r.applyMove(1, 0);
    r.tick(100);
    expect(r.pendingTrapEvents.length).toBe(1);
    expect(r.pendingTrapEvents[0].kind).toBe("spike");
    expect(r.traps.length).toBe(0); // durability 1 → sprung → remove
  });
  it("bear slow → raider skip move tick chẵn trong slow window", () => {
    const r = new RaidRoom({
      terrain: new Array(MAP_COLS * 22).fill(T.GRASS),
      enterTile: { x: 5, y: 1 },
      dogs: [],
      chests: [],
      seed: "s",
      traps: [{ id: "t1", kind: "bear", tile: 1 * MAP_COLS + 5, durability: 3, level: 1 }],
    });
    // raider (5,1) tile 35. Trap tile 35. tick → spring bear → slowUntilTick set.
    r.tick(100);
    expect(r.raider.slowUntilTick).toBeGreaterThan(0);
    // move khi slow + tick chẵn → skip (raider đứng yên)
    const xBefore = r.raider.x;
    // đẩy tickN lên số chẵn trong slow window
    while (r.tickN % 2 !== 0) r.tick(100);
    r.applyMove(1, 0);
    expect(r.raider.x).toBe(xBefore); // bị slow skip
  });
});

describe("lockdown escalation (phase 9 F9.3)", () => {
  it("dog chase nhanh hơn khi lockdown (accumulator ×1.4)", () => {
    // dog (11,1), raider (5,1): dist 6 = vision. Normal sau 5 tick: (6,1) chưa catch.
    // Lockdown: 5+2=7 tile → catch ở tick 5. dxLockdown(0) < dxNormal(1).
    const r = new RaidRoom({
      terrain: new Array(MAP_COLS * 22).fill(T.GRASS),
      enterTile: { x: 5, y: 1 },
      dogs: [{ x: 11, y: 1 }],
      chests: [],
      seed: "s",
    });
    r.lockdown = true;
    for (let i = 0; i < 5; i++) r.tick(100);
    const dxLockdown = Math.abs(r.dogs[0].x - r.raider.x) + Math.abs(r.dogs[0].y - r.raider.y);

    const r2 = new RaidRoom({
      terrain: new Array(MAP_COLS * 22).fill(T.GRASS),
      enterTile: { x: 5, y: 1 },
      dogs: [{ x: 11, y: 1 }],
      chests: [],
      seed: "s",
    });
    for (let i = 0; i < 5; i++) r2.tick(100);
    const dxNormal = Math.abs(r2.dogs[0].x - r2.raider.x) + Math.abs(r2.dogs[0].y - r2.raider.y);
    // lockdown di chuyển nhanh hơn → khoảng cách gần hơn
    expect(dxLockdown).toBeLessThan(dxNormal);
  });
});

describe("bloodMoon (phase 7 — blood-moon raid mechanic)", () => {
  it("bloodMoon: true → biome override (vision/hearing cao, decay thấp)", () => {
    const r = makeRoom({ mapId: "farm", bloodMoon: true });
    expect(r.bloodMoon).toBe(true);
    expect(r.biome.visionMul).toBeCloseTo(1.5, 5); // farm 1.0 × 1.5
    expect(r.biome.hearingMul).toBeCloseTo(1.5, 5);
    expect(r.biome.decayMul).toBeCloseTo(0.9, 5);
  });
  it("bloodMoon: false (default) → biome baseline", () => {
    const r = makeRoom({ mapId: "farm" });
    expect(r.bloodMoon).toBe(false);
    expect(r.biome.visionMul).toBe(1.0);
    expect(r.biome.decayMul).toBe(1.0);
  });
  it("snapshot phản ánh bloodMoon flag (client render FX)", () => {
    const r = makeRoom({ mapId: "beach", bloodMoon: true });
    const snap = r.snapshot();
    expect(snap.bloodMoon).toBe(true);
    expect(snap.mapBiome).toBe("beach"); // label giữ biome gốc
  });
  it("blood-moon dog nhìn xa hơn → phát hiện raider ở khoảng cách xa hơn", () => {
    // Dog (10,1), raider (1,1): dist 9. Vision baseline farm = 6 (không thấy),
    // blood-moon vision = 9 (thấy → bump alert).
    const rBlood = makeRoom({ mapId: "farm", bloodMoon: true, dogs: [{ x: 10, y: 1 }] });
    rBlood.tick(100);
    expect(rBlood.alert.score).toBeGreaterThan(0); // thấy raider (vision 9)

    const rNormal = makeRoom({ mapId: "farm", dogs: [{ x: 10, y: 1 }] });
    rNormal.tick(100);
    expect(rNormal.alert.score).toBe(0); // không thấy (vision 6)
  });
});
