// progressionStore (phase 6 wire). Zustand store wrap progression-curve pure logic.
// XP hooks: farming actions (till/plant/water/harvest), sell, raid, quest → addXp.
// Level-up trigger feedback bundle (juice) + skill point.
import { create } from "zustand";
import {
  createProgression,
  addXp as addXpPure,
  MAX_LEVEL,
  type ProgressionState,
} from "@/lib/game/progression/progression-curve";
import { PERKS, meetsPrerequisite, type TreeId } from "@/lib/game/progression/perks";
import { useAnimalStore } from "@/store/animalStore";
import { useGameStore } from "@/store/gameStore";
import { xpMultiplier } from "@/lib/game/buff";

export interface PerkAllocations {
  farming: number;
  combat: number;
  social: number;
}

interface ProgressionStore extends ProgressionState {
  /** Perk points spent per tree. Saved cùng progression (audit #1). */
  perkAllocations: PerkAllocations;
  /** Level-up toast trigger (UI consume + clear). */
  levelUpToast: { level: number; gained: number } | null;
  addXp: (amount: number) => void;
  spendSkillPoint: () => boolean;
  allocatePerk: (tree: keyof PerkAllocations) => boolean;
  clearLevelUpToast: () => void;
  hydrate: (p: Partial<ProgressionState> & { perkAllocations?: PerkAllocations }) => void;
  reset: () => void;
}

export const useProgressionStore = create<ProgressionStore>((set, get) => ({
  ...createProgression(),
  perkAllocations: { farming: 0, combat: 0, social: 0 },
  levelUpToast: null,
  addXp: (amount) => {
    // Guard negative/NaN — addXpPure không chặn (xp có thể âm, totalXp giảm).
    // Caller luôn truyền XP_REWARDS dương, nhưng addXp export reachable từ
    // test-bridge/debug. Clamp tại trust boundary.
    if (!Number.isFinite(amount) || amount <= 0) return;
    const cur = get();
    const { state, levelsGained } = addXpPure(
      { level: cur.level, xp: cur.xp, totalXp: cur.totalXp, skillPoints: cur.skillPoints },
      amount,
    );
    set({
      level: state.level,
      xp: state.xp,
      totalXp: state.totalXp,
      skillPoints: state.skillPoints,
      levelUpToast: levelsGained > 0 ? { level: state.level, gained: levelsGained } : null,
    });
    // Phase 3 hayday: lên cấp → spawn livestock theo level (gà lv3, bò lv4).
    // Chỉ hook tại đây — hydrate save KHÔNG tự spawn (animals nằm trong save).
    if (levelsGained > 0) useAnimalStore.getState().syncForLevel(state.level);
  },
  spendSkillPoint: () => {
    if (get().skillPoints <= 0) return false;
    set((s) => ({ skillPoints: s.skillPoints - 1 }));
    return true;
  },
  allocatePerk: (tree) => {
    // Defense-in-depth: UI (SkillTreePanel) đã chặn allocate vượt max rank + yêu cầu
    // prereq tuần tự, nhưng store method có thể bị caller khác (test bridge, save
    // hydrate lệch) gọi. Cap theo PERKS[tree].length (rank tối đa) + enforce tuần tự.
    // Không cap → perkAllocations.farming = 15 khi chỉ có 10 perk → lãng phí điểm,
    // currentPerk() tìm rank 16 → undefined (không crash nhưng state lệch).
    const cur = get().perkAllocations[tree] ?? 0;
    const maxRank = PERKS[tree].length;
    const nextRank = cur + 1;
    if (nextRank > maxRank) return false; // vượt cap perk tree
    if (!meetsPrerequisite(get().perkAllocations, tree as TreeId, nextRank)) return false;
    if (!get().spendSkillPoint()) return false;
    set((s) => ({
      perkAllocations: { ...s.perkAllocations, [tree]: s.perkAllocations[tree] + 1 },
    }));
    return true;
  },
  clearLevelUpToast: () => set({ levelUpToast: null }),
  hydrate: (p) =>
    set((s) => {
      // Trust boundary: save cũ/lệch/hand-edit có thể mang perkAllocations vượt
      // cap perk tree hoặc skillPoints âm. Clamp để currentPerk/hasPerk không
      // trả undefined/áp dụng perk player chưa earned. Numeric fields cũng
      // validate — NaN level → addXp `NaN < MAX_LEVEL` false → xp frozen,
      // UI hiển thị "NaN / 10".
      const num = (v: unknown, fb: number) =>
        typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fb;
      const pa = p.perkAllocations ?? s.perkAllocations;
      const clampPerk = (t: keyof PerkAllocations) =>
        Math.max(0, Math.min(PERKS[t].length, Math.floor(pa[t] ?? 0)));
      return {
        level: Math.max(1, Math.min(MAX_LEVEL, num(p.level, s.level))),
        xp: num(p.xp, s.xp),
        totalXp: num(p.totalXp, s.totalXp),
        skillPoints: Math.max(0, num(p.skillPoints, s.skillPoints)),
        perkAllocations: {
          farming: clampPerk("farming"),
          combat: clampPerk("combat"),
          social: clampPerk("social"),
        },
      };
    }),
  reset: () =>
    set({
      ...createProgression(),
      perkAllocations: { farming: 0, combat: 0, social: 0 },
      levelUpToast: null,
    }),
}));

/** XP reward per action source. Phase 6 balance: farming small, raid/combat big.
 *  Phase 2 hayday: harvest 10 / sell 3 — 6 chu kỳ parsnip = 114 ≥ 100 (lv1→2). */
export const XP_REWARDS = {
  till: 2,
  plant: 3,
  water: 1,
  harvest: 10,
  sell: 3,
  fish: 8, // Wave 1 P3 — giữa harvest (10) và sell (3)
  cook: 6, // Wave 2 P4 — nấu món (tier cao nhân cookXp riêng ở action)
  raid: 50,
  quest: 30,
  socialGift: 5,
  combat: 12,
} as const;

/** Helper: award XP from action. Called by gameActions hooks.
 * W2: nhân xpMultiplier khi đang có buff xp (món nấu Fruit Salad…). */
export function awardXp(action: keyof typeof XP_REWARDS): void {
  const g = useGameStore.getState();
  const mult = xpMultiplier(g.buffs, g.day, g.timeMinutes);
  // Round — nhân 1.2 sinh float (9.6000…01) làm lệch hiển thị.
  useProgressionStore.getState().addXp(Math.round(XP_REWARDS[action] * mult));
}

export { MAX_LEVEL };
