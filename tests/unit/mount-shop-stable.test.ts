// Wave 6 P4 — stable spot sạch + buyMount flow (gold/level gate).
import { describe, expect, it, beforeEach } from "vitest";
import {
  FARM_STABLE,
  FARM_TREES,
  FARM_PLOTS,
  isFarmScenerySolid,
} from "@/lib/game/farm-scenery-layout";
import { FARM_ZONE } from "@/lib/game/zones";
import { T } from "@/lib/game/constants";
import { gameActions } from "@/lib/game/actions";
import { useGameStore } from "@/store/gameStore";
import { useProgressionStore } from "@/store/progressionStore";
import { useMountStore } from "@/store/mountStore";

describe("stable spot (farm layout)", () => {
  it("rect 3×3 không đè cây/plot/nước/warp", () => {
    for (let x = FARM_STABLE.tx; x < FARM_STABLE.tx + FARM_STABLE.cols; x++) {
      for (let y = FARM_STABLE.ty; y < FARM_STABLE.ty + FARM_STABLE.rows; y++) {
        // không plot
        expect(FARM_PLOTS.some((p) => p.tx === x && p.ty === y)).toBe(false);
        // không cây 2×2
        expect(FARM_TREES.some((t) => x >= t.tx && x <= t.tx + 1 && y >= t.ty && y <= t.ty + 1)).toBe(false);
        // không nước/warp tile
        const t = FARM_ZONE.terrain[y * FARM_ZONE.cols + x];
        expect(t === T.WATER || t === T.TREE || t === T.ROCK).toBe(false);
      }
    }
  });
  it("stable solid — isFarmScenerySolid trong rect 5×3, tile kề walkable", () => {
    expect(isFarmScenerySolid(50, 46)).toBe(true);
    expect(isFarmScenerySolid(54, 48)).toBe(true);
    expect(isFarmScenerySolid(49, 46)).toBe(false);
    expect(isFarmScenerySolid(51, 49)).toBe(false);
  });
});

describe("buyMount", () => {
  beforeEach(() => {
    useMountStore.getState().reset();
    useProgressionStore.getState().reset();
    useGameStore.getState().hydrate?.({ gold: 5000 });
    useGameStore.getState().addGold(5000 - useGameStore.getState().gold); // đảm bảo đủ
  });

  it("đủ vàng + level → trừ vàng, owned + active", () => {
    // bicycle lv2 — progression reset = level 1 → cần addXp tới lv2
    const prog = useProgressionStore.getState();
    while (useProgressionStore.getState().level < 2) prog.addXp(50);
    const gold0 = useGameStore.getState().gold;
    expect(gameActions.buyMount("bicycle")).toBe(true);
    expect(useGameStore.getState().gold).toBe(gold0 - 1500);
    expect(useMountStore.getState().owned).toEqual(["bicycle"]);
    expect(useMountStore.getState().active).toBe("bicycle");
    // mua lại → false
    expect(gameActions.buyMount("bicycle")).toBe(false);
  });

  it("thiếu level → false, không trừ vàng", () => {
    // horse lv4 — level 1
    const gold0 = useGameStore.getState().gold;
    expect(gameActions.buyMount("horse")).toBe(false);
    expect(useGameStore.getState().gold).toBe(gold0);
    expect(useMountStore.getState().owned).toEqual([]);
  });

  it("thiếu vàng → false (lv đủ)", () => {
    const prog = useProgressionStore.getState();
    while (useProgressionStore.getState().level < 4) prog.addXp(80);
    useGameStore.getState().addGold(-useGameStore.getState().gold); // về 0
    expect(gameActions.buyMount("horse")).toBe(false);
    expect(useMountStore.getState().owned).toEqual([]);
  });
});
