"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { useGameStore } from "@/store/gameStore";
import { useMountStore } from "@/store/mountStore";
import { mountById } from "@/lib/game/mounts/mount-catalog";
import { daylightRemainingPct } from "@/lib/game/daylight";
import { absMinute } from "@/lib/game/buff";
import { useGameClock } from "@/hooks/game/useGameClock";
import { GameIcon } from "@/components/game-ui/game-icon";

type EnergyTier = "high" | "mid" | "low" | "empty";

function energyTier(pct: number, energy: number): EnergyTier {
  if (energy <= 0) return "empty";
  if (pct < 25) return "low";
  if (pct < 50) return "mid";
  return "high";
}

function VerticalMeter({
  icon,
  fillClass,
  pct,
  label,
  testId,
}: {
  icon: "status-energy" | "status-day";
  fillClass: string;
  pct: number;
  label: string;
  testId?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="hud-vital" aria-label={label} data-testid={testId}>
      <GameIcon id={icon} size={20} decorative className="hud-vital-icon" />
      <div className="hud-vital-well" aria-hidden>
        <div
          className={`hud-vital-fill ${fillClass}`}
          style={{ transform: `scaleY(${clamped / 100})` }}
        />
      </div>
    </div>
  );
}

const EnergyMeter = memo(function EnergyMeter() {
  const t = useTranslations("hud");
  const energy = useGameStore((s) => s.energy);
  const maxEnergy = useGameStore((s) => s.maxEnergy);
  const pct = Math.round((energy / maxEnergy) * 100);
  const tier = energyTier(pct, energy);
  return (
    <VerticalMeter
      icon="status-energy"
      fillClass={`energy-fill-${tier}`}
      pct={pct}
      label={`${t("energy")}: ${Math.round(energy)}/${maxEnergy}`}
      testId="hud-energy"
    />
  );
});

const DaylightMeter = memo(function DaylightMeter() {
  const t = useTranslations("hud");
  const { minutes } = useGameClock(1000);
  const pct = daylightRemainingPct(minutes);
  return (
    <VerticalMeter
      icon="status-day"
      fillClass="daylight-fill"
      pct={pct}
      label={`${t("daylight")}: ${pct}%`}
      testId="hud-daylight"
    />
  );
});

/** W6: chip đang cưỡi (🐴/🚲) — hiện khi mounted, testid cho e2e. */
const MountChip = memo(function MountChip() {
  const mounted = useMountStore((s) => s.mounted);
  const active = useMountStore((s) => s.active);
  if (!mounted || !active) return null;
  const def = mountById(active);
  return (
    <span
      data-testid="hud-mount"
      className="rounded-full border border-[#4a3119]/40 bg-[#e6f2d9] px-2 py-0.5 text-[11px] font-extrabold text-[#3f6a2e] shadow"
    >
      {def?.icon ?? "🐴"} {def?.name ?? ""}
    </span>
  );
});

/** W2: chip buff đang chạy (speed/xp từ món nấu) — hiển thị phút còn lại. */
const BuffChips = memo(function BuffChips() {
  const buffs = useGameStore((s) => s.buffs);
  const day = useGameStore((s) => s.day);
  const { minutes } = useGameClock(1000);
  const now = absMinute(day, minutes);
  const chips: { key: string; icon: string; label: string; testId: string }[] = [];
  if ((buffs.speedUntilAbs ?? -1) > now) {
    chips.push({
      key: "speed",
      icon: "⚡",
      label: `×1.2 ${Math.max(1, Math.ceil((buffs.speedUntilAbs! - now)))}′`,
      testId: "hud-buff-speed",
    });
  }
  if ((buffs.xpUntilAbs ?? -1) > now) {
    chips.push({ key: "xp", icon: "★", label: "XP ×1.2", testId: "hud-buff-xp" });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      {chips.map((c) => (
        <span
          key={c.key}
          data-testid={c.testId}
          className="rounded-full border border-[#4a3119]/40 bg-[#fff3c4] px-2 py-0.5 text-[11px] font-extrabold text-[#8a6d1a] shadow"
        >
          {c.icon} {c.label}
        </span>
      ))}
    </div>
  );
});

/** Farm RPG bottom-right vitals: energy (stamina) + remaining daylight. No fake HP. */
export function HudVitals() {
  return (
    <div className="hud-vitals" data-testid="hud-vitals">
      <BuffChips />
      <MountChip />
      <EnergyMeter />
      <DaylightMeter />
    </div>
  );
}
