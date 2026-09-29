"use client";

// FeatureBar — Farm RPG top-left stack: Menu / Bag / Skills, then a disclosure dock
// for the remaining features. Driven by the ONE feature registry. Contract: visual-design-spec §Farm shell.
import { useState } from "react";
import { useUiStore } from "@/store/uiStore";
import { useRaidStore } from "@/store/raidStore";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { GameIcon } from "@/components/game-ui/game-icon";
import {
  featuresByGroup, getFeature, type FeatureDefinition,
} from "@/lib/game/feature-registry";
import { FEATURE_LABELS } from "@/lib/game/feature-labels";
import { useFeatureDispatch, isFeatureActive } from "./feature-dispatch";

const PINNED_IDS = new Set(["inventory", "skills"]);

function FeatureButton({
  def,
  active,
  onClick,
  variant = "default",
  showShortcut = true,
}: {
  def: FeatureDefinition;
  active: boolean;
  onClick: () => void;
  variant?: "default" | "raid";
  showShortcut?: boolean;
}) {
  const lbl = FEATURE_LABELS[def.id];
  const raid = variant === "raid";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={`rpg-wood-btn ${raid ? "rpg-wood-btn-raid" : ""} ${active ? "rpg-wood-btn-on" : ""}`}
          aria-label={lbl.label}
          aria-pressed={active}
        >
          <GameIcon id={def.icon} label={lbl.label} size={28} />
          {showShortcut && def.shortcut ? (
            <span className="kbd absolute -right-1.5 -top-1.5 scale-90 opacity-90" aria-hidden>
              {def.shortcut}
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={6} className="tip-card !p-0 !rounded-[4px]">
        <div className="px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold text-[var(--mf-ink)]">{lbl.label}</span>
            {def.shortcut ? <span className="kbd ml-auto">{def.shortcut}</span> : null}
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--mf-muted-ink)]">{lbl.hint}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function FeatureBar() {
  const [expanded, setExpanded] = useState(false);
  const activePanel = useUiStore((s) => s.activePanel);
  const showShop = useUiStore((s) => s.showShop);
  const raidPhase = useRaidStore((s) => s.phase);
  const dispatch = useFeatureDispatch();
  const ctx = { activePanel, showShop, raidPhase };

  const inventory = getFeature("inventory");
  const skills = getFeature("skills");
  const modeFeatures = featuresByGroup("mode");
  const dockFeatures = (["daily", "making", "explore", "progress", "utility"] as const)
    .flatMap((g) => featuresByGroup(g))
    .filter((f) => !PINNED_IDS.has(f.id));

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Game features"
        className={`feature-dock hidden md:flex ${expanded ? "feature-dock-open" : "feature-dock-closed"}`}
      >
        <div className="feature-stack">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="rpg-wood-btn"
                aria-label={expanded ? "Đóng menu nông trại" : "Mở menu nông trại"}
                aria-expanded={expanded}
              >
                <span className="hud-burger" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6} className="tip-card !p-0 !rounded-[4px]">
              <div className="px-2.5 py-1.5">
                <p className="font-pixel text-[10px] text-[var(--mf-leaf)]">Masked Farm</p>
                <p className="text-[11px] font-medium text-[var(--mf-muted-ink)]">Nông trại ven biển Tidecrest</p>
              </div>
            </TooltipContent>
          </Tooltip>

          {inventory ? (
            <FeatureButton
              def={inventory}
              active={isFeatureActive(inventory, ctx)}
              onClick={() => dispatch(inventory.target)}
              showShortcut={false}
            />
          ) : null}
          {skills ? (
            <FeatureButton
              def={skills}
              active={isFeatureActive(skills, ctx)}
              onClick={() => dispatch(skills.target)}
              showShortcut={false}
            />
          ) : null}
        </div>

        {expanded ? (
          <div className="feature-dock-menu">
            {modeFeatures.length > 0 ? (
              <>
                {modeFeatures.map((f) => (
                  <FeatureButton key={f.id} def={f} variant="raid" active={isFeatureActive(f, ctx)} onClick={() => dispatch(f.target)} />
                ))}
                <div className="feature-menu-divider" aria-hidden />
              </>
            ) : null}
            <div className="feature-menu-grid">
              {dockFeatures.map((f) => (
                <FeatureButton key={f.id} def={f} active={isFeatureActive(f, ctx)} onClick={() => dispatch(f.target)} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>
    </TooltipProvider>
  );
}
