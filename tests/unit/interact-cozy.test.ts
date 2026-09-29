import { describe, expect, it, beforeEach, vi } from "vitest";
import { tryInteract } from "@/lib/game/interact";
import { useWorldStore } from "@/store/worldStore";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useFarmStore } from "@/store/farmStore";
import { useUiStore } from "@/store/uiStore";
import { useAnimalStore } from "@/store/animalStore";
import { T, MAP_COLS, MAP_ROWS } from "@/lib/game/constants";

const ctx = (opts?: { x?: number; y?: number; px?: number; py?: number }) => ({
  facingTile: { x: opts?.x ?? 8, y: opts?.y ?? 4 },
  playerTile: { x: opts?.px ?? 8, y: opts?.py ?? 5 },
  npcs: [],
  flash: vi.fn(),
});

describe("cozy interact", () => {
  beforeEach(() => {
    useWorldStore.getState().reset();
    useAnimalStore.getState().reset();
    useInventoryStore.getState().hydrate(Array(12).fill(null), 0);
    useGameStore.getState().hydrate({
      day: 1,
      energy: 100,
      gold: 500,
      timeMinutes: 8 * 60,
    } as never);
    useFarmStore.getState().hydrate({
      terrain: new Array(MAP_COLS * MAP_ROWS).fill(T.GRASS),
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
      silo: {},
    } as never);
    useUiStore.getState().notify = vi.fn();
  });

  it("bed in the house ends the day", () => {
    useWorldStore.getState().enterZone("house", { x: 4, y: 4 });
    const day = useGameStore.getState().day;
    tryInteract(ctx({ x: 4, y: 3, px: 4, py: 4 }));
    expect(useGameStore.getState().day).toBe(day + 1);
  });

  it("dry well refuses refill until repaired", () => {
    useWorldStore.getState().enterZone("farm");
    tryInteract(ctx({ x: 6, y: 10, px: 8, py: 10 }));
    expect(useWorldStore.getState().waterCharges).toBe(20);
    expect(useWorldStore.getState().wellRepaired).toBe(false);
  });

  it("pond refills the watering can", () => {
    useWorldStore.getState().enterZone("farm");
    const r = tryInteract(ctx({ x: 9, y: 23, px: 9, py: 20 }));
    expect(useWorldStore.getState().waterCharges).toBe(40);
    expect(r.kind).toBe("none");
  });

  it("house door warps to farm", () => {
    useWorldStore.getState().enterZone("house", { x: 8, y: 9 });
    tryInteract(ctx({ x: 8, y: 11, px: 8, py: 10 }));
    expect(useWorldStore.getState().zone).toBe("farm");
  });

  it("feeding a hen consumes wheat", () => {
    useWorldStore.getState().enterZone("farm");
    useAnimalStore.getState().syncForLevel(3);
    useInventoryStore.getState().addItem("wheat", 1);
    useInventoryStore.getState().selectSlot(0);
    tryInteract(ctx({ x: 25, y: 8, px: 25, py: 9 }));
    expect(useAnimalStore.getState().animals.find((a) => a.id === "hen-1")?.fedToday).toBe(true);
    expect(useInventoryStore.getState().countItem("wheat")).toBe(0);
  });

  it("cave pickaxe yields copper ore", () => {
    useWorldStore.getState().enterZone("cave", { x: 11, y: 13 });
    useInventoryStore.getState().addItem("pickaxe", 1);
    useInventoryStore.getState().selectSlot(0);
    const r = tryInteract(ctx({ x: 5, y: 5, px: 5, py: 6 }));
    expect(useInventoryStore.getState().countItem("copper_ore")).toBe(1);
    expect(r.didSomething).toBe(true);
  });
});
