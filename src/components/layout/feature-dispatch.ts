"use client";

// Feature dispatcher + active-state hook. The ONE place that translates a registry
// FeatureTarget into the existing store actions (togglePanel / setShowShop / raid setPhase).
// The registry itself stays data-only; this hook owns the side effects so desktop + mobile
// renderers never diverge. Contract: implementation-handoff-contract §Feature registry.
import { useCallback } from "react";
import { useUiStore } from "@/store/uiStore";
import { useRaidStore } from "@/store/raidStore";
import type { FeatureDefinition, FeatureTarget } from "@/lib/game/feature-registry";

/** Activate a feature via its registry target. Idempotent open semantics. */
export function useFeatureDispatch() {
  const togglePanel = useUiStore((s) => s.togglePanel);
  const setShowShop = useUiStore((s) => s.setShowShop);
  const setRaidPhase = useRaidStore((s) => s.setPhase);

  return useCallback(
    (target: FeatureTarget) => {
      switch (target.kind) {
        case "panel":
          togglePanel(target.panel);
          break;
        case "shop":
          setShowShop(true);
          break;
        case "raid":
          setRaidPhase("lobby");
          break;
      }
    },
    [togglePanel, setShowShop, setRaidPhase],
  );
}

/** Convenience: resolve a feature's active state without a hook (for render loops). */
export function isFeatureActive(
  def: FeatureDefinition,
  ctx: { activePanel: string | null; showShop: boolean; raidPhase: string },
): boolean {
  if (def.target.kind === "shop") return ctx.showShop;
  if (def.target.kind === "raid") return ctx.raidPhase !== "idle";
  return ctx.activePanel === def.id;
}
