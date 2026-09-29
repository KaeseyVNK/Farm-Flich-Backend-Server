import { describe, it, expect } from "bun:test";
import { RaidRoom } from "../src/room";
import type { RaidEventRow } from "../src/replay-types";
import { MAP_COLS, T } from "../src/constants";

/**
 * Review W7 #4: replay re-sim PHẢI re-apply useItem (mồi/toy tại x,y) và
 * useTool (smoke stagger) qua applyEvent — không thì raid có mồi/tool
 * replay khác live (dog target/busy khác → kết cục caught/exit khác).
 * Test applyEvent trực tiếp (chính đường replayEvents gọi).
 */

const grass = (): number[] => new Array(MAP_COLS * 22).fill(T.GRASS);

const makeRoom = (): RaidRoom =>
  new RaidRoom({
    terrain: grass(),
    enterTile: { x: 1, y: 5 },
    dogs: [{ x: 5, y: 5 }],
    chests: [{ id: "c1", x: 20, y: 10 }],
    seed: "replay-tools",
  });

const ev = (type: string, payload: Record<string, unknown>): RaidEventRow => ({
  tick: 0,
  seq: 0,
  type,
  actorId: "thief",
  payload,
});

describe("applyEvent re-apply useItem/useTool (review W7 #4)", () => {
  it("useItem mồi tại chân chó → đặt vào placedItems + chó ăn busy 60", () => {
    const r = makeRoom();
    r.applyEvent(ev("useItem", { itemId: "fish_raw", x: 5, y: 5 }));
    expect(r.placedItems.length).toBe(1);
    r.tick(100); // mồi dưới chân → ăn ngay
    expect(r.dogs[0].x === 5 && r.dogs[0].y === 5).toBe(true);
    expect(r.dogs[0].busyUntilTick).toBe(r.tickN + 60);
  });

  it("useItem toy → busy 100 (không phải 60)", () => {
    const r = makeRoom();
    r.applyEvent(ev("useItem", { itemId: "tool_toy", x: 5, y: 5 }));
    r.tick(100);
    expect(r.dogs[0].busyUntilTick).toBe(r.tickN + 100);
  });

  it("useTool smoke → mọi chó stagger 30 tick kể từ tick hiện tại", () => {
    const r = makeRoom();
    r.tick(100);
    r.tick(100);
    r.applyEvent(ev("useTool", { toolId: "smoke" }));
    expect(r.dogs[0].busyUntilTick).toBe(r.tickN + 30);
  });

  it("useTool smoke KHÔNG rút ngắn mồi đang ăn (max giữ 60)", () => {
    const r = makeRoom();
    r.applyEvent(ev("useItem", { itemId: "fish_raw", x: 5, y: 5 }));
    r.tick(100); // ăn → busy tới tickN+60
    r.applyEvent(ev("useTool", { toolId: "smoke" }));
    // smoke tại tick sau khi ăn: busy = max(60-based, tickN+30)
    expect(r.dogs[0].busyUntilTick).toBe(r.tickN + 60);
  });

  it("payload thiếu x/y hoặc itemId lạ → không crash, bỏ qua an toàn", () => {
    const r = makeRoom();
    r.applyEvent(ev("useItem", { itemId: "fish_raw" })); // thiếu x/y → (0,0)
    expect(r.placedItems.length).toBe(1); // (0,0) hợp lệ — vẫn đặt
    const r2 = makeRoom();
    r2.applyEvent(ev("useTool", { toolId: "lockpick" })); // replay không áp lockpick (deadline不属于 room state)
    expect(r2.dogs[0].busyUntilTick).toBe(0);
  });

  it("live path (index.ts) log x,y — contract: useItem payload đầy đủ cho replay", async () => {
    // Đọc index.ts chắn log có x,y (chống quay lại log chỉ itemId).
    const src = await Bun.file("src/index.ts").text();
    expect(src.includes("x: state.room.raider.x")).toBe(true);
  });
});
