import { create } from "zustand";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useNpcStore } from "@/store/npcStore";
import { useUiStore } from "@/store/uiStore";
import { playSfx } from "@/lib/game/sfx";
import { useProgressionStore, XP_REWARDS } from "@/store/progressionStore";
import { getItem } from "@/lib/game/data";
import { questXpMultiplier } from "@/lib/game/progression/perk-effects";
import { useWorldStore } from "@/store/worldStore";
import { useTutorialStore } from "@/store/tutorialStore";
import { useFarmStore } from "@/store/farmStore";
import {
  TUTORIAL_ORDER,
  getTutorialStep,
  tutorialProgress,
  type TutorialStep,
} from "@/lib/game/tutorial/tutorial-catalog";

export interface QuestDef {
  id: string;
  title: string;
  desc: string;
  reward: number;
  check: () => boolean;
  progress: () => { current: number; target: number };
}

const CROP_IDS = [
  "parsnip",
  "potato",
  "cauliflower",
  "tomato",
  "blueberry",
  "pumpkin",
  "carrot",
  "corn",
  "cabbage",
  "strawberry",
  "onion",
];

export const QUESTS: QuestDef[] = [
  {
    id: "q_first_harvest",
    title: "Vụ mùa đầu tiên",
    desc: "Thu hoạch củ cải hoặc nông sản xuân, rồi nói với Gaston.",
    reward: 80,
    check: () =>
      CROP_IDS.some((id) => useInventoryStore.getState().countItem(id) > 0) ||
      CROP_IDS.some((id) => useQuestStore.getState().shippedQty(id) > 0),
    progress: () => ({
      current: CROP_IDS.some(
        (id) =>
          useInventoryStore.getState().countItem(id) > 0 ||
          useQuestStore.getState().shippedQty(id) > 0,
      )
        ? 1
        : 0,
      target: 1,
    }),
  },
  {
    id: "q_meet_village",
    title: "Hàng xóm Tidecrest",
    desc: "Gặp Alaric thợ rèn và Gaston đầu bếp ở làng.",
    reward: 100,
    check: () => {
      const npc = useNpcStore.getState();
      return npc.isMet("alaric") && npc.isMet("gaston");
    },
    progress: () => {
      const npc = useNpcStore.getState();
      return {
        current: (npc.isMet("alaric") ? 1 : 0) + (npc.isMet("gaston") ? 1 : 0),
        target: 2,
      };
    },
  },
  {
    id: "q_collect_egg",
    title: "Đàn vật",
    desc: "Cho gà hoặc vịt ăn, sáng hôm sau lấy trứng.",
    reward: 90,
    check: () => useInventoryStore.getState().countItem("egg") >= 1,
    progress: () => ({
      current: Math.min(1, useInventoryStore.getState().countItem("egg")),
      target: 1,
    }),
  },
  {
    id: "q_ore_for_alaric",
    title: "Giếng tắc",
    desc: "Đập đá trong hang, nộp quặng đồng cho Alaric để sửa bơm.",
    reward: 150,
    check: () =>
      useWorldStore.getState().wellRepaired ||
      useInventoryStore.getState().countItem("copper_ore") >= 1,
    progress: () => ({
      current: useWorldStore.getState().wellRepaired
        ? 1
        : Math.min(1, useInventoryStore.getState().countItem("copper_ore")),
      target: 1,
    }),
  },
  {
    id: "q_festival_basket",
    title: "Giỏ Lễ Hội Thủy Triều",
    desc: "Ngày 7: nộp củ cải, trứng và sữa cho Gaston.",
    reward: 200,
    check: () => {
      const inv = useInventoryStore.getState();
      const day = useGameStore.getState().day;
      return (
        day >= 7 &&
        inv.countItem("parsnip") >= 1 &&
        inv.countItem("egg") >= 1 &&
        inv.countItem("milk") >= 1
      );
    },
    progress: () => {
      const inv = useInventoryStore.getState();
      const parts =
        (inv.countItem("parsnip") >= 1 ? 1 : 0) +
        (inv.countItem("egg") >= 1 ? 1 : 0) +
        (inv.countItem("milk") >= 1 ? 1 : 0);
      return { current: parts, target: 3 };
    },
  },
];

interface QuestState {
  completed: Record<string, boolean>;
  shipped: Record<string, number>;
  shippedGold: number;
  daysPlayed: number;
  /** W9: tuyến tính tutorial — step hiện tại (0-based index vào TUTORIAL_ORDER).
   *  14 = đã hoàn thành toàn bộ. KHÔNG nhảy skip — chỉ claim theo thứ tự. */
  tutorialStep: number;
  /** W9: các step đã claim (subset TUTORIAL_ORDER, đúng thứ tự). */
  tutorialClaimed: string[];
  trackShipped: (itemId: string, qty: number, gold: number) => void;
  shippedQty: (itemId: string) => number;
  claim: (questId: string) => boolean;
  /** Đánh dấu key arbitrary hoàn thành (festival claim key) — không chạy QUESTS logic. */
  markCompleted: (questId: string) => boolean;
  isCompleted: (questId: string) => boolean;
  /** W9: step đang active (đúng TUTORIAL_ORDER[step]) hoặc null nếu xong hết. */
  tutorialActive: () => string | null;
  /** W9: claim step HIỆN TẠI — check probe pass + chưa claimed → thưởng + tiến step. */
  claimTutorial: () => boolean;
  /** W9: progress [current, target] của step hiện tại (từ probe live). */
  tutorialProgressOf: () => [number, number];
  newDay: () => void;
  reset: () => void;
  hydrate: (data: Partial<QuestState>) => void;
}

export const useQuestStore = create<QuestState>((set, get) => ({
  completed: {},
  shipped: {},
  shippedGold: 0,
  daysPlayed: 1,
  tutorialStep: 0,
  tutorialClaimed: [],

  trackShipped: (itemId, qty, gold) =>
    set((s) => ({
      shipped: { ...s.shipped, [itemId]: (s.shipped[itemId] ?? 0) + qty },
      shippedGold: s.shippedGold + gold,
    })),

  shippedQty: (itemId) => get().shipped[itemId] ?? 0,

  claim: (questId) => {
    const s = get();
    if (s.completed[questId]) return false;
    const def = QUESTS.find((q) => q.id === questId);
    if (!def) return false;
    if (!def.check()) return false;
    useGameStore.getState().addGold(def.reward);
    set({ completed: { ...s.completed, [questId]: true } });
    useUiStore.getState().notify(`Nhiệm vụ hoàn thành: ${def.title}! +${def.reward}g`, "success");
    playSfx("levelup");
    const xp = Math.round(XP_REWARDS.quest * questXpMultiplier());
    useProgressionStore.getState().addXp(xp);
    return true;
  },

  markCompleted: (questId) => {
    const s = get();
    if (s.completed[questId]) return false;
    set({ completed: { ...s.completed, [questId]: true } });
    return true;
  },

  isCompleted: (questId) => !!get().completed[questId],

  tutorialActive: () => {
    const s = get();
    return s.tutorialStep >= 0 && s.tutorialStep < TUTORIAL_ORDER.length
      ? TUTORIAL_ORDER[s.tutorialStep]
      : null;
  },

  claimTutorial: () => {
    const s = get();
    const id = s.tutorialActive();
    if (!id) return false; // đã hết chuỗi
    if (s.tutorialClaimed.includes(id)) return false;
    const step = getTutorialStep(id);
    if (!step) return false;
    const probe = useTutorialStore.getState().probe();
    if (!step.check(probe)) return false;
    // Atomic: ghi claim TRƯỚC khi award — tránh double-claim runaway (festival
    // key pattern). set() 1 lần duy nhất cho step + reward cùng lúc.
    set({
      tutorialStep: s.tutorialStep + 1,
      tutorialClaimed: [...s.tutorialClaimed, id],
    });
    const game = useGameStore.getState();
    const inv = useInventoryStore.getState();
    const farm = useFarmStore.getState();
    const ui = useUiStore.getState();
    if (step.reward.gold) game.addGold(step.reward.gold);
    if (step.reward.decorId) farm.ownDecor(step.reward.decorId);
    // Review N5: leftover khi túi đầy → trả về silo (pattern giveItem) thay vì
    // drop im lặng — reward item không biến mất vô trace.
    const overflow: { id: string; qty: number }[] = [];
    if (step.reward.item) {
      const left = inv.addItem(step.reward.item.id, step.reward.item.qty);
      if (left > 0) overflow.push({ id: step.reward.item.id, qty: left });
    }
    for (const extra of step.reward.items ?? []) {
      const left = inv.addItem(extra.id, extra.qty);
      if (left > 0) overflow.push({ id: extra.id, qty: left });
    }
    for (const o of overflow) {
      // Silo full nữa → notify mất (edge hiếm; không loop vô hạn).
      if (!farm.addToSilo(o.id, o.qty)) {
        ui.notify(`Túi + kho đầy — mất ${o.qty} ${o.id}`, "warn");
      }
    }
    if (step.reward.xp) useProgressionStore.getState().addXp(step.reward.xp);
    ui.notify(`Mẹo mới: ${step.title}! +${step.reward.gold}g`, "success");
    playSfx("levelup");
    return true;
  },

  tutorialProgressOf: (): [number, number] => {
    const s = get();
    const id = s.tutorialActive();
    if (!id) return [0, 0];
    const probe = useTutorialStore.getState().probe();
    const [c, t] = tutorialProgress(id, probe);
    // Step đã check pass nhưng CHƯA claim (do chưa tương tác với HUD) → hiển thị
    // current = target (pin "claim sẵn sàng"), không để số nhảy lùi.
    return getTutorialStep(id)?.check(probe) ? [t, t] : [c, t];
  },

  newDay: () => set((s) => ({ daysPlayed: s.daysPlayed + 1 })),

  reset: () =>
    set({
      completed: {},
      shipped: {},
      shippedGold: 0,
      daysPlayed: 1,
      tutorialStep: 0,
      tutorialClaimed: [],
    }),

  hydrate: (data) => {
    const sanitizeRecord = (raw: unknown): Record<string, number> => {
      if (typeof raw !== "object" || !raw || Array.isArray(raw)) return {};
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = Math.floor(v);
      }
      return out;
    };
    const sanitizeBoolMap = (raw: unknown): Record<string, boolean> => {
      if (typeof raw !== "object" || !raw || Array.isArray(raw)) return {};
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        out[k] = v === true;
      }
      return out;
    };
    const sanitizeClaimed = (raw: unknown): string[] => {
      if (!Array.isArray(raw)) return [];
      const valid = new Set(TUTORIAL_ORDER);
      // Giữ THỨ TỰ xuất hiện trong TUTORIAL_ORDER (dedupe + lọc id lạ).
      return TUTORIAL_ORDER.filter((id) => (raw as unknown[]).includes(id));
    };
    const claimed = sanitizeClaimed(data.tutorialClaimed);
    set((s) => ({
      ...s,
      completed: sanitizeBoolMap(data.completed),
      shipped: sanitizeRecord(data.shipped),
      shippedGold:
        typeof data.shippedGold === "number" && Number.isFinite(data.shippedGold)
          ? data.shippedGold
          : s.shippedGold,
      daysPlayed:
        typeof data.daysPlayed === "number" && data.daysPlayed > 0
          ? Math.floor(data.daysPlayed)
          : s.daysPlayed,
      // W9: tutorialStep = số bước đã claim (không nhảy skip khi step raw = 99).
      tutorialStep: claimed.length,
      tutorialClaimed: claimed,
    }));
  },
}));

export { CROP_IDS, getItem };
