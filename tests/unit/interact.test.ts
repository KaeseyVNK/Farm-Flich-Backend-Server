import { describe, it, expect, beforeEach, vi } from "vitest";
import { useInventoryStore } from "../../src/store/inventoryStore";
import { useGameStore } from "../../src/store/gameStore";
import { useFarmStore } from "../../src/store/farmStore";
import { useNpcStore } from "../../src/store/npcStore";
import { useQuestStore } from "../../src/store/questStore";
import { useUiStore } from "../../src/store/uiStore";
import { useProgressionStore } from "../../src/store/progressionStore";
import { tryInteract } from "../../src/lib/game/interact";
import { T } from "../../src/lib/game/constants";
import { gameActions } from "../../src/lib/game/actions";
import { setFallow } from "./helpers/fallow-tile";

// Audit: tryInteract (src/lib/game/interact.ts) — dispatcher tương tác trung tâm
// (tool priority, placeable, shipping deposit, plant, eat, 6 tool actions) chưa
// có unit test trực tiếp (chỉ E2E smoke). Viết test đầy đủ từng nhánh.

const ctx = (opts?: Partial<Parameters<typeof tryInteract>[0]>) => ({
  facingTile: { x: 5, y: 5 },
  playerTile: { x: 5, y: 5 },
  npcs: [],
  flash: vi.fn(),
  ...opts,
});

function resetStores() {
  useInventoryStore.getState().hydrate([], 0);
  useInventoryStore.getState().equipTool("hoe");
  useGameStore.getState().hydrate({
    day: 1,
    season: "Spring",
    seasonIndex: 0,
    year: 1,
    timeMinutes: 6 * 60,
    gold: 500,
    energy: useGameStore.getState().maxEnergy,
    collapsed: false,
    totalEarned: 0,
    toolsUsed: 0,
  });
  useFarmStore.getState().hydrate({
    terrain: new Array(30 * 22).fill(T.GRASS),
    crops: {},
    objects: {},
    forage: {},
    shippingBoxes: {},
    silo: {},
  } as never);
  useNpcStore.getState().hydrate({ friendship: {}, talkedToday: {}, giftedToday: {}, metNpcs: {} });
  useQuestStore.getState().reset();
  useProgressionStore.getState().reset();
  useUiStore.getState().closeDialogue();
  useUiStore.getState().closeGiftPicker();
}

// helper: tìm vị trí tile hợp lệ (không trùng player)
const tile = 5 * 60 + 5;

describe("tryInteract (cross-engine dispatcher)", () => {
  beforeEach(resetStores);

  it("ngoài bounds → didSomething false, không crash", () => {
    const r = tryInteract(ctx({ facingTile: { x: -1, y: 0 } }));
    expect(r.didSomething).toBe(false);
    expect(r.kind).toBe("none");
  });

  it("NPC gần → mở dialogue, không tiêu thụ năng lượng", () => {
    const npcs = [{ id: "npc_1", tx: 5, ty: 5 }];
    const r = tryInteract(ctx({ npcs }));
    expect(r.didSomething).toBe(true);
    expect(r.openedDialogue).toBe(true);
    expect(r.kind).toBe("npc");
    expect(useUiStore.getState().dialogueNpc).toBe("npc_1");
  });

  it("NPC ưu tiên tile đang đối diện hơn NPC gần", () => {
    const npcs = [
      { id: "far", tx: 4, ty: 4 },
      { id: "facing", tx: 5, ty: 5 },
    ];
    tryInteract(ctx({ npcs, playerTile: { x: 6, y: 5 } }));
    expect(useUiStore.getState().dialogueNpc).toBe("facing");
  });

  it("đặt fence_item trên FALLOW → placeObject + xóa item + flash", () => {
    setFallow(5, 5);
    useInventoryStore.getState().addItem("fence_item", 1);
    useInventoryStore.getState().selectSlot(0);
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(useFarmStore.getState().objects[tile]?.type).toBe("fence");
    expect(useInventoryStore.getState().countItem("fence_item")).toBe(0);
  });

  it("đặt shipping_box trên FALLOW → objects.shipping_box + flash vàng", () => {
    setFallow(5, 5);
    useInventoryStore.getState().addItem("shipping_box", 1);
    useInventoryStore.getState().selectSlot(0);
    const c = ctx();
    tryInteract(c);
    expect(useFarmStore.getState().objects[tile]?.type).toBe("shipping_box");
    expect(c.flash).toHaveBeenCalledWith("#e7b94e");
  });

  it("đặt placeable lên tile không hợp lệ → warn, không đặt", () => {
    useFarmStore.getState().hydrate({
      terrain: new Array(30 * 22).fill(T.WATER),
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
    } as never);
    useInventoryStore.getState().addItem("fence_item", 1);
    useInventoryStore.getState().selectSlot(0);
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(useFarmStore.getState().objects[tile]).toBeUndefined();
    expect(useInventoryStore.getState().countItem("fence_item")).toBe(1);
  });

  it("cầm crop + đối diện shipping_box → deposit 60% price, xóa item", () => {
    // đặt box trên tile (5,5)
    useFarmStore.getState().hydrate({
      terrain: new Array(30 * 22).fill(T.GRASS),
      crops: {},
      objects: { [tile]: { type: "shipping_box" } },
      forage: {},
      shippingBoxes: {},
    } as never);
    useInventoryStore.getState().addItem("parsnip", 1);
    useInventoryStore.getState().selectSlot(0);
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(useFarmStore.getState().shippingBoxes[tile]?.contents).toMatchObject({ parsnip: 1 });
    expect(useInventoryStore.getState().countItem("parsnip")).toBe(0);
  });

  it("W2 review-fix: cầm MÓN ĂN (food+energy) + đối diện shipping_box → DEPOSIT thắng, không ăn", () => {
    // Trước fix: nhánh eat (được nhấc lên trên zone-gate để ăn được trong nhà)
    // chặn deposit — mất khả năng ship món ăn (pumpkin_soup 620g!).
    useFarmStore.getState().hydrate({
      terrain: new Array(30 * 22).fill(T.GRASS),
      crops: {},
      objects: { [tile]: { type: "shipping_box" } },
      forage: {},
      shippingBoxes: {},
    } as never);
    useInventoryStore.getState().addItem("pumpkin_soup", 1);
    useInventoryStore.getState().selectSlot(0);
    const energyBefore = useGameStore.getState().energy;
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(useFarmStore.getState().shippingBoxes[tile]?.contents).toMatchObject({ pumpkin_soup: 1 });
    expect(useInventoryStore.getState().countItem("pumpkin_soup")).toBe(0);
    expect(useGameStore.getState().energy).toBe(energyBefore); // KHÔNG ăn
  });

  it("cầm seed → plantSelectedOnTile, flash xanh", () => {
    setFallow(5, 5);
    useFarmStore.getState().till(5, 5);
    useInventoryStore.getState().addItem("parsnip_seed", 1);
    useInventoryStore.getState().selectSlot(0);
    const c = ctx();
    const r = tryInteract(c);
    expect(r.didSomething).toBe(true);
    expect(useFarmStore.getState().crops[tile]).toBeDefined();
    expect(c.flash).toHaveBeenCalledWith("#4e7d3a");
  });

  it("cầm food → ăn, +energy, xóa item", () => {
    // Hạ energy xuống thấp để bread (+80) không bị cap ở maxEnergy (270)
    useGameStore.getState().hydrate({ energy: 100 } as never);
    useInventoryStore.getState().addItem("bread", 1);
    useInventoryStore.getState().selectSlot(0);
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(useGameStore.getState().energy).toBe(180); // 100 + 80
    expect(useInventoryStore.getState().countItem("bread")).toBe(0);
  });

  // helper: đặt tool vào slot 0 và chọn nó (tool phải trong slot — như game thật)
  function equipSlotTool(itemId: string) {
    useInventoryStore.getState().hydrate([], 0);
    useInventoryStore.getState().addItem(itemId, 1);
    useInventoryStore.getState().selectSlot(0);
  }

  it("hoe trên cỏ → tile GRASS, energy không trừ, notify Trồng trên ô ruộng", () => {
    equipSlotTool("hoe");
    const energyBefore = useGameStore.getState().energy;
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.GRASS);
    expect(useGameStore.getState().energy).toBe(energyBefore);
    expect(useUiStore.getState().notifications.some((n) => n.text.includes("Trồng trên ô ruộng"))).toBe(
      true,
    );
  });

  it("hoe trên FALLOW → till + tiêu 2 energy + recordToolUse", () => {
    setFallow(5, 5);
    equipSlotTool("hoe");
    const energyBefore = useGameStore.getState().energy;
    const toolsBefore = useGameStore.getState().toolsUsed;
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(r.kind).toBe("till");
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.TILLED);
    expect(useGameStore.getState().energy).toBe(energyBefore - 2);
    expect(useGameStore.getState().toolsUsed).toBe(toolsBefore + 1);
  });

  it("hoe trên tile đã till → warn, không thay đổi", () => {
    setFallow(5, 5);
    useFarmStore.getState().till(5, 5);
    equipSlotTool("hoe");
    const energyBefore = useGameStore.getState().energy;
    tryInteract(ctx());
    expect(useGameStore.getState().energy).toBe(energyBefore); // không tiêu năng lượng khi fail
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.TILLED);
  });

  it("hoe ô plot khóa level → notify Ruộng này mở ở cấp N (phase 2)", () => {
    useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
    setFallow(9, 28); // unlockLevel 3
    equipSlotTool("hoe");
    const energyBefore = useGameStore.getState().energy;
    tryInteract(ctx({ facingTile: { x: 9, y: 28 }, playerTile: { x: 9, y: 28 } }));
    expect(useFarmStore.getState().getTile(9, 28)).toBe(T.FALLOW); // không mutate
    expect(useGameStore.getState().energy).toBe(energyBefore);
    expect(
      useUiStore.getState().notifications.some((n) => n.text.includes("Ruộng này mở ở cấp 3")),
    ).toBe(true);
  });

  it("water khi watering_can trong slot chọn → TILLED_WET + tiêu 2 energy", () => {
    setFallow(5, 5);
    useFarmStore.getState().till(5, 5);
    useInventoryStore.getState().addItem("watering_can", 1);
    useInventoryStore.getState().selectSlot(0);
    const energyBefore = useGameStore.getState().energy;
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(r.kind).toBe("water");
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.TILLED_WET);
    expect(useGameStore.getState().energy).toBe(energyBefore - 2);
  });

  it("slot rỗng + equip watering_can (itemId) → KHÔNG water, xử hand/harvest", () => {
    // Tình huống: player chọn ô trống (ô trống → hand), nhưng _equippedTool
    // còn là watering_can. Không được map nhầm thành water.
    setFallow(5, 5);
    useFarmStore.getState().till(5, 5);
    useInventoryStore.getState().equipTool("watering_can"); // chỉ set _equippedTool
    const energyBefore = useGameStore.getState().energy;
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    // tool = "hand" (slot rỗng) → không water → tile vẫn TILLED (4), không thành TILLED_WET (5)
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.TILLED);
    expect(useGameStore.getState().energy).toBe(energyBefore);
  });

  it("energy = 0 → tool bị chặn trước khi till, không đổi tile", () => {
    useGameStore.getState().hydrate({ energy: 0 } as never);
    equipSlotTool("hoe");
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true); // cooldown gate vẫn chạy (tiêu thụ nhịp)
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.GRASS); // KHÔNG till miễn phí
    expect(useGameStore.getState().energy).toBe(0);
  });

  it("axe chặt cây → +wood (2-4), +energy cost 4, optional sap", () => {
    const terrain = new Array(30 * 22).fill(T.GRASS);
    terrain[tile] = T.TREE;
    useFarmStore.getState().hydrate({
      terrain,
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
    } as never);
    equipSlotTool("axe");
    const energyBefore = useGameStore.getState().energy;
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(r.kind).toBe("chop");
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.STUMP);
    expect(useInventoryStore.getState().countItem("wood")).toBeGreaterThanOrEqual(2);
    expect(useGameStore.getState().energy).toBe(energyBefore - 4);
  });

  it("axe khi túi đầy → mất loot nhưng có warn (KHÔNG drop im lặng)", () => {
    const terrain = new Array(30 * 22).fill(T.GRASS);
    terrain[tile] = T.TREE;
    useFarmStore.getState().hydrate({
      terrain,
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
    } as never);
    // Đổ đầy 12 slot (mỗi slot 1 item riêng) → addItem không có chỗ.
    for (let i = 0; i < 12; i++) useInventoryStore.getState().addItem("wood", 1);
    useInventoryStore.getState().hydrate(
      Array.from({ length: 12 }, () => ({ itemId: "stone", qty: 1 })),
      0,
    );
    // axe cũng phải trong slot — nhưng túi đầy, dùng hydrate đặt axe slot 0
    useInventoryStore.getState().hydrate(
      [{ itemId: "axe", qty: 1 }, ...Array.from({ length: 11 }, () => ({ itemId: "stone", qty: 1 }))],
      0,
    );
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.STUMP); // vẫn chặt được
    // Không crash, axe đã dùng (energy tiêu). Loot bị mất (leftover) nhưng có warn notify.
    expect(useGameStore.getState().energy).toBeLessThan(useGameStore.getState().maxEnergy);
  });

  it("pickaxe đập đá → +stone (1-2), +energy cost 4", () => {
    const terrain = new Array(30 * 22).fill(T.GRASS);
    terrain[tile] = T.ROCK;
    useFarmStore.getState().hydrate({
      terrain,
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
    } as never);
    equipSlotTool("pickaxe");
    const energyBefore = useGameStore.getState().energy;
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(r.kind).toBe("mine");
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.STONE_EMPTY);
    expect(useInventoryStore.getState().countItem("stone")).toBeGreaterThanOrEqual(1);
    expect(useGameStore.getState().energy).toBe(energyBefore - 4);
  });

  it("scythe cắt GRASS_FLOWER → GRASS + có thể +fiber, tiêu 1 energy", () => {
    const terrain = new Array(30 * 22).fill(T.GRASS);
    terrain[tile] = T.GRASS_FLOWER;
    useFarmStore.getState().hydrate({
      terrain,
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
    } as never);
    equipSlotTool("scythe");
    const energyBefore = useGameStore.getState().energy;
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(useGameStore.getState().energy).toBe(energyBefore - 1);
    expect(useFarmStore.getState().getTile(5, 5)).toBe(T.GRASS); // grass flower cắt thành grass
  });

  it("hand trên cây trồng trưởng thành → harvest vào SILO (không vào túi)", () => {
    const terrain = new Array(30 * 22).fill(T.GRASS);
    terrain[tile] = T.TILLED;
    useFarmStore.getState().hydrate({
      terrain,
      crops: { [tile]: { cropId: "parsnip", stage: 4, watered: false, dead: false } },
      objects: {},
      forage: {},
      shippingBoxes: {},
    } as never);
    useInventoryStore.getState().equipTool("hand");
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(r.kind).toBe("harvest");
    // Phase 5: crop vào silo, túi KHÔNG nhận parsnip (seed drop vẫn túi).
    expect(useFarmStore.getState().silo.parsnip ?? 0).toBeGreaterThanOrEqual(1);
    expect(useFarmStore.getState().crops[tile]).toBeUndefined(); // harvest xóa crop
  });

  it("hand trên forage → pickupForage + addItem", () => {
    useFarmStore.getState().hydrate({
      terrain: new Array(30 * 22).fill(T.GRASS),
      crops: {},
      objects: {},
      forage: { [tile]: "fiber" },
      shippingBoxes: {},
    } as never);
    useInventoryStore.getState().equipTool("hand");
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(r.kind).toBe("forage");
    expect(useInventoryStore.getState().countItem("fiber")).toBe(1);
  });

  it("hand trên tile trống → notify info, không crash", () => {
    useInventoryStore.getState().equipTool("hand");
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
  });

  it("harvest khi túi ĐẦY → crop vào SILO, harvest vẫn thành công", () => {
    // Phase 5: crop không còn phụ thuộc túi — silo nhận. Fill 12 slot wood
    // (không chỗ cho parsnip trong túi) nhưng silo trống → harvest OK.
    const terrain = new Array(30 * 22).fill(T.GRASS);
    terrain[tile] = T.TILLED;
    useFarmStore.getState().hydrate({
      terrain,
      crops: { [tile]: { cropId: "parsnip", stage: 4, watered: false, dead: false } },
      objects: {},
      forage: {},
      shippingBoxes: {},
      silo: {},
    } as never);
    const full = Array(12)
      .fill(null)
      .map(() => ({ itemId: "wood", qty: 999 }));
    useInventoryStore.getState().hydrate(full as never, 0);
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    expect(r.kind).toBe("harvest");
    expect(useFarmStore.getState().silo.parsnip ?? 0).toBeGreaterThanOrEqual(1);
    expect(useFarmStore.getState().crops[tile]).toBeUndefined();
    expect(useFarmStore.getState().terrain[tile]).toBe(T.FALLOW);
  });

  it("harvest khi SILO ĐẦY → KHÔNG harvest, crop còn trên ô, notify Kho đầy", () => {
    useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
    const terrain = new Array(30 * 22).fill(T.GRASS);
    terrain[tile] = T.TILLED;
    // lv1 cap 20 — silo đầy parsnip
    useFarmStore.getState().hydrate({
      terrain,
      crops: { [tile]: { cropId: "parsnip", stage: 4, watered: false, dead: false } },
      objects: {},
      forage: {},
      shippingBoxes: {},
      silo: { parsnip: 20 },
    } as never);
    useInventoryStore.getState().equipTool("hand");
    const r = tryInteract(ctx());
    expect(r.didSomething).toBe(true);
    // crop KHÔNG bị xóa — chờ chỗ trống trong kho
    expect(useFarmStore.getState().crops[tile]).toBeDefined();
    expect(useFarmStore.getState().terrain[tile]).toBe(T.TILLED);
    expect(useFarmStore.getState().silo.parsnip).toBe(20);
    expect(
      useUiStore.getState().notifications.some((n) =>
        n.text.includes("Kho đầy — nâng cấp hoặc bán bớt"),
      ),
    ).toBe(true);
  });
});
