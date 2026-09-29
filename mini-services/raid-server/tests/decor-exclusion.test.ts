import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOOT_TABLES } from "../src/loot-tables.js";

// Concept §7 hard rule: decor/furniture KHÔNG THỂ TRỘM — hai biên giới:
// (1) LOOT_TABLES không chứa itemId decor nào (pool trộm chỉ là nguyên liệu/vàng);
// (2) raid-server KHÔNG đọc cột placedDecor/decorOwned từ Farm (chỉ terrain).
// DANH SÁCH DECOR duplicate từ src/lib/game/decor/decor-catalog.ts (pattern
// constants-sync — service độc lập không import src/; thêm decor mới → cập nhật đây).
const DECOR_IDS = [
  "fence_wood", "fence_stone", "fence_iron", "birdhouse", "hay_bale", "bench",
  "street_lamp", "street_lamp2", "picnic", "notice_board", "scarecrow", "statue",
  "fountain", "flower_sign", "candle", "table_small", "sofa_arm", "cat_furn",
  "xmas_tree", "dresser",
] as const;

test("§7: LOOT_TABLES không chứa itemId decor nào (decor không-thể-trộm)", () => {
  const lootIds = new Set<string>();
  for (const table of Object.values(LOOT_TABLES)) {
    for (const entry of table) lootIds.add(entry.itemId);
  }
  for (const d of DECOR_IDS) {
    expect(lootIds.has(d), `decor ${d} lọt vào LOOT_TABLES — vi phạm §7`).toBe(false);
  }
});

test("§7: raid-server không đọc cột placedDecor/decorOwned (pool trộm chỉ terrain)", () => {
  const src = readFileSync(join(import.meta.dir, "..", "src", "index.ts"), "utf8");
  expect(src.includes("placedDecor"), "index.ts đọc placedDecor — decor phải nằm ngoài raid").toBe(false);
  expect(src.includes("decorOwned"), "index.ts đọc decorOwned — decor phải nằm ngoài raid").toBe(false);
  // nguồn farm duy nhất được select là terrain (arena resample)
  expect(src.includes('.select("terrain")')).toBe(true);
});
