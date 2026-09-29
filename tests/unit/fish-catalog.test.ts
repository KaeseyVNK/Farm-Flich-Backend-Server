// Wave 1 P1 — fish catalog contract tests.
import { describe, it, expect } from "vitest";
import {
  FISH,
  waterTypeAt,
  type WaterZone,
} from "../../src/lib/game/fish-catalog";
import { getItem } from "../../src/lib/game/data";
import { FARM_LAKE, FARM_POND, isFarmScenerySolid } from "../../src/lib/game/farm-scenery-layout";
import { FARM_ZONE } from "../../src/lib/game/zones/farm";
import { BEACH_ZONE } from "../../src/lib/game/zones/beach";
import { resolveIcon } from "../../src/lib/game/assets/icon-manifest";
import { T, MAP_COLS } from "../../src/lib/game/constants";

describe("fish catalog (P1)", () => {
  it("12 cá, id unique, mỗi vùng ≥3, mỗi rarity ≥3", () => {
    const ids = new Set(FISH.map((f) => f.id));
    expect(ids.size).toBe(12);
    for (const zone of ["pond", "lake", "sea"] as WaterZone[]) {
      expect(FISH.filter((f) => f.zone === zone).length).toBeGreaterThanOrEqual(3);
    }
    for (const rarity of ["common", "medium", "rare"]) {
      expect(FISH.filter((f) => f.rarity === rarity).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("unlockLevel 1–5; giá + energy tăng theo rarity (c < m < r)", () => {
    for (const f of FISH) {
      expect(f.unlockLevel).toBeGreaterThanOrEqual(1);
      expect(f.unlockLevel).toBeLessThanOrEqual(5);
      expect(f.sellPrice).toBeGreaterThan(0);
    }
    const minPrice = (r: string) => Math.min(...FISH.filter((f) => f.rarity === r).map((f) => f.sellPrice));
    expect(minPrice("common")).toBeLessThan(minPrice("medium"));
    expect(minPrice("medium")).toBeLessThan(minPrice("rare"));
  });

  it("mỗi cá mapping 1-1 với ITEM trong data.ts, type=food", () => {
    for (const f of FISH) {
      const item = getItem(f.id);
      expect(item, `ITEM thiếu cá ${f.id}`).toBeDefined();
      expect(item!.type).toBe("food");
      expect(item!.sellPrice).toBe(f.sellPrice);
      expect(item!.energy).toBe(f.energy);
    }
  });

  it("mỗi cá có approved icon (icon.fish.* trong manifest) — không placeholder", () => {
    for (const f of FISH) {
      const res = resolveIcon(f.id, "fish");
      expect(res.status, `icon thiếu cho ${f.id}`).toBe("approved");
      if (res.status === "approved")
        expect(res.key).toBe(`icon.fish.${f.id.replace(/_/g, "-")}`);
    }
  });
});

describe("waterTypeAt — 3 vùng nước (P1)", () => {
  it("ao farm: trong FARM_POND → pond", () => {
    expect(waterTypeAt("farm", 9, 23)).toBe("pond");
    expect(waterTypeAt("farm", 0, 0)).toBeNull();
  });

  it("hồ farm: trong FARM_LAKE → lake", () => {
    expect(FARM_LAKE).toBeDefined();
    expect(waterTypeAt("farm", 34, 16)).toBe("lake");
    expect(FARM_ZONE.terrain[16 * MAP_COLS + 34]).toBe(T.WATER);
  });

  it("biển beach: rows 0–5 → sea; sâu trong bờ → null", () => {
    expect(waterTypeAt("beach", 5, 2)).toBe("sea");
    expect(BEACH_ZONE.terrain[2 * 40 + 5]).toBe(T.WATER);
    expect(waterTypeAt("beach", 5, 20)).toBeNull();
  });
});
