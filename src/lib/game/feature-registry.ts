// Feature registry — ONE data source for desktop rail, mobile navigation, keyboard hints
// and raid entry. Replaces the drifting FEATURES / SECONDARY / shop-button / raid-button
// literals in FeatureBar.tsx and MobileTabBar.tsx. Data only: no React component, no Zustand
// import, no DOM listener, no JSX. The component-level dispatcher translates FeatureTarget
// to the existing actions (togglePanel / setShowShop / raid setPhase).
//
// Contract: implementation-handoff-contract.md §Feature registry contract.

import type { PanelId } from "@/store/uiStore";
import type { GameIconId } from "@/components/game-ui/game-icon-id";

/** Panel ids that are real ContextPanel bodies (shop is a separate modal target). */
export type RealPanelId = Exclude<NonNullable<PanelId>, "shop">;
export type FeatureId = RealPanelId | "shop" | "raid";

/** What a feature dispatches. shop is a target variant, not a panel body. */
export type FeatureTarget =
  | { kind: "panel"; panel: RealPanelId }
  | { kind: "shop" }
  | { kind: "raid" };

export interface FeatureDefinition {
  id: FeatureId;
  /** i18n key for the visible label (resolved by the renderer). */
  labelKey: string;
  /** i18n key for the hint/tooltip. */
  descriptionKey: string;
  icon: GameIconId;
  target: FeatureTarget;
  desktopGroup: "daily" | "making" | "explore" | "progress" | "utility" | "mode";
  /** Mobile: fixed primary bar (Bag/Plant/Map/More) or inside the More sheet. */
  mobilePlacement: "primary" | "more";
  /**
   * Display/current actual shortcut. Skills intentionally has NONE: `S` is farm MoveDown and
   * must never be reused. An optional Skills desktop shortcut must be an unused, documented key.
   */
  shortcut?: string;
}

/**
 * The single feature source. Desktop groups + mobile placement follow the handoff contract
 * registry table. Order within a group is the display order.
 */
export const FEATURES: readonly FeatureDefinition[] = [
  // raid hidden from cozy-farm demo (raid-server kept)
  // --- daily ---
  {
    id: "inventory",
    labelKey: "feature.inventory.label",
    descriptionKey: "feature.inventory.hint",
    icon: "feature-inventory",
    target: { kind: "panel", panel: "inventory" },
    desktopGroup: "daily",
    mobilePlacement: "primary",
    shortcut: "I",
  },
  {
    id: "seeds",
    labelKey: "feature.seeds.label",
    descriptionKey: "feature.seeds.hint",
    icon: "feature-seeds",
    target: { kind: "panel", panel: "seeds" },
    desktopGroup: "daily",
    mobilePlacement: "primary",
    shortcut: "P",
  },
  // --- making ---
  {
    id: "crafting",
    labelKey: "feature.crafting.label",
    descriptionKey: "feature.crafting.hint",
    icon: "feature-crafting",
    target: { kind: "panel", panel: "crafting" },
    desktopGroup: "making",
    mobilePlacement: "more",
    shortcut: "C",
  },
  {
    id: "decor",
    labelKey: "feature.decor.label",
    descriptionKey: "feature.decor.hint",
    icon: "feature-decor",
    target: { kind: "panel", panel: "decor" },
    desktopGroup: "making",
    mobilePlacement: "more",
    // no shortcut — placement keys (R/F/X/Space) belong to decor mode itself
  },
  // --- explore ---
  {
    id: "map",
    labelKey: "feature.map.label",
    descriptionKey: "feature.map.hint",
    icon: "feature-map",
    target: { kind: "panel", panel: "map" },
    desktopGroup: "explore",
    mobilePlacement: "primary",
    shortcut: "M",
  },
  // --- progress ---
  {
    id: "relationships",
    labelKey: "feature.relationships.label",
    descriptionKey: "feature.relationships.hint",
    icon: "feature-relationships",
    target: { kind: "panel", panel: "relationships" },
    desktopGroup: "progress",
    mobilePlacement: "more",
    shortcut: "R",
  },
  {
    id: "visitors",
    labelKey: "feature.visitors.label",
    descriptionKey: "feature.visitors.hint",
    icon: "feature-visitors",
    target: { kind: "panel", panel: "visitors" },
    desktopGroup: "progress",
    mobilePlacement: "more",
    // no shortcut — V không dùng (vi phạm chuẩn phím di chuyển? không, V trống; giữ pointer access)
  },
  {
    id: "calendar",
    labelKey: "feature.calendar.label",
    descriptionKey: "feature.calendar.hint",
    icon: "feature-calendar",
    target: { kind: "panel", panel: "calendar" },
    desktopGroup: "progress",
    mobilePlacement: "more",
    shortcut: "L",
  },
  {
    id: "skills",
    labelKey: "feature.skills.label",
    descriptionKey: "feature.skills.hint",
    icon: "feature-skills",
    target: { kind: "panel", panel: "skills" },
    desktopGroup: "progress",
    mobilePlacement: "more",
    // INTENTIONAL: no shortcut. `S` is farm MoveDown and must not open Skills.
  },
  // --- utility ---
  {
    id: "shop",
    labelKey: "feature.shop.label",
    descriptionKey: "feature.shop.hint",
    icon: "feature-shop",
    target: { kind: "shop" },
    desktopGroup: "utility",
    mobilePlacement: "more",
    shortcut: "G",
  },
  {
    id: "help",
    labelKey: "feature.help.label",
    descriptionKey: "feature.help.hint",
    icon: "feature-help",
    target: { kind: "panel", panel: "help" },
    desktopGroup: "utility",
    mobilePlacement: "more",
    shortcut: "H",
  },
  {
    id: "settings",
    labelKey: "feature.settings.label",
    descriptionKey: "feature.settings.hint",
    icon: "feature-settings",
    target: { kind: "panel", panel: "settings" },
    desktopGroup: "utility",
    mobilePlacement: "more",
    // no shortcut — settings is pointer/More accessible
  },
];

/** Look up a feature by id. */
export function getFeature(id: FeatureId): FeatureDefinition | undefined {
  return FEATURES.find((f) => f.id === id);
}

/** Features in a given desktop group, in display order. */
export function featuresByGroup(group: FeatureDefinition["desktopGroup"]): FeatureDefinition[] {
  return FEATURES.filter((f) => f.desktopGroup === group);
}

/** The fixed mobile primary bar (exact 4). */
export function mobilePrimaryFeatures(): FeatureDefinition[] {
  return FEATURES.filter((f) => f.mobilePlacement === "primary");
}

/** The mobile "More" sheet contents (everything not primary). */
export function mobileMoreFeatures(): FeatureDefinition[] {
  return FEATURES.filter((f) => f.mobilePlacement === "more");
}
