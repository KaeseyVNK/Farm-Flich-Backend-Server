import { describe, it, expect } from "vitest";
import { ordersForDay } from "@/lib/game/farm-orders";

// Phase 5 stretch: 3 đơn/ngày deterministic (không RNG) — lv1 luôn parsnip.
describe("farm-orders", () => {
  it("ordersForDay(1,1) → đúng 3 đơn parsnip ids d1-a/b/c", () => {
    const orders = ordersForDay(1, 1);
    expect(orders).toHaveLength(3);
    expect(orders.map((o) => o.id)).toEqual(["d1-a", "d1-b", "d1-c"]);
    expect(orders[0]).toEqual({ id: "d1-a", wants: { parsnip: 2 }, gold: 80 });
    expect(orders[1]).toEqual({ id: "d1-b", wants: { parsnip: 3 }, gold: 120 });
    expect(orders[2]).toEqual({ id: "d1-c", wants: { parsnip: 4 }, gold: 160 });
  });

  it("deterministic — gọi 2 lần ra kết quả bằng nhau", () => {
    expect(ordersForDay(1, 1)).toEqual(ordersForDay(1, 1));
  });

  it("id theo day: ordersForDay(7,1) → d7-a/b/c", () => {
    expect(ordersForDay(7, 1).map((o) => o.id)).toEqual(["d7-a", "d7-b", "d7-c"]);
  });

  it("level thay thế đơn: lv2 potato, lv3 egg, lv4 milk", () => {
    expect(ordersForDay(1, 2)[2]).toEqual({ id: "d1-c", wants: { potato: 3 }, gold: 150 });
    expect(ordersForDay(1, 3)[1]).toEqual({ id: "d1-b", wants: { egg: 2 }, gold: 80 });
    expect(ordersForDay(1, 4)[0]).toEqual({ id: "d1-a", wants: { milk: 1 }, gold: 100 });
    // thay thế stack: lv4 có cả milk + egg + potato
    const l4 = ordersForDay(1, 4);
    expect(l4[0].wants).toEqual({ milk: 1 });
    expect(l4[1].wants).toEqual({ egg: 2 });
    expect(l4[2].wants).toEqual({ potato: 3 });
  });
});
