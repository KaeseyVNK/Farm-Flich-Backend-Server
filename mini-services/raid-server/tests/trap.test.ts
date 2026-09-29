import { describe, it, expect } from "bun:test";
import {
  springTrap,
  isValidTrapTile,
  canPlaceTrap,
  BEAR_SLOW_TICKS,
  TRAP_CAP_PER_FARM,
  TRAP_DEFAULT_DURABILITY,
  type Trap,
  type TrapRoomLike,
} from "../src/trap";
import { AlertState } from "../src/alert";

/** Mock room cho springTrap. */
function mockRoom(tickN = 0): TrapRoomLike {
  return { tickN, raider: { slowUntilTick: 0 }, alert: new AlertState() };
}

const trap = (over: Partial<Trap> = {}): Trap => ({
  id: "t1",
  kind: "spike",
  tile: 5,
  durability: TRAP_DEFAULT_DURABILITY,
  level: 1,
  ...over,
});

describe("springTrap per kind", () => {
  it("bear → set slowUntilTick = tickN + BEAR_SLOW_TICKS, KHÔNG bump alert", () => {
    const r = mockRoom(100);
    const res = springTrap(r, trap({ kind: "bear" }));
    expect(r.raider.slowUntilTick).toBe(100 + BEAR_SLOW_TICKS);
    expect(res.event.damage).toBe(0);
  });
  it("spike → alert bump 20", () => {
    const r = mockRoom();
    const before = r.alert.score;
    springTrap(r, trap({ kind: "spike" }));
    expect(r.alert.score).toBeGreaterThan(before);
  });
  it("alarm → alert bump 40 (strong hơn spike)", () => {
    const rSpike = mockRoom();
    const rAlarm = mockRoom();
    springTrap(rSpike, trap({ kind: "spike" }));
    springTrap(rAlarm, trap({ kind: "alarm" }));
    expect(rAlarm.alert.score).toBeGreaterThan(rSpike.alert.score);
  });
});

describe("springTrap durability decay + removal", () => {
  it("mỗi spring durability -1", () => {
    const r = mockRoom();
    const t = trap({ durability: 3 });
    springTrap(r, t);
    expect(t.durability).toBe(2);
  });
  it("durability hết → removed=true", () => {
    const r = mockRoom();
    const t = trap({ durability: 1 });
    const res = springTrap(r, t);
    expect(res.removed).toBe(true);
    expect(t.durability).toBe(0);
  });
  it("durability còn → removed=false", () => {
    const r = mockRoom();
    const t = trap({ durability: 3 });
    const res = springTrap(r, t);
    expect(res.removed).toBe(false);
  });
  it("event payload đầy đủ {tile, kind, damage}", () => {
    const r = mockRoom();
    const res = springTrap(r, trap({ kind: "alarm", tile: 42 }));
    expect(res.event).toEqual({ tile: 42, kind: "alarm", damage: 40 });
  });
});

describe("isValidTrapTile", () => {
  const size = 660;
  const solid = (t: number) => t === 10; // tile 10 solid
  it("hợp lệ — trong range + non-solid + chưa có", () => {
    expect(isValidTrapTile(5, size, solid, [])).toBe(true);
  });
  it("ngoài range → false", () => {
    expect(isValidTrapTile(-1, size, solid, [])).toBe(false);
    expect(isValidTrapTile(size, size, solid, [])).toBe(false);
  });
  it("solid tile → false", () => {
    expect(isValidTrapTile(10, size, solid, [])).toBe(false);
  });
  it("trùng tile đã có trap → false", () => {
    expect(isValidTrapTile(5, size, solid, [5])).toBe(false);
  });
});

describe("canPlaceTrap cap", () => {
  it("dưới cap → true", () => {
    expect(canPlaceTrap(TRAP_CAP_PER_FARM - 1)).toBe(true);
  });
  it("đạt cap → false", () => {
    expect(canPlaceTrap(TRAP_CAP_PER_FARM)).toBe(false);
  });
});
