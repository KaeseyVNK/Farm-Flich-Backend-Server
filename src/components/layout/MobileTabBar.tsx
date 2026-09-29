"use client";

// MobileTabBar — bottom navigation (<768px). Replaces the old 10-tab horizontal scroll with
// the contract layout: exactly 4 fixed primary buttons (Bag / Plant / Map / More) + a "More"
// action sheet holding raid + craft + relationships + calendar + skills + shop + help +
// settings. These are navigation BUTTONS, not role="tablist" (the app does not implement
// full ARIA tab semantics). Driven by the ONE feature registry; identity via <GameIcon>.
// Contract: implementation-handoff-contract §Feature registry + visual-design-spec §mobile.
import { useEffect, useState } from "react";
import { useUiStore } from "@/store/uiStore";
import { useRaidStore } from "@/store/raidStore";
import { GameIcon } from "@/components/game-ui/game-icon";
import {
  mobilePrimaryFeatures, mobileMoreFeatures, type FeatureDefinition,
} from "@/lib/game/feature-registry";
import { FEATURE_LABELS } from "@/lib/game/feature-labels";
import { useFeatureDispatch, isFeatureActive } from "./feature-dispatch";

export function MobileTabBar() {
  const activePanel = useUiStore((s) => s.activePanel);
  const showShop = useUiStore((s) => s.showShop);
  const raidPhase = useRaidStore((s) => s.phase);
  const dispatch = useFeatureDispatch();
  const ctx = { activePanel, showShop, raidPhase };

  const [moreOpen, setMoreOpen] = useState(false);
  const primary = mobilePrimaryFeatures(); // inventory, seeds, map
  const more = mobileMoreFeatures(); // raid + craft + relationships + calendar + skills + shop + help + settings

  // Local Escape for the transient More sheet (it is nav UI, not a policy gameplay surface).
  useEffect(() => {
    if (!moreOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [moreOpen]);

  function NavButton({
    def, onClick,
  }: { def: FeatureDefinition; onClick: () => void }) {
    const lbl = FEATURE_LABELS[def.id];
    const active = isFeatureActive(def, ctx);
    return (
      <button
        onClick={onClick}
        aria-label={lbl.short}
        aria-pressed={active}
        className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[4px] border-2 py-1 transition ${
          active
            ? "border-[var(--mf-harvest)] bg-[var(--mf-paper-raised)] text-[var(--mf-ink)]"
            : "border-transparent bg-transparent text-[var(--mf-paper-raised)]"
        }`}
      >
        <GameIcon id={def.icon} label={lbl.short} size={22} />
        <span className="text-[10px] font-bold leading-none">{lbl.short}</span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[var(--z-hud)] md:hidden"
         style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <nav
        data-testid="mobile-tab-bar"
        className="flex items-stretch gap-1 border-t-2 border-[var(--mf-frame)] bg-[var(--mf-wood)] px-1 py-1.5"
        aria-label="Game features"
      >
        {primary.map((f) => (
          <NavButton key={f.id} def={f} onClick={() => dispatch(f.target)} />
        ))}
        {/* More — opens the action sheet (NOT a tab). */}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[4px] border-2 py-1 transition ${
            moreOpen
              ? "border-[var(--mf-harvest)] bg-[var(--mf-paper-raised)] text-[var(--mf-ink)]"
              : "border-transparent bg-transparent text-[var(--mf-paper-raised)]"
          }`}
        >
          <GameIcon id="nav-more" label="More" size={22} />
          <span className="text-[10px] font-bold leading-none">More</span>
        </button>
      </nav>

      {moreOpen ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/50"
          onClick={() => setMoreOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label="More"
            aria-modal="true"
            className="animate-slide-in-up w-full border-t-2 border-[var(--mf-frame)] bg-[var(--mf-paper)] p-2 pb-[calc(env(safe-area-inset-bottom)+8px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 px-1 font-pixel text-[10px] text-[var(--mf-muted-ink)]">More</p>
            <div className="grid grid-cols-4 gap-1">
              {more.map((f) => {
                const lbl = FEATURE_LABELS[f.id];
                const active = isFeatureActive(f, ctx);
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      dispatch(f.target);
                      setMoreOpen(false);
                    }}
                    aria-label={lbl.label}
                    className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[4px] border-2 px-1 py-2 transition ${
                      active
                        ? "border-[var(--mf-harvest)] bg-[var(--mf-paper-raised)] text-[var(--mf-ink)]"
                        : "border-[var(--mf-frame)] bg-[var(--mf-paper-raised)] text-[var(--mf-ink)] hover:bg-[var(--mf-paper)]"
                    }`}
                  >
                    <GameIcon id={f.icon} label={lbl.label} size={24} />
                    <span className="text-[10px] font-bold leading-none">{lbl.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
