import { describe, it, expect } from "vitest";
import {
  DECOR,
  DECOR_STEALABLE,
  decorById,
  decorFor,
  type DecorDef,
} from "../../src/lib/game/decor/decor-catalog";

describe("decor-catalog (W3 P1) — 20 decor, nhóm KHÔNG THỂ TRỘM §7", () => {
  it("32 item (20 W3 shop + 12 W8 festival), id unique; manifestKey unique trong shop", () => {
    expect(DECOR.length).toBe(32);
    expect(new Set(DECOR.map((d) => d.id)).size).toBe(32);
    // Event trophy 4 cái tái dùng sheet statue — manifestKey unique chỉ bắt buộc
    // trong nhóm shop (không event).
    const shop = DECOR.filter((d) => d.tier !== "event");
    expect(new Set(shop.map((d) => d.manifestKey)).size).toBe(shop.length);
  });

  it("§7 hard rule: KHÔNG decor nào stealable — const false toàn bộ", () => {
    expect(DECOR_STEALABLE).toBe(false);
    for (const d of DECOR) {
      // Không có field "stealable" per-item — toàn bộ catalog là một nhóm an toàn.
      expect("stealable" in d).toBe(false);
    }
  });

  it("zone farm|house — shop 14 ngoài + 6 trong; event W8 +12 toàn farm", () => {
    const shopFarm = DECOR.filter((d) => d.zone === "farm" && d.tier !== "event");
    const house = DECOR.filter((d) => d.zone === "house");
    const event = DECOR.filter((d) => d.tier === "event");
    expect(shopFarm.length).toBe(14);
    expect(house.length).toBe(6);
    expect(event.length).toBe(12);
    expect(event.every((d) => d.zone === "farm")).toBe(true);
  });

  it("frame hợp lệ: trong sheet, kích thước > 0, chia hết 16", () => {
    for (const d of DECOR) {
      const f = d.frame;
      expect(f.w % 16).toBe(0);
      expect(f.h % 16).toBe(0);
      expect(f.w).toBeGreaterThan(0);
      expect(f.h).toBeGreaterThan(0);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      // kích thước tile (renderer scale ×3): w/h theo tile 16px nguồn
      expect(d.w).toBe(f.w / 16);
      expect(d.h).toBe(f.h / 16);
    }
  });

  it("giá tăng theo tier basic→nice→fancy; unlock 1..5 (shop — event price 0)", () => {
    const byTier: Record<string, number[]> = { basic: [], nice: [], fancy: [] };
    for (const d of DECOR) {
      if (d.tier === "event") {
        // W8: event decor không bán — price 0, không vào thang giá.
        expect(d.price).toBe(0);
        continue;
      }
      byTier[d.tier].push(d.price);
      expect(d.unlockLevel).toBeGreaterThanOrEqual(1);
      expect(d.unlockLevel).toBeLessThanOrEqual(5);
      expect(d.price).toBeGreaterThanOrEqual(50);
    }
    expect(Math.min(...byTier.fancy)).toBeGreaterThan(Math.max(...byTier.basic));
  });

  it("chỉ item đối xứng trục được rotatable", () => {
    const rotatableIds = new Set(["fence_wood", "fence_stone", "fence_iron", "street_lamp", "street_lamp2", "bench", "picnic"]);
    for (const d of DECOR) {
      expect(d.rotatable).toBe(rotatableIds.has(d.id));
    }
  });

  it("decorFor(zone, level) lọc đúng; decorById lạ → undefined", () => {
    const lv1Farm = decorFor("farm", 1);
    expect(lv1Farm.every((d) => d.zone === "farm" && d.unlockLevel <= 1)).toBe(true);
    expect(lv1Farm.length).toBeGreaterThanOrEqual(3);
    expect(decorFor("house", 5).length).toBe(6);
    expect(decorById("khong_ton_tai")).toBeUndefined();
    expect(decorById("fountain")?.zone).toBe("farm");
  });
});
