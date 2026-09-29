import { describe, expect, it } from "vitest";
import { QUEST_ITEMS, TUTORIAL_STEPS } from "@/lib/game/tutorial/tutorial-catalog";
import { isKetItem } from "@/lib/raid/loss-cap";
import { incomeShare, INCOME_TARGET_DAYS, SUNFISH_RIVER_PRICE } from "@/lib/game/tutorial/economy-thresholds";
import { vendorSellPrice, seedBuyPrice } from "@/lib/game/economy";
import { ordersForDay } from "@/lib/game/farm-orders";

describe("quest-item bảo vệ §7 — không thể trộm", () => {
  it("QUEST_ITEMS đều prefix `ket_` → isKetItem=true (raid pool exclude server)", () => {
    for (const id of QUEST_ITEMS) {
      expect(id.startsWith("ket_"), `quest item ${id} phải ket_`).toBe(true);
      expect(isKetItem(id)).toBe(true);
    }
  });

  it("QUEST_ITEMS là subset items trong catalog (trophy + letter)", () => {
    const itemIds = TUTORIAL_STEPS.flatMap((s) => [
      ...(s.reward.item ? [s.reward.item.id] : []),
      ...(s.reward.items ?? []).map((i) => i.id),
    ]);
    for (const id of QUEST_ITEMS) {
      expect(itemIds).toContain(id);
    }
  });

  it("item thường KHÔNG bị nhầm là ket (chỉ quest item)", () => {
    expect(isKetItem("parsnip")).toBe(false);
    expect(isKetItem("sunfish")).toBe(false);
    expect(isKetItem("sword")).toBe(false);
    expect(isKetItem("ket_ruby")).toBe(true); // vốn sẵn có từ W7
  });
});

describe("economy balance pass — ngưỡng (P4)", () => {
  it("incomeShare: không nguồn nào > 60% tổng", () => {
    // Benchmark từ balance doc (P4): farming 36% / fishing 28% / cooking 12% / raid 24%.
    const share = incomeShare({ farming: 36, fishing: 28, cooking: 12, raid: 24 });
    expect(share.total).toBe(100);
    for (const k of ["farming", "fishing", "cooking", "raid"] as const) {
      expect(share[k]).toBeLessThanOrEqual(0.6);
    }
  });

  it("mục tiêu sink: bicycle 2–3 ngày, horse 8–12 ngày, fancy decor ~6 ngày", () => {
    expect(INCOME_TARGET_DAYS.bicycle).toBeGreaterThanOrEqual(2);
    expect(INCOME_TARGET_DAYS.bicycle).toBeLessThanOrEqual(3);
    expect(INCOME_TARGET_DAYS.horse).toBeGreaterThanOrEqual(8);
    expect(INCOME_TARGET_DAYS.horse).toBeLessThanOrEqual(12);
    expect(INCOME_TARGET_DAYS.fancyDecor).toBeGreaterThanOrEqual(4);
    expect(INCOME_TARGET_DAYS.fancyDecor).toBeLessThanOrEqual(8);
  });

  it("giá benchmark chống drift economy.json (sunfish sông 25g)", () => {
    expect(SUNFISH_RIVER_PRICE).toBe(25);
  });

  it("income/ngày bench — farming 4 ô parsnip bán vendor ≈ income/ngày mục tiêu", () => {
    // 4 ô (lv1) × parsnip 35g vendor / 4 ngày tăng trưởng ≈ 35g/ngày (bỏ seed 20g).
    expect(vendorSellPrice("parsnip", "crop")).toBe(35);
    expect(seedBuyPrice("parsnip_seed")).toBe(20);
    // Đơn hàng lv1 (3 đơn 80+120+160) là nguồn farming chính: 360g/ngày.
    const orders = ordersForDay(1, 1);
    expect(orders.reduce((s, o) => s + o.gold, 0)).toBe(360);
  });

  it("incomeShare bench chia đều 4 nguồn — không nguồn nào > 60%", () => {
    // 2–3 ngày bicycle (800g): cần ≥ 300g/ngày; 8–12 ngày horse (2500g): 208–312g/ngày.
    // Tổng 4 nguồn ≈ 800g/ngày → mỗi nguồn đóng góp ≤ 36% — dưới trần 60%.
    const share = incomeShare({ farming: 300, fishing: 220, cooking: 100, raid: 180 });
    expect(share.total).toBe(800);
    for (const k of ["farming", "fishing", "cooking", "raid"] as const) {
      expect(share[k]).toBeLessThanOrEqual(0.6);
    }
  });
});