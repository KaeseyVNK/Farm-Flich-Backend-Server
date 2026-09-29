import { describe, it, expect } from "bun:test";
import {
  rollLoot,
  rollLootSeeded,
  isKetItem,
  LOOT_TABLES,
  type ChestKind,
} from "../src/loot-tables";
import { mulberry32, hashStr } from "../src/rng";

describe("rollLoot", () => {
  it("trả itemId hợp lệ trong table + qty trong range", () => {
    const rng = mulberry32(hashStr("s"));
    for (let i = 0; i < 50; i++) {
      const res = rollLoot("wood", rng);
      const entry = LOOT_TABLES.wood.find((e) => e.itemId === res.itemId);
      expect(entry).toBeDefined();
      expect(res.qty).toBeGreaterThanOrEqual(entry!.qtyMin);
      expect(res.qty).toBeLessThanOrEqual(entry!.qtyMax);
    }
  });
  it("distribution ±15% weight (1000 sample)", () => {
    const rng = mulberry32(hashStr("dist"));
    const counts: Record<string, number> = {};
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const res = rollLoot("wood", rng);
      counts[res.itemId] = (counts[res.itemId] ?? 0) + 1;
    }
    const total = LOOT_TABLES.wood.reduce((s, e) => s + e.weight, 0);
    for (const e of LOOT_TABLES.wood) {
      const expected = (e.weight / total) * N;
      const actual = counts[e.itemId] ?? 0;
      // ±15% tolerance
      expect(Math.abs(actual - expected) / expected).toBeLessThan(0.15);
    }
  });
  it("deterministic seeded — cùng seed → cùng kết quả", () => {
    expect(rollLootSeeded("iron", "seed1", "chest-x")).toEqual(rollLootSeeded("iron", "seed1", "chest-x"));
  });
});

describe("isKetItem (concept §7 — 0% steal)", () => {
  it("ket_ prefix → true", () => {
    expect(isKetItem("ket_ruby")).toBe(true);
    expect(isKetItem("ket_diamond")).toBe(true);
  });
  it("non-ket → false", () => {
    expect(isKetItem("wood")).toBe(false);
    expect(isKetItem("gold_bar")).toBe(false);
  });
  it("safe table chứa ít nhất 1 ket item", () => {
    expect(LOOT_TABLES.safe.some((e) => isKetItem(e.itemId))).toBe(true);
  });
});

describe("LOOT_TABLES structure", () => {
  it("mỗi kind có entries + weight > 0", () => {
    (["wood", "iron", "safe"] as ChestKind[]).forEach((k) => {
      expect(LOOT_TABLES[k].length).toBeGreaterThan(0);
      LOOT_TABLES[k].forEach((e) => {
        expect(e.weight).toBeGreaterThan(0);
        expect(e.qtyMax).toBeGreaterThanOrEqual(e.qtyMin);
      });
    });
  });
});
