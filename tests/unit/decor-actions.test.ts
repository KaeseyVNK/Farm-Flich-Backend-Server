import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "../../src/store/gameStore";
import { useFarmStore } from "../../src/store/farmStore";
import { useProgressionStore } from "../../src/store/progressionStore";
import { useUiStore } from "../../src/store/uiStore";
import { gameActions } from "../../src/lib/game/actions";
import { decorById, DECOR } from "../../src/lib/game/decor/decor-catalog";

function resetAll(level = 5, gold = 500) {
  useGameStore.getState().hydrate({
    day: 3, season: "Spring", seasonIndex: 0, year: 1, timeMinutes: 600,
    gold, energy: 200, maxEnergy: 270,
  });
  useGameStore.getState().setBuffs({});
  useFarmStore.getState().hydrate({
    silo: {}, pondFish: [], filledOrders: [], decorOwned: {}, placedDecor: [],
  } as never);
  useProgressionStore.getState().hydrate({ level, xp: 0, totalXp: 0, skillPoints: 0 } as never);
}

describe("gameActions.buyDecor (W3 P5)", () => {
  beforeEach(() => resetAll());

  it("mua ok: trừ vàng đúng giá, decorOwned +1, không bump version (chưa render)", () => {
    const before = useFarmStore.getState().version;
    const fence = decorById("fence_wood")!;
    expect(gameActions.buyDecor("fence_wood")).toBe(true);
    expect(useGameStore.getState().gold).toBe(500 - fence.price);
    expect(useFarmStore.getState().decorOwned.fence_wood).toBe(1);
    expect(useFarmStore.getState().version).toBe(before);
  });

  it("mua nhiều lần cùng loại cộng dồn", () => {
    gameActions.buyDecor("fence_wood");
    gameActions.buyDecor("fence_wood");
    expect(useFarmStore.getState().decorOwned.fence_wood).toBe(2);
    expect(useGameStore.getState().gold).toBe(500 - decorById("fence_wood")!.price * 2);
  });

  it("không đủ vàng → false, không mất gì", () => {
    resetAll(5, 10); // fence_wood 80g
    expect(gameActions.buyDecor("fence_wood")).toBe(false);
    expect(useGameStore.getState().gold).toBe(10);
    expect(useFarmStore.getState().decorOwned.fence_wood).toBeUndefined();
  });

  it("level gate: item lv cao khoá ở level 2, mở ở level 5", () => {
    resetAll(2, 5000);
    const gated = DECOR.find((d) => d.unlockLevel > 2)!;
    expect(gameActions.buyDecor(gated.id)).toBe(false);
    expect(useFarmStore.getState().decorOwned[gated.id]).toBeUndefined();
    useProgressionStore.getState().hydrate({ level: 5, xp: 0, totalXp: 0, skillPoints: 0 } as never);
    expect(gameActions.buyDecor(gated.id)).toBe(true);
  });

  it("defId lạ → false im lặng", () => {
    expect(gameActions.buyDecor("khong_ton_tai")).toBe(false);
    expect(useGameStore.getState().gold).toBe(500);
  });

  it("vừa đủ vàng: đúng bằng giá → mua được (gold về 0)", () => {
    const fence = decorById("fence_wood")!;
    resetAll(5, fence.price);
    expect(gameActions.buyDecor("fence_wood")).toBe(true);
    expect(useGameStore.getState().gold).toBe(0);
  });
});

describe("farmStore.ownDecor + placeDecor round-trip (W3 P5)", () => {
  beforeEach(() => resetAll());

  it("W3P5-fix: hydrate reseed uid counter — place sau reload KHÔNG sinh uid trùng", () => {
    // save cũ có placement dc7-fence_wood → reload → place món mới phải dc8+
    useFarmStore.getState().hydrate({
      placedDecor: [{ uid: "dc7-fence_wood", defId: "fence_wood", zone: "farm", tx: 30, ty: 30, rot: 0, flip: false }],
      decorOwned: { fence_wood: 1 },
    } as never);
    expect(gameActions.buyDecor("fence_wood")).toBe(true);
    let placed = false;
    for (let y = 32; y < 55 && !placed; y++) {
      for (let x = 25; x < 55 && !placed; x++) {
        placed = useFarmStore.getState().placeDecor("fence_wood", x, y);
      }
    }
    expect(placed).toBe(true);
    const uids = useFarmStore.getState().placedDecor.map((d) => d.uid);
    expect(uids).toHaveLength(2);
    expect(new Set(uids).size).toBe(2); // không trùng
    expect(uids.some((u) => u.startsWith("dc8") || Number(/dc(\d+)/.exec(u)?.[1]) > 7)).toBe(true);
    // removeDecor uid cũ KHÔNG xóa placement mới
    const before = useFarmStore.getState().placedDecor.length;
    expect(useFarmStore.getState().removeDecor("dc7-fence_wood")).toBe(true);
    expect(useFarmStore.getState().placedDecor).toHaveLength(before - 1);
  });

  it("W3P5-fix: placeDecor chặn đặt solid lên tile người chơi (playerAt)", () => {
    expect(gameActions.buyDecor("fence_wood")).toBe(true);
    const { x, y } = { x: 30, y: 30 };
    // đưa player vào footprint (tile 30,30 — fence 1×2 phủ 30..30,30..31)
    expect(useFarmStore.getState().placeDecor("fence_wood", x, y, 0, { x: 30, y: 30 })).toBe(false);
    expect(useFarmStore.getState().placedDecor).toHaveLength(0);
    // không có playerAt (scene chưa mount) — vẫn đặt được (không phá unit cũ)
    let placed = false;
    for (let yy = 32; yy < 55 && !placed; yy++) {
      for (let xx = 25; xx < 55 && !placed; xx++) {
        placed = useFarmStore.getState().placeDecor("fence_wood", xx, yy, 0, { x: 30, y: 30 });
      }
    }
    expect(placed).toBe(true);
  });

  it("mua → đặt thử ở tile trống → decorOwned về 0, placed 1", () => {
    expect(gameActions.buyDecor("fence_wood")).toBe(true);
    // tìm tile trống bằng chính probe của store (giống e2e)
    let placed = false;
    for (let y = 25; y < 55 && !placed; y++) {
      for (let x = 25; x < 55 && !placed; x++) {
        placed = useFarmStore.getState().placeDecor("fence_wood", x, y);
      }
    }
    expect(placed).toBe(true);
    const after = useFarmStore.getState();
    expect(after.decorOwned.fence_wood).toBe(0);
    expect(after.placedDecor).toHaveLength(1);
    // nhặt trả lại → owned 1
    expect(after.removeDecor(after.placedDecor[0].uid)).toBe(true);
    expect(useFarmStore.getState().decorOwned.fence_wood).toBe(1);
    expect(useFarmStore.getState().placedDecor).toHaveLength(0);
  });
});
