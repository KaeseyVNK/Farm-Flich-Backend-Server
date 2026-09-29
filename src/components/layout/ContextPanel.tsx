"use client";

import dynamic from "next/dynamic";
import { useUiStore } from "@/store/uiStore";
import { X } from "lucide-react";
import { Suspense, useEffect, useRef } from "react";
import { FEATURE_LABELS } from "@/lib/game/feature-labels";

// Panel titles come from the ONE feature label source (no duplicate TITLES map).
function panelTitle(id: string): string {
  return FEATURE_LABELS[id as keyof typeof FEATURE_LABELS]?.label ?? "Panel";
}

// Lazy-load each panel so only the active one is in the initial bundle.
// Each becomes a separate chunk fetched on first open.
const InventoryPanel = dynamic(
  () => import("@/components/panels/InventoryPanel").then((m) => m.InventoryPanel),
  { ssr: false },
);
const FestivalPanel = dynamic(
  () => import("@/components/panels/FestivalPanel").then((m) => m.FestivalPanel),
  { ssr: false },
);
const BountyBoardPanel = dynamic(
  () => import("@/components/panels/BountyBoardPanel").then((m) => m.BountyBoardPanel),
  { ssr: false },
);
const BlackMarketPanel = dynamic(
  () => import("@/components/panels/BlackMarketPanel").then((m) => m.BlackMarketPanel),
  { ssr: false },
);
const SeedsPanel = dynamic(
  () => import("@/components/panels/SeedsPanel").then((m) => m.SeedsPanel),
  { ssr: false },
);
const CraftingPanel = dynamic(
  () => import("@/components/panels/CraftingPanel").then((m) => m.CraftingPanel),
  { ssr: false },
);
const DecorPanel = dynamic(
  () => import("@/components/panels/DecorPanel").then((m) => m.DecorPanel),
  { ssr: false },
);
const MapPanel = dynamic(
  () => import("@/components/panels/MapPanel").then((m) => m.MapPanel),
  { ssr: false },
);
const RelationshipsPanel = dynamic(
  () => import("@/components/panels/RelationshipsPanel").then((m) => m.RelationshipsPanel),
  { ssr: false },
);
const VisitorsPanel = dynamic(
  () => import("@/components/panels/VisitorsPanel").then((m) => m.VisitorsPanel),
  { ssr: false },
);
const CalendarPanel = dynamic(
  () => import("@/components/panels/CalendarPanel").then((m) => m.CalendarPanel),
  { ssr: false },
);
const HelpPanel = dynamic(
  () => import("@/components/panels/HelpPanel").then((m) => m.HelpPanel),
  { ssr: false },
);
const SettingsPanel = dynamic(
  () => import("@/components/panels/SettingsPanel").then((m) => m.SettingsPanel),
  { ssr: false },
);
const SkillTreePanel = dynamic(
  () => import("@/components/panels/SkillTreePanel").then((m) => m.SkillTreePanel),
  { ssr: false },
);

function PanelFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--mf-muted-ink)] border-t-[var(--mf-leaf)] motion-reduce:animate-none" />
    </div>
  );
}

export function ContextPanel() {
  const activePanel = useUiStore((s) => s.activePanel);
  const closePanel = useUiStore((s) => s.closePanel);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus trap + initial focus (audit UX #6): khi mở panel, focus vào nút close;
  // trap Tab trong section; khi đóng trả focus về nút trigger (FeatureBar/MobileTabBar).
  useEffect(() => {
    if (!activePanel) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [activePanel]);

  if (!activePanel) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[var(--z-panel)] flex justify-start">
      {/* Backdrop dim (click to close). No backdrop-blur — crisp pixel rule. */}
      <button
        className="animate-fade-in pointer-events-auto absolute inset-0 bg-black/35"
        onClick={closePanel}
        aria-label="Đóng bảng"
        tabIndex={-1}
      />
      <section
        ref={panelRef}
        className="animate-slide-in-left pointer-events-auto relative m-2 flex h-[calc(100%-1rem)] w-full max-w-md flex-col overflow-hidden rounded-[4px] parchment"
        role="dialog"
        aria-modal="true"
        aria-label={panelTitle(activePanel)}
      >
        {/* Header */}
        <div className="wood-panel-flat flex items-center justify-between px-4 py-2.5">
          <h2 className="font-pixel-tight text-sm font-extrabold tracking-tight text-[var(--mf-paper-raised)] drop-shadow hud-text">
            {panelTitle(activePanel)}
          </h2>
          <button
            ref={closeRef}
            onClick={closePanel}
            className="lift-on-hover flex h-8 w-8 items-center justify-center rounded-[4px] border-2 border-[var(--mf-frame)] bg-[var(--mf-paper-raised)] text-[var(--mf-muted-ink)] transition hover:bg-[var(--mf-paper)] hover:text-[var(--mf-ink)]"
            aria-label="Đóng bảng"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        {/* Body */}
        <div className="fancy-scroll flex-1 overflow-y-auto p-4">
          <Suspense fallback={<PanelFallback />}>
            {activePanel === "inventory" && <InventoryPanel />}
            {activePanel === "seeds" && <SeedsPanel />}
            {activePanel === "crafting" && <CraftingPanel />}
            {activePanel === "decor" && <DecorPanel />}
            {activePanel === "map" && <MapPanel />}
            {activePanel === "relationships" && <RelationshipsPanel />}
            {activePanel === "visitors" && <VisitorsPanel />}
            {activePanel === "calendar" && <CalendarPanel />}
            {activePanel === "help" && <HelpPanel />}
            {activePanel === "settings" && <SettingsPanel />}
            {activePanel === "skills" && <SkillTreePanel />}
            {activePanel === "blackmarket" && <BlackMarketPanel />}
            {activePanel === "bounty" && <BountyBoardPanel />}
            {activePanel === "festival" && <FestivalPanel />}
          </Suspense>
        </div>
      </section>
    </div>
  );
}
