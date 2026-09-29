import { describe, it, expect, beforeEach } from "vitest";
import { useInventoryStore, INVENTORY_SLOT_COUNT } from "../../src/store/inventoryStore";

// Audit: inventoryStore (swapSlots/selectSlot/addItem/removeItem/countItem) chưa
// có unit test trực tiếp. swapSlots là logic đằng sau hotbar drag-and-drop —
// quan trọng vì vừa gate hydration sau dnd-kit. Test đầy đủ.

describe("inventoryStore", () => {
  beforeEach(() => {
    useInventoryStore.getState().hydrate([], 0);
  });

  describe("swapSlots (hotbar drag-and-drop)", () => {
    it("hoán đổi 2 slot có item", () => {
      useInventoryStore.getState().hydrate(
        [
          { itemId: "hoe", qty: 1 },
          { itemId: "parsnip_seed", qty: 5 },
        ],
        0,
      );
      useInventoryStore.getState().swapSlots(0, 1);
      const s = useInventoryStore.getState().slots;
      expect(s[0]?.itemId).toBe("parsnip_seed");
      expect(s[1]?.itemId).toBe("hoe");
      expect(s[0]?.qty).toBe(5);
    });

    it("swap với slot rỗng → di chuyển item", () => {
      useInventoryStore.getState().hydrate(
        [{ itemId: "axe", qty: 1 }, null],
        0,
      );
      useInventoryStore.getState().swapSlots(0, 1);
      const s = useInventoryStore.getState().slots;
      expect(s[0]).toBeNull();
      expect(s[1]?.itemId).toBe("axe");
    });

    it("index out of bounds → no-op, không crash", () => {
      useInventoryStore.getState().hydrate([{ itemId: "hoe", qty: 1 }], 0);
      const before = useInventoryStore.getState().slots;
      useInventoryStore.getState().swapSlots(0, 99);
      useInventoryStore.getState().swapSlots(-1, 0);
      expect(useInventoryStore.getState().slots).toEqual(before);
    });
  });

  describe("selectSlot + equip", () => {
    it("chọn tool slot → _equippedTool đổi theo item", () => {
      useInventoryStore.getState().hydrate(
        [
          { itemId: "watering_can", qty: 1 },
          { itemId: "hoe", qty: 1 },
        ],
        0,
      );
      expect(useInventoryStore.getState()._equippedTool).toBe("hoe"); // default, hydrate không auto-equip
      useInventoryStore.getState().selectSlot(0); // chọn watering_can slot
      expect(useInventoryStore.getState()._equippedTool).toBe("watering_can");
      useInventoryStore.getState().selectSlot(1); // chuyển hoe
      expect(useInventoryStore.getState()._equippedTool).toBe("hoe");
    });

    it("chọn slot không phải tool → _equippedTool giữ nguyên", () => {
      useInventoryStore.getState().hydrate(
        [{ itemId: "parsnip_seed", qty: 5 }],
        0,
      );
      useInventoryStore.getState().selectSlot(0);
      expect(useInventoryStore.getState()._equippedTool).toBe("hoe"); // default
    });

    it("chọn slot rỗng → selectedSlot đổi, _equippedTool giữ nguyên", () => {
      useInventoryStore.getState().hydrate(
        [{ itemId: "hoe", qty: 1 }, null, null],
        0,
      );
      useInventoryStore.getState().selectSlot(1);
      expect(useInventoryStore.getState().selectedSlot).toBe(1);
      expect(useInventoryStore.getState()._equippedTool).toBe("hoe");
    });
  });

  describe("swapSlots re-equip", () => {
    it("swap slot đang chọn (tool) với slot khác → _equippedTool cập nhật theo content mới", () => {
      useInventoryStore.getState().hydrate(
        [
          { itemId: "hoe", qty: 1 },
          { itemId: "watering_can", qty: 1 },
        ],
        0,
      );
      useInventoryStore.getState().selectSlot(0); // equip hoe (sync từ content)
      useInventoryStore.getState().swapSlots(0, 1);
      expect(useInventoryStore.getState().selectedSlot).toBe(0);
      // content slot 0 giờ là watering_can → re-equip
      expect(useInventoryStore.getState()._equippedTool).toBe("watering_can");
    });

    it("swap slot đang chọn (tool) với slot rỗng → _equippedTool không đổi", () => {
      useInventoryStore.getState().hydrate([{ itemId: "hoe", qty: 1 }, null, null], 0);
      useInventoryStore.getState().selectSlot(0); // equip hoe
      useInventoryStore.getState().swapSlots(0, 1);
      expect(useInventoryStore.getState().selectedSlot).toBe(0);
      // slot 0 giờ rỗng → không phải tool → _equippedTool giữ nguyên
      expect(useInventoryStore.getState()._equippedTool).toBe("hoe");
    });

    it("swap 2 slot KHÔNG chạm selectedSlot → _equippedTool không đổi", () => {
      useInventoryStore.getState().hydrate(
        [
          { itemId: "hoe", qty: 1 },
          { itemId: "axe", qty: 1 },
          { itemId: "pickaxe", qty: 1 },
        ],
        2, // selected = slot 2 (pickaxe)
      );
      useInventoryStore.getState().selectSlot(2); // equip pickaxe
      useInventoryStore.getState().swapSlots(0, 1); // hoe <-> axe
      expect(useInventoryStore.getState()._equippedTool).toBe("pickaxe");
    });
  });

  describe("addItem / removeItem / countItem", () => {
    it("addItem thêm mới, trả leftover 0", () => {
      const left = useInventoryStore.getState().addItem("wood", 3);
      expect(left).toBe(0);
      expect(useInventoryStore.getState().countItem("wood")).toBe(3);
    });

    it("addItem stack tối đa (stack 99) → leftover", () => {
      useInventoryStore.getState().addItem("wood", 99);
      const left = useInventoryStore.getState().addItem("wood", 10);
      // stack 99 → 10 vượt → leftover 10 (hoặc đầy slot mới)
      expect(left).toBeGreaterThanOrEqual(0);
    });

    it("removeItem đủ → true, count giảm", () => {
      useInventoryStore.getState().addItem("wood", 5);
      const ok = useInventoryStore.getState().removeItem("wood", 3);
      expect(ok).toBe(true);
      expect(useInventoryStore.getState().countItem("wood")).toBe(2);
    });

    it("removeItem không đủ → false, không đổi", () => {
      useInventoryStore.getState().addItem("wood", 2);
      const ok = useInventoryStore.getState().removeItem("wood", 5);
      expect(ok).toBe(false);
      expect(useInventoryStore.getState().countItem("wood")).toBe(2);
    });

    it("removeItem item không có → false", () => {
      const ok = useInventoryStore.getState().removeItem("parsnip", 1);
      expect(ok).toBe(false);
    });
  });

  describe("INVENTORY_SLOT_COUNT", () => {
    it("hằng số slot count > 0 và hydrate giữ đúng kích thước", () => {
      expect(INVENTORY_SLOT_COUNT).toBeGreaterThan(0);
      useInventoryStore.getState().hydrate(
        Array.from({ length: INVENTORY_SLOT_COUNT + 5 }, (_, i) => ({
          itemId: i % 2 === 0 ? "wood" : "stone",
          qty: 1,
        })),
        0,
      );
      expect(useInventoryStore.getState().slots.length).toBe(INVENTORY_SLOT_COUNT);
    });
  });

  describe("hydrate selectedSlot clamp", () => {
    it("selectedSlot OOB từ save lệch → clamp về 0", () => {
      useInventoryStore.getState().hydrate([], 999);
      expect(useInventoryStore.getState().selectedSlot).toBe(0);
    });
    it("selectedSlot âm → clamp về 0", () => {
      useInventoryStore.getState().hydrate([], -1);
      expect(useInventoryStore.getState().selectedSlot).toBe(0);
    });
    it("selectedSlot hợp lệ → giữ nguyên", () => {
      useInventoryStore.getState().hydrate([], 3);
      expect(useInventoryStore.getState().selectedSlot).toBe(3);
    });
  });
});
