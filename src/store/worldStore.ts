import { create } from "zustand";
import { T } from "@/lib/game/constants";
import { isZoneScenerySolid } from "@/lib/game/scenery";
import { useFarmStore } from "@/store/farmStore";
import { getZone, type ZoneId } from "@/lib/game/zones";
import { decorSolidAt } from "@/lib/game/decor/decor-placement";
import { useTutorialStore } from "@/store/tutorialStore";

export const MAX_WATER_CHARGES = 40;

export interface WorldState {
  zone: ZoneId;
  wellRepaired: boolean;
  waterCharges: number;
  minedRocks: Record<string, boolean>;
  defeatedSlimes: Record<string, boolean>;
  pendingSpawn: { x: number; y: number } | null;
  version: number;
}

export interface WorldActions {
  enterZone: (zone: ZoneId, spawn?: { x: number; y: number }) => void;
  repairWell: () => void;
  refillCan: () => void;
  spendWaterCharge: () => boolean;
  mineRock: (x: number, y: number) => boolean;
  isRockMined: (x: number, y: number) => boolean;
  defeatSlime: (id: string) => boolean;
  isSlimeAlive: (id: string) => boolean;
  isSolid: (x: number, y: number) => boolean;
  reset: () => void;
  hydrate: (data: Partial<WorldState>) => void;
}

function rockKey(x: number, y: number): string {
  return `${x},${y}`;
}

const INITIAL: WorldState = {
  zone: "farm",
  wellRepaired: false,
  waterCharges: 20,
  minedRocks: {},
  defeatedSlimes: {},
  pendingSpawn: null,
  version: 0,
};

export const useWorldStore = create<WorldState & WorldActions>((set, get) => ({
  ...INITIAL,

  enterZone: (zone, spawn) =>
    set((s) => ({
      zone,
      pendingSpawn: spawn ?? getZone(zone).spawn,
      version: s.version + 1,
    })),

  repairWell: () => set((s) => ({ wellRepaired: true, version: s.version + 1 })),

  refillCan: () => set((s) => ({ waterCharges: MAX_WATER_CHARGES, version: s.version + 1 })),

  spendWaterCharge: () => {
    const s = get();
    if (s.waterCharges <= 0) return false;
    set({ waterCharges: s.waterCharges - 1 });
    return true;
  },

  mineRock: (x, y) => {
    const zone = getZone(get().zone);
    const hit = zone.rocks.some((r) => r.x === x && r.y === y);
    if (!hit) return false;
    const key = rockKey(x, y);
    if (get().minedRocks[key]) return false;
    set((s) => ({
      minedRocks: { ...s.minedRocks, [key]: true },
      version: s.version + 1,
    }));
    return true;
  },

  isRockMined: (x, y) => !!get().minedRocks[rockKey(x, y)],

  defeatSlime: (id) => {
    if (get().defeatedSlimes[id]) return false;
    set((s) => ({
      defeatedSlimes: { ...s.defeatedSlimes, [id]: true },
      version: s.version + 1,
    }));
    useTutorialStore.getState().tickMonsterDefeat();
    return true;
  },

  isSlimeAlive: (id) => !get().defeatedSlimes[id],

  isSolid: (x, y) => {
    const { zone, minedRocks, defeatedSlimes } = get();
    const layout = getZone(zone);
    if (x < 0 || y < 0 || x >= layout.cols || y >= layout.rows) return true;
    if (zone === "farm") {
      // Farm: farmStore (crops/props) first — farm skips the terrain/ore/
      // slime/bed branches below (pre-existing semantics).
      if (useFarmStore.getState().isSolid(x, y)) return true;
    } else {
      const t = layout.terrain[y * layout.cols + x];
      const oreHere = layout.rocks.some((r) => r.x === x && r.y === y);
      if (oreHere && minedRocks[rockKey(x, y)]) {
        // mined node is walkable even if the authored tile was ROCK
      } else if (t === T.WATER || t === T.ROCK || t === T.TREE || t === T.FENCE) {
        return true;
      }
      if (layout.slimes.some((s) => s.x === x && s.y === y && !defeatedSlimes[s.id])) {
        return true;
      }
      if (layout.beds.some((b) => b.x === x && b.y === y)) return true;
    }
    // Generic scenery dispatch for ALL zones (Task 8): registered zone data
    // W3P3: decor đã đặt (def.solid, footprint theo rot) chặn di chuyển —
    // worldStore đọc qua helper thuần decorSolidAt (farm + house).
    if (zone === "farm" || zone === "house") {
      if (decorSolidAt(useFarmStore.getState().placedDecor, zone, x, y)) return true;
    }
    // first, farm fallback second — village/beach/cave/house landmarks
    // collide; farm keeps isFarmScenerySolid exactly as before.
    return isZoneScenerySolid(zone, x, y);
  },

  reset: () => set({ ...INITIAL, minedRocks: {}, defeatedSlimes: {}, version: get().version + 1 }),

  hydrate: (data) => {
    const sanitizeBool = (raw: unknown): Record<string, boolean> => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v === true) out[k] = true;
      }
      return out;
    };
    const zones: ZoneId[] = ["farm", "house", "village", "cave", "beach", "deepforest"];
    set((s) => ({
      zone: zones.includes(data.zone as ZoneId) ? (data.zone as ZoneId) : s.zone,
      wellRepaired: data.wellRepaired === true,
      waterCharges:
        typeof data.waterCharges === "number" && Number.isFinite(data.waterCharges)
          ? Math.max(0, Math.min(MAX_WATER_CHARGES, Math.floor(data.waterCharges)))
          : s.waterCharges,
      minedRocks: sanitizeBool(data.minedRocks),
      defeatedSlimes: sanitizeBool(data.defeatedSlimes),
      version: s.version + 1,
    }));
  },
}));
