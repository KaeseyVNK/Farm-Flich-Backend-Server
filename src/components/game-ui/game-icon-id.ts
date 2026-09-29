// GameIconId — finite semantic icon identifiers resolved by the <GameIcon/> primitive to
// approved art (manifest) or a documented fallback. Data-only (no React) so the feature
// registry and other data modules can reference it without pulling in component code.
//
// Add ids here ONLY when a real gameplay/UI identity needs them; an OS emoji must never be
// an interactive identity after migration. The <GameIcon/> component owns the id → art map.

export type GameIconId =
  // Feature / navigation
  | "feature-inventory"
  | "feature-seeds"
  | "feature-crafting"
  | "feature-map"
  | "feature-relationships"
  | "feature-calendar"
  | "feature-skills"
  | "feature-shop"
  | "feature-help"
  | "feature-settings"
  | "feature-raid" // mask / heist entry — mystic accent only
  | "feature-decor" // placement / decoration mode
  | "feature-visitors" // farm guests / social log
  | "brand-farm"
  | "nav-more" // mobile "More" overflow affordance (distinct from feature-help)
  // HUD / status (used by TopHUD chips)
  | "status-energy"
  | "status-gold"
  | "status-clock"
  | "status-day"
  | "status-tool"
  // Item categories (resolved via icon-manifest during Phase 4/5)
  | "category-food"
  | "category-fish"
  | "category-bug"
  | "category-tool"
  | "category-weapon"
  | "category-resource"
  | "category-seed";

const GAME_ICON_IDS: ReadonlySet<string> = new Set<GameIconId>([
  "feature-inventory", "feature-seeds", "feature-crafting", "feature-map",
  "feature-relationships", "feature-calendar", "feature-skills", "feature-shop",
  "feature-help", "feature-settings", "feature-raid", "feature-decor", "feature-visitors", "brand-farm", "nav-more",
  "status-energy", "status-gold", "status-clock", "status-day", "status-tool",
  "category-food", "category-fish", "category-bug", "category-tool",
  "category-weapon", "category-resource", "category-seed",
]);

/** True if id is a known semantic icon id. */
export function isGameIconId(id: string): id is GameIconId {
  return GAME_ICON_IDS.has(id);
}
