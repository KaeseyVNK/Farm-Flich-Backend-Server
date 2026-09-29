import { useFarmStore } from "@/store/farmStore";
import { useInventoryStore, type InvSlot } from "@/store/inventoryStore";
import { useGameStore } from "@/store/gameStore";
import { useQuestStore } from "@/store/questStore";
import { useTutorialStore } from "@/store/tutorialStore";
import { useProgressionStore } from "@/store/progressionStore";
import { useNpcStore } from "@/store/npcStore";
import { useRaidStore } from "@/store/raidStore";
import { useWorldStore } from "@/store/worldStore";
import { useAnimalStore } from "@/store/animalStore";
import { DAY_START_HOUR } from "@/lib/game/constants";

// Fresh-farm reset seam (phase-04 §State transition constraints).
//
// ONE characterized baseline shared by Settings "Reset Current Farm", StartScreen "New Game+"
// and the E2E test bridge. It reproduces the EXACT store hydration order/values frozen by
// tests/unit/fresh-farm-reset-characterization.test.ts, so a UI or bridge refactor cannot
// drift the save contract. This is NOT a new public save format and never writes localStorage.
//
// `mode: "new"` (empty slot) resets farm + re-seeds starter inventory slot 0 (store makeInitial
// supplies tools/seeds on first boot); `mode: "reset"/"ngPlus"` additionally clear progress,
// story and NPC/friendship so a stale run never leaks into the fresh farm.

/** Re-seed the 6 starter tools (5 tool + rod W1P3) + parsnip seed vào túi 12 slot, slot 0 chọn. */
function seedStarterInventory(): void {
  const slots: (InvSlot | null)[] = Array(12).fill(null);
  slots[0] = { itemId: "hoe", qty: 1 };
  slots[1] = { itemId: "watering_can", qty: 1 };
  slots[2] = { itemId: "axe", qty: 1 };
  slots[3] = { itemId: "pickaxe", qty: 1 };
  slots[4] = { itemId: "scythe", qty: 1 };
  slots[5] = { itemId: "parsnip_seed", qty: 9 };
  slots[6] = { itemId: "fishing_rod", qty: 1 }; // Wave 1 P3
  useInventoryStore.getState().hydrate(slots, 0);
}

function resetFarmStores(): void {
  useFarmStore.getState().reset();
  seedStarterInventory();
  useGameStore.getState().hydrate({
    day: 1,
    season: "Spring",
    seasonIndex: 0,
    year: 1,
    timeMinutes: DAY_START_HOUR * 60,
    gold: 500,
    energy: useGameStore.getState().maxEnergy,
    collapsed: false,
    totalEarned: 0,
    toolsUsed: 0,
  });
  useQuestStore.getState().reset();
  useWorldStore.getState().reset();
  useWorldStore.getState().refillCan();
  useAnimalStore.getState().reset();
}

/**
 * Establish the exact fresh-farm baseline. Delegates to existing store hydration/reset
 * methods — no JSX, no localStorage modal state. `new` clears farm only (gate vs cloud
 * content); `reset`/`ngPlus` also clear progression/story/NPC/raid run state.
 */
export function initialiseFreshFarm(options: { mode: "new" | "reset" | "ngPlus" }): void {
  resetFarmStores();
  if (options.mode === "new") return;
  useProgressionStore.getState().reset();
  useNpcStore.getState().reset();
  useTutorialStore.getState().reset();
  useQuestStore.getState().reset(); // reset luôn tutorial step/claimed + completed
  useRaidStore.getState().reset?.();
}