import { create } from "zustand";
import { NPCS } from "@/lib/game/data";
import { friendshipGainMultiplier } from "@/lib/game/progression/perk-effects";

// Friendship: 0..2500 points. 250 = 1 heart. Max 10 hearts (2500 pts).
export const POINTS_PER_HEART = 250;
export const HEARTS_MAX = 10;
export const FRIENDSHIP_MAX = POINTS_PER_HEART * HEARTS_MAX;

export type GiftReaction = "loved" | "liked" | "neutral" | "hated";

export interface NpcState {
  friendship: Record<string, number>;
  talkedToday: Record<string, boolean>;
  giftedToday: Record<string, boolean>;
  metNpcs: Record<string, boolean>; // has the player ever talked to this NPC?
}

export interface NpcActions {
  hearts: (id: string) => number; // 0..10
  heartFraction: (id: string) => number; // 0..1 within current heart
  isMet: (id: string) => boolean;
  metCount: () => number;
  talk: (id: string) => boolean; // returns true if first talk today (gave points)
  gift: (id: string, reaction: GiftReaction) => boolean; // returns true if first gift today
  reactionFor: (npcId: string, itemId: string) => GiftReaction;
  resetDaily: () => void;
  /** Reset hoàn toàn (friendship 0, met/talked/gifted rỗng) — cho Reset Farm. */
  reset: () => void;
  hydrate: (data: Partial<NpcState>) => void;
}

export const useNpcStore = create<NpcState & NpcActions>((set, get) => ({
  friendship: Object.keys(NPCS).reduce((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {} as Record<string, number>),
  talkedToday: {},
  giftedToday: {},
  metNpcs: {},

  hearts: (id) => {
    const pts = get().friendship[id] ?? 0;
    return Math.min(HEARTS_MAX, Math.floor(pts / POINTS_PER_HEART));
  },
  heartFraction: (id) => {
    const pts = get().friendship[id] ?? 0;
    return (pts % POINTS_PER_HEART) / POINTS_PER_HEART;
  },
  isMet: (id) => !!get().metNpcs[id],
  metCount: () => {
    // metNpcs có thể undefined khi hydrate từ save legacy (pre-metNpcs field)
    // — raw spread pass undefined qua. Guard tránh TypeError crash UI quest panel.
    const met = get().metNpcs ?? {};
    return Object.keys(NPCS).filter((id) => met[id]).length;
  },

  talk: (id) => {
    if (get().talkedToday[id]) return false;
    set((s) => ({
      talkedToday: { ...s.talkedToday, [id]: true },
      metNpcs: { ...s.metNpcs, [id]: true },
      friendship: { ...s.friendship, [id]: Math.min(FRIENDSHIP_MAX, (s.friendship[id] ?? 0) + 20) },
    }));
    return true;
  },

  gift: (id, reaction) => {
    if (get().giftedToday[id]) return false;
    let pts =
      reaction === "loved" ? 80 : reaction === "liked" ? 45 : reaction === "hated" ? -40 : 20;
    // Perk social-1 (Friendly Smile): +10% friendship khi gift (chỉ bonus, không penalty).
    if (pts > 0) pts = Math.round(pts * friendshipGainMultiplier());
    set((s) => ({
      giftedToday: { ...s.giftedToday, [id]: true },
      friendship: {
        ...s.friendship,
        [id]: Math.max(0, Math.min(FRIENDSHIP_MAX, (s.friendship[id] ?? 0) + pts)),
      },
    }));
    return true;
  },

  reactionFor: (npcId, itemId) => {
    const def = NPCS[npcId];
    if (!def) return "neutral";
    if (def.loves.includes(itemId)) return "loved";
    if (def.likes.includes(itemId)) return "liked";
    if (def.hates.includes(itemId)) return "hated";
    return "neutral";
  },

  resetDaily: () => set({ talkedToday: {}, giftedToday: {} }),

  // Reset hoàn toàn — trước đây SettingsPanel doReset dùng hydrate({}) → hydrate
  // fallback `data.friendship ?? s.friendship` giữ friendship CŨ khi undefined →
  // reset farm nhưng quan hệ NPC không reset (inconsistent). Set về initial.
  reset: () =>
    set({
      friendship: Object.keys(NPCS).reduce((acc, id) => {
        acc[id] = 0;
        return acc;
      }, {} as Record<string, number>),
      talkedToday: {},
      giftedToday: {},
      metNpcs: {},
    }),

  // Trust-boundary: từng field fallback default. Trước đây raw spread
  // `...data` — save legacy pre-metNpcs pass `metNpcs: undefined` → metCount()
  // crash TypeError → quest panel UI crash.
  hydrate: (data) =>
    set((s) => ({
      ...s,
      friendship: data.friendship ?? s.friendship,
      talkedToday: data.talkedToday ?? s.talkedToday,
      giftedToday: data.giftedToday ?? s.giftedToday,
      metNpcs: data.metNpcs ?? s.metNpcs,
    })),
}));
