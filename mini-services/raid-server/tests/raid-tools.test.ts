import { describe, it, expect } from "bun:test";
import { RaidRoom } from "../src/room";
import { applyToolUse, LOCKPICK_BONUS_MS, SMOKE_STAGGER_TICKS } from "../src/raid-tools";
import { MAP_COLS, T } from "../src/constants";

/**
 * W7d-P2: tools chợ đen — lockpick +2s deadline (1 lần/raid), smoke stagger
 * mọi chó 3s (chồng max không reset mồi), toy qua path mồi busy 100 tick.
 */

const grass = (): number[] => new Array(MAP_COLS * 22).fill(T.GRASS);

function makeRoom(dogAt = { x: 15, y: 10 }): RaidRoom {
  return new RaidRoom({
    terrain: grass(),
    enterTile: { x: 1, y: 1 },
    dogs: [dogAt],
    chests: [{ id: "c1", x: 20, y: 10 }],
    seed: "tools-test",
  });
}

describe("applyToolUse — lockpick", () => {
  it("+2000ms vào deadline chest đang mở, trả deadline mới", () => {
    const r = makeRoom();
    const used = new Set<string>();
    const dl = new Map([["c1", 1000]]);
    const res = applyToolUse(r, used, dl, "lockpick", "c1");
    expect(res.ok).toBe(true);
    expect(res.deadlineMs).toBe(1000 + LOCKPICK_BONUS_MS);
    expect(dl.get("c1")).toBe(3000);
  });

  it("1 lần/raid — lần 2 từ chối (tool_used)", () => {
    const r = makeRoom();
    const used = new Set<string>();
    const dl = new Map([["c1", 1000], ["c2", 5000]]);
    expect(applyToolUse(r, used, dl, "lockpick", "c1").ok).toBe(true);
    const again = applyToolUse(r, used, dl, "lockpick", "c2");
    expect(again.ok).toBe(false);
    expect(again.error).toBe("tool_used");
    expect(dl.get("c2")).toBe(5000); // không đổi
  });

  it("không có puzzle mở (chưa interact) → từ chối; thiếu chestId → từ chối", () => {
    const r = makeRoom();
    const res1 = applyToolUse(r, new Set(), new Map(), "lockpick", "c1");
    expect(res1.error).toBe("tool_no_puzzle");
    const res2 = applyToolUse(r, new Set(), new Map([["c1", 1]]), "lockpick", undefined);
    expect(res2.error).toBe("tool_no_chest");
  });
});

describe("applyToolUse — smoke", () => {
  it("mọi chó stagger 30 tick kể từ tick hiện tại", () => {
    const r = makeRoom();
    r.tick(100);
    r.tick(100);
    r.tick(100); // tickN = 3
    const res = applyToolUse(r, new Set(), new Map(), "smoke", undefined);
    expect(res.ok).toBe(true);
    expect(r.dogs[0].busyUntilTick).toBe(3 + SMOKE_STAGGER_TICKS);
  });

  it("chồng max — không RÚT ngắn mồi đang ăn (busy 60 > stagger 30)", () => {
    const r = makeRoom();
    r.tick(100);
    const dog = r.dogs[0];
    dog.busyUntilTick = 50; // đang mải ăn mồi tới tick 50
    applyToolUse(r, new Set(), new Map(), "smoke", undefined);
    expect(dog.busyUntilTick).toBe(50); // max(50, 1+30) = 50
  });

  it("1 lần/raid", () => {
    const r = makeRoom();
    const used = new Set<string>();
    expect(applyToolUse(r, used, new Map(), "smoke", undefined).ok).toBe(true);
    expect(applyToolUse(r, used, new Map(), "smoke", undefined).error).toBe("tool_used");
  });
});

describe("tool-toy qua path mồi (useItem)", () => {
  it("chó ăn toy → busy 100 tick (10s), food thường 60 tick (6s)", () => {
    const r = makeRoom({ x: 5, y: 5 });
    // đặt mồi ngay chân chó
    expect(r.useItem("tool_toy", 5, 5)).toBe(true);
    r.tick(100); // chó thấy mồi dưới chân → ăn ngay
    expect(r.dogs[0].busyUntilTick).toBe(r.tickN + 100);

    const r2 = makeRoom({ x: 5, y: 5 });
    expect(r2.useItem("fish_raw", 5, 5)).toBe(true);
    r2.tick(100);
    expect(r2.dogs[0].busyUntilTick).toBe(r2.tickN + 60);
  });
});
