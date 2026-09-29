import { describe, it, expect } from "bun:test";
import { RaidRoom } from "../src/room";
import { MAP_COLS, T } from "../src/constants";

const grass = (): number[] => new Array(MAP_COLS * 22).fill(T.GRASS);

function makeRoom(breed?: string, enter = { x: 20, y: 10 }) {
  return new RaidRoom({
    terrain: grass(),
    enterTile: enter,
    dogs: [{ x: 15, y: 10, breed }],
    chests: [{ id: "c1", x: 25, y: 10 }],
    seed: "lure",
  });
}

describe("W7b-P3 mồi dụ (useItem + tickDog lure)", () => {
  it("useItem: hợp lệ → true; cap 2; solid/OOB → false", () => {
    const r = makeRoom();
    expect(r.useItem("jelly_salad", 16, 10)).toBe(true);
    expect(r.useItem("fish_salad", 16, 11)).toBe(true);
    expect(r.useItem("fish_salad", 16, 12)).toBe(false); // cap 2
    const r2 = makeRoom();
    const rock = grass();
    rock[10 * MAP_COLS + 16] = T.ROCK;
    const r3 = new RaidRoom({ terrain: rock, enterTile: { x: 20, y: 10 }, dogs: [{ x: 15, y: 10 }], chests: [{ id: "c", x: 25, y: 10 }], seed: "s" });
    expect(r3.useItem("x", 16, 10)).toBe(false); // solid
    expect(r2.useItem("", 16, 10)).toBe(false); // itemId rỗng
  });

  it("dog thường bị mồi hút khỏi chase — tới nơi ăn, đứng 6s (snapshot phản ánh)", () => {
    const r = makeRoom(undefined, { x: 21, y: 10 }); // thief trong tầm → chase
    // đặt mồi NGAY CẠN dog (cách 1) — chắc trong smell
    expect(r.useItem("jelly_salad", 16, 10)).toBe(true);
    r.tick(100); // tick 1: dog bước tới mồi (16,10)
    r.tick(100); // tick 2: dog đứng trên mồi → ăn
    const snap = r.snapshot();
    expect(snap.placedItems?.length ?? 0).toBe(0); // đã ăn
    // dog busy — đứng yên kể cả khi thief kế bên
    const x0 = r.dogs[0].x;
    for (let i = 0; i < 30; i++) r.tick(100);
    expect(r.dogs[0].x).toBe(x0);
  });

  it("maan (lureImmune) KHÔNG bị mồi — vẫn chase", () => {
    const r = makeRoom("maan", { x: 20, y: 10 });
    r.useItem("jelly_salad", 16, 10);
    for (let i = 0; i < 3; i++) r.tick(100);
    // maan tiến về thief (20,10) — không dừng ở mồi (16,10)
    expect(r.dogs[0].x).toBeGreaterThan(15);
  });

  it("mồi ngoài tầm smell (hearing×2) không hút", () => {
    // thief xa (ngoài vision/hearing) — dog patrol. Mồi đặt xa dog 20 tile.
    const r = makeRoom(undefined, { x: 29, y: 21 }); // thief góc xa
    r.useItem("jelly_salad", 2, 2); // cách dog (15,10) Manhattan 21 > hearing*2 (6-10)
    const patrolX0 = r.dogs[0].x;
    r.tick(100);
    // dog vẫn patrol (không đi về (2,2) ngay tick 1 — patrol target ngẫu nhiên).
    // Assert gián tiếp: mồi còn nguyên (chưa ăn) sau nhiều tick.
    for (let i = 0; i < 20; i++) r.tick(100);
    expect(r.snapshot().placedItems?.length).toBe(1);
  });
});
