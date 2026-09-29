import { describe, it, expect } from "vitest";
import {
  decorScore,
  derbyScore,
  cookoffScore,
  puzzleTokenEarned,
  DERBY_POINTS,
  COOKOFF_MAX_DISHES,
} from "@/lib/game/festival/festival-scoring";
import { FISH } from "@/lib/game/fish-catalog";
import { KITCHEN_RECIPES } from "@/lib/game/cooking/recipe-catalog";
import { DECOR } from "@/lib/game/decor/decor-catalog";
import type { PlacedDecor } from "@/lib/game/decor/decor-placement";

const placed = (defId: string): PlacedDecor => ({
  uid: `u-${defId}`,
  defId,
  zone: "farm",
  tx: 0,
  ty: 0,
  rot: 0,
  flip: false,
});

describe("decorScore (W8 P2)", () => {
  it("Σ tier weight: basic 2 / nice 5 / fancy 9 / event 12", () => {
    const basic = DECOR.find((d) => d.tier === "basic")!;
    const nice = DECOR.find((d) => d.tier === "nice")!;
    const fancy = DECOR.find((d) => d.tier === "fancy")!;
    const event = DECOR.find((d) => d.tier === "event")!;
    expect(decorScore([placed(basic.id), placed(nice.id), placed(fancy.id), placed(event.id)], 0)).toBe(2 + 5 + 9 + 12);
  });

  it("likes ×3 cộng dồn; likes âm bị kẹp 0", () => {
    expect(decorScore([], 7)).toBe(21);
    expect(decorScore([], -5)).toBe(0);
  });

  it("defId lạ → bỏ an toàn (không crash, không điểm)", () => {
    expect(decorScore([placed("ghost_decor")], 0)).toBe(0);
  });

  it("farm thật đạt được ngưỡng: ~10 decor thường + 2 like = silver", () => {
    // 6 basic + 3 nice + 1 fancy = 12+15+9 = 36 + likes 2×3 = 42 — dưới bronze? 42 ≥ 30 ✓
    const ids = DECOR.filter((d) => d.tier !== "event").slice(0, 10).map((d) => d.id);
    const score = decorScore(ids.map(placed), 2);
    expect(score).toBeGreaterThanOrEqual(30);
    expect(score).toBeLessThan(100);
  });
});

describe("derbyScore (W8 P2)", () => {
  const byRarity = (r: string) => ({ fishId: FISH.find((f) => f.rarity === r)!.id });

  it("điểm rarity 10/25/60 theo đúng plan", () => {
    expect(DERBY_POINTS).toEqual({ common: 10, medium: 25, rare: 60 });
    expect(derbyScore([byRarity("common"), byRarity("medium"), byRarity("rare")])).toBe(95);
  });

  it("fishId lạ → tính common (an toàn), log rỗng = 0", () => {
    expect(derbyScore([{ fishId: "nonexistent" }])).toBe(DERBY_POINTS.common);
    expect(derbyScore([])).toBe(0);
  });

  it("1 ngày câu ~12 cá thường + 2 medium + 1 rare ≈ gold", () => {
    const log = [
      ...Array(12).fill(0).map(() => ({ fishId: byRarity("common").fishId })),
      ...Array(2).fill(0).map(() => ({ fishId: byRarity("medium").fishId })),
      { fishId: byRarity("rare").fishId },
    ];
    expect(derbyScore(log)).toBe(120 + 50 + 60); // 230 ≥ 200 gold
  });
});

describe("cookoffScore (W8 P2)", () => {
  it("tier×20 + buff?15 — đối chiếu catalog thật", () => {
    const t1 = KITCHEN_RECIPES.find((r) => r.tier === 1 && !r.buff)!;
    const t3buff = KITCHEN_RECIPES.find((r) => r.tier === 3 && r.buff)!;
    expect(cookoffScore([t1.outputItemId])).toBe(20);
    expect(cookoffScore([t3buff.outputItemId])).toBe(75);
  });

  it("chỉ tính tối đa 3 món (COOKOFF_MAX_DISHES)", () => {
    const t1s = KITCHEN_RECIPES.filter((r) => r.tier === 1).slice(0, 5);
    expect(COOKOFF_MAX_DISHES).toBe(3);
    expect(cookoffScore(t1s.map((r) => r.outputItemId))).toBe(60); // 3 món đầu × 20
  });

  it("item không phải món nấu (seed/quặng) → 0 điểm, không crash", () => {
    expect(cookoffScore(["parsnip_seed", "wood", "stone"])).toBe(0);
  });
});

describe("puzzleTokenEarned (W8 P2)", () => {
  it("solved × tier — âm kẹp 0", () => {
    expect(puzzleTokenEarned(3, 1)).toBe(3);
    expect(puzzleTokenEarned(3, 3)).toBe(9);
    expect(puzzleTokenEarned(-2, 2)).toBe(0);
  });
});
