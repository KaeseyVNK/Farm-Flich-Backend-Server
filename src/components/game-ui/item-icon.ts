// Shared item → semantic GameIcon category mapping. Replaces emoji as the interactive
// identity in Hotbar/Inventory/panels. Per-item approved art lands in icon-manifest
// (resolveIcon) once sheets are approved; until then every item resolves to its category
// GameIcon (documented fallback — icon-manifest placeholder rule). Labels, quantities and
// prices stay native DOM text. Contract: visual-design-specification §GameIcon.
import type { ItemDef } from "@/lib/game/data";
import type { GameIconId } from "./game-icon-id";

/** Item type → semantic category icon (replaces emoji as slot identity). */
export function itemIconId(def: ItemDef): GameIconId {
  switch (def.type) {
    case "tool":
      return "category-tool";
    case "seed":
      return "category-seed";
    case "resource":
      return "category-resource";
    default:
      return "category-food"; // crop / forage / food
  }
}