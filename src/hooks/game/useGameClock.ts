"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";

/**
 * useGameClock — subscribes to the in-game clock but only triggers a React
 * re-render when the *displayed* unit (HH:MM) actually changes.
 *
 * The game store's `timeMinutes` updates every frame inside the rAF loop
 * (outside React's render tree), so subscribing to it directly would re-render
 * the HUD ~60×/sec. Instead, this hook polls the store on an interval and
 * compares the formatted HH:MM string; it only bumps local state when it
 * differs, so the HUD re-renders at most once per in-game minute.
 *
 * Returns the current formatted time string (e.g. "6:15 AM") and the raw
 * minutes value (for phase calculations).
 */
export function useGameClock(intervalMs = 1000): { display: string; minutes: number } {
  const [display, setDisplay] = useState(() =>
    formatHHMM(useGameStore.getState().timeMinutes),
  );
  const [minutes, setMinutes] = useState(() => useGameStore.getState().timeMinutes);

  useEffect(() => {
    // Read the store on an interval. The store is updated by the rAF loop,
    // so we just poll + diff. Only setState when the displayed minute changes.
    const id = setInterval(() => {
      const t = useGameStore.getState().timeMinutes;
      const next = formatHHMM(t);
      setDisplay((prev) => (prev !== next ? next : prev));
      setMinutes((prev) => (Math.floor(t) !== Math.floor(prev) ? t : prev));
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { display, minutes };
}

function formatHHMM(min: number): string {
  let h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  const label = h >= 12 && h < 24 ? "PM" : "AM";
  let displayH = h % 12;
  if (displayH === 0) displayH = 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${label}`;
}
