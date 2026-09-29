import { useInventoryStore } from "@/store/inventoryStore";
import { useNpcStore } from "@/store/npcStore";
import { useQuestStore } from "@/store/questStore";
import { useUiStore } from "@/store/uiStore";
import { useWorldStore } from "@/store/worldStore";
import { useGameStore } from "@/store/gameStore";

/** Auto-claim a quest if its check already passes. */
export function tryAutoClaim(questId: string): boolean {
  return useQuestStore.getState().claim(questId);
}

/**
 * NPC-given turn-ins for the Tide Festival demo.
 * Called when the player talks to Alaric / Gaston / Elyria.
 */
export function resolveNpcQuests(npcId: string): void {
  const inv = useInventoryStore.getState();
  const npc = useNpcStore.getState();
  const world = useWorldStore.getState();
  const game = useGameStore.getState();

  if (npc.isMet("alaric") && npc.isMet("gaston")) {
    tryAutoClaim("q_meet_village");
  }

  if (npcId === "alaric" && inv.countItem("copper_ore") >= 1 && !world.wellRepaired) {
    tryAutoClaim("q_ore_for_alaric");
    inv.removeItem("copper_ore", 1);
    world.repairWell();
    useUiStore.getState().notify("Alaric sửa bơm giếng. Nước Tidecrest chảy lại!", "success");
  }

  if (npcId === "gaston") {
    tryAutoClaim("q_first_harvest");
    const hasBasket =
      inv.countItem("parsnip") >= 1 &&
      inv.countItem("egg") >= 1 &&
      inv.countItem("milk") >= 1;
    if (hasBasket && game.day >= 7) {
      tryAutoClaim("q_festival_basket");
      inv.removeItem("parsnip", 1);
      inv.removeItem("egg", 1);
      inv.removeItem("milk", 1);
      useUiStore.getState().notify("Gaston nhận giỏ lễ hội. Thủy Triều sẽ rộn ràng!", "success");
    }
  }
}
