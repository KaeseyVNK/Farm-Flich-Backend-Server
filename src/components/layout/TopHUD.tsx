"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { useGameStore, timePhase } from "@/store/gameStore";
import { assetUrl } from "@/lib/game/assets/asset-manifest";
import { useWorldStore } from "@/store/worldStore";
import { useGameClock } from "@/hooks/game/useGameClock";
import { SeasonDial } from "./season-dial";
import type { Season } from "@/lib/game/constants";

const SEASON_KEY: Record<Season, "spring" | "summer" | "fall" | "winter"> = {
  Spring: "spring",
  Summer: "summer",
  Fall: "fall",
  Winter: "winter",
};
const PHASE_KEY = {
  Morning: "morning",
  Afternoon: "afternoon",
  Evening: "evening",
  Night: "night",
} as const;
const ZONE_I18N: Record<string, "zoneFarm" | "zoneHouse" | "zoneVillage" | "zoneCave" | "zoneBeach"> = {
  farm: "zoneFarm",
  house: "zoneHouse",
  village: "zoneVillage",
  cave: "zoneCave",
  beach: "zoneBeach",
};

const ClockCard = memo(function ClockCard() {
  const t = useTranslations("hud");
  const { display, minutes } = useGameClock(1000);
  const phase = timePhase(minutes);
  const day = useGameStore((s) => s.day);
  const season = useGameStore((s) => s.season) as Season;
  const year = useGameStore((s) => s.year);
  const zone = useWorldStore((s) => s.zone);
  const zoneKey = ZONE_I18N[zone] ?? "zoneFarm";

  return (
    <div className="hud-clock">
      <SeasonDial />
      <div className="hud-clock-copy">
        <span className="hud-clock-date">
          {t(SEASON_KEY[season])} · {t("dayNum", { day })}
        </span>
        <span className="hud-clock-time tabular-nums">{display}</span>
        <span className="hud-clock-meta">
          {t(PHASE_KEY[phase])} · {t("year", { year })}
        </span>
        <span className="hud-clock-zone">{t(zoneKey)}</span>
      </div>
    </div>
  );
});

const GoldBar = memo(function GoldBar() {
  const t = useTranslations("hud");
  const gold = useGameStore((s) => s.gold);
  return (
    <div className="hud-gold" aria-label={`${t("gold")}: ${gold.toLocaleString()}`}>
      <span
        className="hud-coin"
        aria-hidden
        style={{ backgroundImage: `url(${assetUrl("ui.money")})` }}
      />
      <span className="hud-gold-value tabular-nums">{gold.toLocaleString()}</span>
    </div>
  );
});

/** Farm RPG top-right cluster: circular season/weather + clock copy + coin counter. */
export function TopHUD() {
  return (
    <header className="hud-status" role="banner">
      <ClockCard />
      <GoldBar />
    </header>
  );
}
