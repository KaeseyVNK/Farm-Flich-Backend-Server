"use client";

// GameIcon — resolves a finite semantic GameIconId to approved art or a documented fallback.
// An interactive feature/item/alert must not use an OS emoji as identity after migration.
//
// Migration state (Phase 2): no dedicated feature icon SHEETS are in the asset manifest yet,
// so feature/status/brand ids render a Lucide fallback (documented, accessible). category-*
// ids defer to the typed icon-manifest placeholder. When an approved art key is added for an
// id, the RESOLVERS map below switches that id to <img> art — the GameIconId contract stays
// stable. A temporary text/glyph fallback is always preferred over a fake icon. Contract:
// visual-design-specification §GameIcon + implementation-handoff-contract §Asset contract.
import type { ComponentType, SVGProps } from "react";
import {
  Backpack, Sprout, Hammer, Map as MapIcon, HeartHandshake, CalendarDays,
  Star, ShoppingBag, HelpCircle, Settings, Wheat, Zap, Coins, Clock, Sun,
  Wrench, VenetianMask, LayoutGrid, Fish, Bug, Sword, Package, Lamp, Users,
  type LucideProps,
} from "lucide-react";
import type { GameIconId } from "./game-icon-id";

/** Documented fallback map: GameIconId → Lucide component (until approved art exists). */
const LUCIDE_FALLBACK: Partial<Record<GameIconId, ComponentType<LucideProps>>> = {
  "feature-inventory": Backpack,
  "feature-seeds": Sprout,
  "feature-crafting": Hammer,
  "feature-map": MapIcon,
  "feature-relationships": HeartHandshake,
  "feature-calendar": CalendarDays,
  "feature-skills": Star,
  "feature-shop": ShoppingBag,
  "feature-help": HelpCircle,
  "feature-settings": Settings,
  "feature-raid": VenetianMask, // mask / heist entry — mystic accent applied by caller
  "feature-decor": Lamp, // placement / decoration mode
  "feature-visitors": Users, // farm guests / social log
  "brand-farm": Wheat,
  "nav-more": LayoutGrid, // mobile "More" overflow — distinct from feature-help
  "status-energy": Zap,
  "status-gold": Coins,
  "status-clock": Clock,
  "status-day": Sun,
  "status-tool": Wrench,
  "category-tool": Wrench,
  "category-seed": Sprout,
  "category-food": Wheat,
  "category-resource": Package,
  "category-fish": Fish,
  "category-bug": Bug,
  "category-weapon": Sword,
};

export interface GameIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  /** Stable semantic icon id. */
  id: GameIconId;
  /** Accessible name. Required unless `decorative`. */
  label?: string;
  /** If true, the icon is hidden from AT (a nearby visible label carries meaning). */
  decorative?: boolean;
  size?: number;
  className?: string;
}

export function GameIcon({
  id,
  label,
  decorative = false,
  size = 24,
  className,
  ...svg
}: GameIconProps) {
  if (!decorative && !label) {
    // Contract: non-decorative icon needs an accessible name. Fail loud in dev, not silent.
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[GameIcon] non-decorative icon "${id}" missing accessible label`);
    }
  }

  const Fallback = LUCIDE_FALLBACK[id];

  // category-* ids have no Lucide fallback — render a documented text glyph placeholder.
  if (!Fallback) {
    const glyph = id.split("-")[1]?.[0]?.toUpperCase() ?? "?";
    return (
      <span
        role="img"
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative || undefined}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: size * 0.6,
          lineHeight: 1,
          color: "var(--mf-ink)",
        }}
        data-mf-icon={id}
        data-mf-icon-status="placeholder"
      >
        {glyph}
      </span>
    );
  }

  return (
    <Fallback
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      className={className}
      strokeWidth={2.2}
      data-mf-icon={id}
      data-mf-icon-status="fallback-lucide"
      {...svg}
    />
  );
}
