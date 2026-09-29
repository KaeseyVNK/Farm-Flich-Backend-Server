import { create } from "zustand";
import { ITEMS, getItem } from "@/lib/game/data";

export interface InvSlot {
  itemId: string;
  qty: number;
}

export interface InventoryActions {
  slots: (InvSlot | null)[];
  selectedSlot: number; // hotbar index 0..11
  equipTool: (itemId: string) => void;
  selectSlot: (i: number) => void;
  addItem: (itemId: string, qty?: number) => number; // returns leftover (0 if all added)
  removeItem: (itemId: string, qty?: number) => boolean; // true if removed
  countItem: (itemId: string) => number;
  getSelectedSlot: () => InvSlot | null;
  getEquippedTool: () => string;
  sellItem: (itemId: string, qty: number) => number; // returns gold gained
  swapSlots: (a: number, b: number) => void;
  hydrate: (slots: (InvSlot | null)[], selectedSlot: number) => void;
}

const SLOT_COUNT = 12;

function makeInitial(): (InvSlot | null)[] {
  const slots: (InvSlot | null)[] = Array(SLOT_COUNT).fill(null);
  // Starter tools in first slots
  slots[0] = { itemId: "hoe", qty: 1 };
  slots[1] = { itemId: "watering_can", qty: 1 };
  slots[2] = { itemId: "axe", qty: 1 };
  slots[3] = { itemId: "pickaxe", qty: 1 };
  slots[4] = { itemId: "scythe", qty: 1 };
  // Starter seeds
  slots[5] = { itemId: "parsnip_seed", qty: 9 };
  return slots;
}

export const useInventoryStore = create<InventoryActions & { _equippedTool: string }>((set, get) => ({
  slots: makeInitial(),
  selectedSlot: 0,
  _equippedTool: "hoe",

  equipTool: (itemId) => set({ _equippedTool: itemId }),

  selectSlot: (i) => {
    const slots = get().slots;
    const idx = Math.max(0, Math.min(slots.length - 1, i));
    set({ selectedSlot: idx });
    const slot = slots[idx];
    if (slot && getItem(slot.itemId)?.type === "tool") {
      get().equipTool(slot.itemId);
    }
  },

  addItem: (itemId, qty = 1) => {
    const def = getItem(itemId);
    if (!def) return qty;
    const maxStack = def.stack ?? 1;
    let remaining = qty;
    const slots = [...get().slots];

    // First fill existing stacks of same item (if stackable)
    if (maxStack > 1) {
      for (let i = 0; i < slots.length && remaining > 0; i++) {
        const s = slots[i];
        if (s && s.itemId === itemId && s.qty < maxStack) {
          const canAdd = Math.min(maxStack - s.qty, remaining);
          slots[i] = { ...s, qty: s.qty + canAdd };
          remaining -= canAdd;
        }
      }
    }
    // Then place into empty slots
    for (let i = 0; i < slots.length && remaining > 0; i++) {
      if (!slots[i]) {
        const canAdd = Math.min(maxStack, remaining);
        slots[i] = { itemId, qty: canAdd };
        remaining -= canAdd;
      }
    }
    set({ slots });
    return remaining;
  },

  removeItem: (itemId, qty = 1) => {
    const slots = [...get().slots];
    let need = qty;
    for (let i = 0; i < slots.length && need > 0; i++) {
      const s = slots[i];
      if (s && s.itemId === itemId) {
        const take = Math.min(s.qty, need);
        slots[i] = s.qty - take <= 0 ? null : { ...s, qty: s.qty - take };
        need -= take;
      }
    }
    if (need > 0) {
      return false; // not enough
    }
    set({ slots });
    return true;
  },

  countItem: (itemId) => {
    return get().slots.reduce((sum, s) => (s && s.itemId === itemId ? sum + s.qty : sum), 0);
  },

  getSelectedSlot: () => {
    const { slots, selectedSlot } = get();
    return slots[selectedSlot] ?? null;
  },

  getEquippedTool: () => get()._equippedTool,

  sellItem: (itemId, qty) => {
    const def = getItem(itemId);
    if (!def || !def.sellPrice) return 0;
    const have = get().countItem(itemId);
    const sellQty = Math.min(have, qty);
    if (sellQty <= 0) return 0;
    const ok = get().removeItem(itemId, sellQty);
    if (!ok) return 0;
    return sellQty * def.sellPrice;
  },

  swapSlots: (a, b) => {
    const slots = [...get().slots];
    if (a < 0 || b < 0 || a >= slots.length || b >= slots.length) return;
    const tmp = slots[a];
    slots[a] = slots[b];
    slots[b] = tmp;
    set({ slots });
    // Re-equip khi slot đang chọn bị đổi chỗ: selectedSlot là index, giữ nguyên
    // sau swap nhưng content đổi → _equippedTool stale (trỏ tool cũ đã rời slot).
    // Stale → TopHUD/Hotbar hiển thị sai + Q-cycle (GameLayout) indexOf(stale)
    // chuyển nhầm tool. Re-derive từ content slot selected.
    if (get().selectedSlot === a || get().selectedSlot === b) {
      const sel = slots[get().selectedSlot];
      if (sel && getItem(sel.itemId)?.type === "tool") get().equipTool(sel.itemId);
    }
  },

  hydrate: (slots, selectedSlot) => {
    // Trust boundary: validate mỗi slot từ save có thể hỏng/cũ/NaN. Trước đây
    // raw pass → qty NaN/string poison countItem + addItem, itemId không tồn tại
    // trong ITEMS → getItem undefined → sellItem silent 0, render lỗi. Sanitize
    // từng slot: bỏ slot rác, clamp qty, drop itemId không hợp lệ.
    const merged = Array(SLOT_COUNT).fill(null) as (InvSlot | null)[];
    for (let i = 0; i < SLOT_COUNT && i < slots.length; i++) {
      const s = slots[i];
      if (!s || typeof s !== "object") continue;
      const def = getItem(s.itemId);
      if (!def) continue; // itemId không tồn tại trong data → drop
      const qty =
        typeof s.qty === "number" && Number.isFinite(s.qty) && s.qty > 0
          ? Math.floor(Math.min(s.qty, def.stack ?? 1))
          : 1;
      merged[i] = { itemId: s.itemId, qty };
    }
    const safeSlot =
      typeof selectedSlot === "number" && selectedSlot >= 0 && selectedSlot < SLOT_COUNT
        ? selectedSlot
        : 0;
    set({ slots: merged, selectedSlot: safeSlot });
  },
}));

export const INVENTORY_SLOT_COUNT = SLOT_COUNT;
