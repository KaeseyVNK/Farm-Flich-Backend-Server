import { describe, it, expect } from "vitest";
import { activeFarmGoal } from "@/lib/game/week-quest";
import { T, MAP_COLS, MAP_ROWS } from "@/lib/game/constants";
import { CROPS } from "@/lib/game/data";
import type { CropState } from "@/store/farmStore";

// Phase 3 hayday: HUD pin = farm goal thuần (không Tide Festival).
// activeFarmGoal pure — nhận terrain/crops/inventory/level, không đọc store.
function baseTerrain(): number[] {
  return new Array(MAP_COLS * MAP_ROWS).fill(T.GRASS);
}

const LV1_PLOTS = [6, 7, 8].flatMap((tx) => [28, 29].map((ty) => ty * MAP_COLS + tx));

function crop(seed: Partial<CropState> = {}): CropState {
  return { cropId: "parsnip", stage: 0, daysGrown: 0, watered: false, dead: false, ...seed };
}

describe("activeFarmGoal (HUD farm goal)", () => {
  it("lv1, 6 ô FALLOW trống → hoe", () => {
    const terrain = baseTerrain();
    for (const i of LV1_PLOTS) terrain[i] = T.FALLOW;
    expect(activeFarmGoal({ terrain, crops: {}, invCropTotal: 0, level: 1 })).toBe("hoe");
  });

  it("có TILLED trống (unlocked) → plant", () => {
    const terrain = baseTerrain();
    for (const i of LV1_PLOTS) terrain[i] = T.TILLED;
    expect(activeFarmGoal({ terrain, crops: {}, invCropTotal: 0, level: 1 })).toBe("plant");
  });

  it("tất cả đã trồng, chưa tưới → water", () => {
    const terrain = baseTerrain();
    const crops: Record<number, CropState> = {};
    for (const i of LV1_PLOTS) {
      terrain[i] = T.TILLED;
      crops[i] = crop({ watered: false });
    }
    expect(activeFarmGoal({ terrain, crops, invCropTotal: 0, level: 1 })).toBe("water");
  });

  it("crop mature → harvest (ưu tiên trước sell)", () => {
    const terrain = baseTerrain();
    const crops: Record<number, CropState> = {};
    for (const i of LV1_PLOTS) {
      terrain[i] = T.TILLED;
      crops[i] = crop({ watered: true, stage: CROPS.parsnip.stages - 1 });
    }
    expect(activeFarmGoal({ terrain, crops, invCropTotal: 3, level: 1 })).toBe("harvest");
  });

  it("inv có crop, không còn gì để làm → sell", () => {
    const terrain = baseTerrain();
    const crops: Record<number, CropState> = {};
    for (const i of LV1_PLOTS) {
      terrain[i] = T.TILLED;
      crops[i] = crop({ watered: true, stage: 0 });
    }
    expect(activeFarmGoal({ terrain, crops, invCropTotal: 2, level: 1 })).toBe("sell");
  });

  it("mọi việc xong → unlock theo level (1→unlock2, 2→unlock3, 4→unlock4)", () => {
    const terrain = baseTerrain();
    const crops: Record<number, CropState> = {};
    for (const i of LV1_PLOTS) {
      terrain[i] = T.TILLED;
      crops[i] = crop({ watered: true, stage: 0 });
    }
    expect(activeFarmGoal({ terrain, crops, invCropTotal: 0, level: 1 })).toBe("unlock2");
    expect(activeFarmGoal({ terrain, crops, invCropTotal: 0, level: 2 })).toBe("unlock3");
    expect(activeFarmGoal({ terrain, crops, invCropTotal: 0, level: 4 })).toBe("unlock4");
  });

  it("FALLOW chỉ ở plot khóa level → KHÔNG gợi ý hoe ô khóa", () => {
    const terrain = baseTerrain();
    terrain[17 * MAP_COLS + 11] = T.FALLOW; // (11,17) unlockLevel 3
    const goal = activeFarmGoal({ terrain, crops: {}, invCropTotal: 0, level: 1 });
    expect(goal).not.toBe("hoe");
    expect(goal).toBe("unlock2");
  });
});
