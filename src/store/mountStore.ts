// Wave 6 P2 — Mount state (owned/active/mounted).
// §7-like: mounts thuộc NGƯỜI CHƠI (không nằm farm block — raid chỉ đọc
// terrain/crops/objects nên không trộm được). `mounted` KHÔNG persist —
// reload/warp-into-house xuống ngựa (ephermal, đúng plan).
import { create } from "zustand";
import { canMount, mountById, type MountCheck } from "@/lib/game/mounts/mount-catalog";
import { useTutorialStore } from "@/store/tutorialStore";

export interface MountState {
  /** Mount id đã mua (subset catalog). */
  owned: string[];
  /** Mount đang chọn để cưỡi (null = đi bộ). */
  active: string | null;
  /** Đang cưỡi (ephermal — không save). */
  mounted: boolean;
}

export interface MountActions {
  /** Mua (đã trừ vàng ở action shop) — thêm owned + đặt active. */
  acquire: (mountId: string) => boolean;
  /** Lên ngựa — gate qua canMount (level/zone/tool/fishing). */
  mount: (ctx: { level: number; zone: string; holdingTool: boolean; fishing: boolean }) => MountCheck;
  /** Xuống ngựa (auto khi vào house/câu cá/cầm tool). */
  dismount: () => void;
  toggle: (ctx: { level: number; zone: string; holdingTool: boolean; fishing: boolean }) => MountCheck;
  reset: () => void;
  /** Save hydrate — sanitize: owned ⊆ catalog, active ∈ owned ∪ null, mounted=false. */
  hydrate: (data: Partial<MountState>) => void;
}

const INITIAL: MountState = { owned: [], active: null, mounted: false };

export const useMountStore = create<MountState & MountActions>((set, get) => ({
  ...INITIAL,
  acquire: (mountId) => {
    if (!mountById(mountId)) return false;
    if (get().owned.includes(mountId)) return false;
    set((s) => ({ owned: [...s.owned, mountId], active: mountId }));
    return true;
  },
  mount: (ctx) => {
    const s = get();
    if (!s.active) return { ok: false, reason: "unknown" };
    if (!s.owned.includes(s.active)) return { ok: false, reason: "unknown" };
    const check = canMount(s.active, ctx.level, ctx.zone, ctx.holdingTool, ctx.fishing);
    if (check.ok) {
      set({ mounted: true });
      useTutorialStore.getState().tickMount();
    }
    return check;
  },
  dismount: () => set({ mounted: false }),
  toggle: (ctx) => (get().mounted ? (get().dismount(), { ok: true }) : get().mount(ctx)),
  reset: () => set(INITIAL),
  hydrate: (data) => {
    const ownedRaw = Array.isArray(data.owned) ? data.owned : [];
    const owned = ownedRaw.filter((id) => !!mountById(id));
    const active = typeof data.active === "string" && owned.includes(data.active) ? data.active : null;
    set({ owned, active, mounted: false }); // mounted luôn reset khi load
  },
}));
