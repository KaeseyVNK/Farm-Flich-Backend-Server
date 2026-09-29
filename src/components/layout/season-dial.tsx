"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { useGameStore } from "@/store/gameStore";
import { assetUrl } from "@/lib/game/assets/asset-manifest";
import { WEATHER_SEASON_CELL } from "@/lib/game/season-look";
import type { Season } from "@/lib/game/constants";

const SEASON_KEY: Record<Season, "spring" | "summer" | "fall" | "winter"> = {
  Spring: "spring",
  Summer: "summer",
  Fall: "fall",
  Winter: "winter",
};

export const SeasonDial = memo(function SeasonDial() {
  const t = useTranslations("hud");
  const season = useGameStore((s) => s.season) as Season;
  const day = useGameStore((s) => s.day);
  const cell = WEATHER_SEASON_CELL[season];
  const label = `${t(SEASON_KEY[season])}, ${t("dayNum", { day })}`;

  return (
    <div
      className="season-dial"
      data-season={season}
      role="img"
      aria-label={label}
      title={label}
    >
      <span className="season-dial-sky" aria-hidden />
      <span className="season-dial-ground" aria-hidden />
      <span className="season-dial-tree" aria-hidden />
      <span
        className="season-dial-glyph"
        aria-hidden
        style={{
          backgroundImage: `url(${assetUrl("ui.weather")})`,
          backgroundPosition: `-${cell.sx * 2}px -${cell.sy * 2}px`,
        }}
      />
      <span className="season-dial-day">{day}</span>
    </div>
  );
});
