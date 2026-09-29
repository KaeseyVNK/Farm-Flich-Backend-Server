"use client";

import { useEffect, useState } from "react";
import { Footprints, TriangleAlert, Siren } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * TrapEffectOverlay (raider). Hiện viz flash khi nhận trap-sprung.
 * bear → slow tint (xanh), spike → shake (đỏ), alarm → alarm pulse.
 * Tự fade sau 1.5s.
 *
 * Visibility derived từ prop `effect.ts` + clock (red-team react-hooks/refs):
 * tick mỗi 250ms → re-render → tính còn hiện hay không. KHÔNG setState sync trong effect.
 */
export interface TrapEffect {
  kind: "bear" | "spike" | "alarm";
  ts: number;
}

const VIZ: Record<TrapEffect["kind"], { bg: string; label: string; icon: LucideIcon }> = {
  bear: { bg: "rgba(46,158,143,0.35)", label: "Bẫy gấu — chậm lại!", icon: Footprints },
  spike: { bg: "rgba(255,68,56,0.35)", label: "Bẫy chông — gây tiếng!", icon: TriangleAlert },
  alarm: { bg: "rgba(139,92,246,0.40)", label: "Bẫy báo động!", icon: Siren },
};

const FADE_MS = 1500;

export function TrapEffectOverlay({ effect }: { effect: TrapEffect | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!effect) return;
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [effect]);

  const visible = !!effect && Date.now() - effect.ts < FADE_MS;
  if (!visible || !effect) return null;
  const viz = VIZ[effect.kind];
  return (
    <div
      className="f-body pointer-events-none fixed inset-0 z-[65] flex items-center justify-center"
      style={{ background: viz.bg }}
    >
      <span
        className="rounded-lg bg-black/40 px-4 py-2 text-lg font-bold text-white"
        style={{ animation: "alarm-pulse 0.3s 3" }}
      >
        <viz.icon className="mr-2 inline h-6 w-6" />
        {viz.label}
      </span>
    </div>
  );
}
