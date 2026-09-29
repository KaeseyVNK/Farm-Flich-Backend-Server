import { CROP_IDS, QUESTS, type QuestDef } from "@/store/questStore";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useQuestStore } from "@/store/questStore";
import { useWorldStore } from "@/store/worldStore";
import { T, MAP_COLS } from "@/lib/game/constants";
import { CROPS } from "@/lib/game/data";
import { FARM_PLOTS } from "@/lib/game/farm-scenery-layout";
import type { CropState } from "@/store/farmStore";

/** Story order for the 7-day Tide Festival week. HUD + NPC lines follow this, not calendar dump order. */
export const WEEK_QUEST_ORDER = [
  "q_first_harvest",
  "q_meet_village",
  "q_collect_egg",
  "q_ore_for_alaric",
  "q_festival_basket",
] as const;

export type WeekQuestId = (typeof WEEK_QUEST_ORDER)[number];

export function activeWeekQuest(completed: Record<string, boolean>): QuestDef | null {
  for (const id of WEEK_QUEST_ORDER) {
    if (!completed[id]) {
      return QUESTS.find((q) => q.id === id) ?? null;
    }
  }
  return null;
}

// ── Phase 3 hayday: HUD pin = farm goal (không Tide Festival) ────────────────
export type FarmGoalId =
  | "hoe"
  | "plant"
  | "water"
  | "harvest"
  | "sell"
  | "unlock2"
  | "unlock3"
  | "unlock4";

/**
 * Pure — HUD truyền state vào, không đọc store/Phaser. Thứ tự ưu tiên:
 * hoe → plant → water → harvest → sell → unlock theo level.
 */
export function activeFarmGoal(input: {
  terrain: number[];
  crops: Record<number, CropState>;
  /** Tổng số crop item trong túi (parsnip/potato/…). */
  invCropTotal: number;
  level: number;
}): FarmGoalId {
  const { terrain, crops, invCropTotal, level } = input;
  const unlocked = new Set<number>();
  for (const p of FARM_PLOTS) {
    if (p.unlockLevel <= level) unlocked.add(p.ty * MAP_COLS + p.tx);
  }
  for (const i of unlocked) {
    if (terrain[i] === T.FALLOW && !crops[i]) return "hoe";
  }
  for (const i of unlocked) {
    if ((terrain[i] === T.TILLED || terrain[i] === T.TILLED_WET) && !crops[i]) return "plant";
  }
  for (const c of Object.values(crops)) {
    if (!c.dead && !c.watered) return "water";
  }
  for (const c of Object.values(crops)) {
    if (!c.dead && c.stage >= (CROPS[c.cropId]?.stages ?? Infinity) - 1) return "harvest";
  }
  if (invCropTotal > 0) return "sell";
  if (level === 1) return "unlock2";
  if (level === 2) return "unlock3";
  return "unlock4";
}

export function dialogueLineIndex(npcId: string): number {
  const completed = useQuestStore.getState().completed;
  const wellRepaired = useWorldStore.getState().wellRepaired;
  const day = useGameStore.getState().day;
  const done = (id: WeekQuestId) => !!completed[id];
  const hasCrop = CROP_IDS.some((id) => useInventoryStore.getState().countItem(id) > 0);

  if (npcId === "alaric") {
    if (wellRepaired || done("q_ore_for_alaric")) return day >= 7 ? 3 : 2;
    return 0;
  }
  if (npcId === "gaston") {
    if (done("q_festival_basket")) return 0;
    if (!done("q_first_harvest")) return hasCrop ? 1 : 3;
    if (!done("q_collect_egg")) return 2;
    if (day >= 7) return 0;
    return 1;
  }
  if (npcId === "elyria") return 2;
  if (npcId === "jack") return ((day - 1) % 4 + 4) % 4;
  return 0;
}
