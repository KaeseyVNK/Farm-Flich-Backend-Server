"use client";

import { useEffect, useState } from "react";
import { useRaidStore } from "@/store/raidStore";
import { TICK_HZ } from "@/lib/raid/constants";
import { Siren } from "lucide-react";

/**
 * LockdownBanner (audit M11) — hiện khi snapshot.lockdown (chủ farm quay về).
 * Countdown tick-based: (gateCloseTick - snapshotTick)/10 − elapsed wall-clock.
 */
export function LockdownBanner() {
  const lockdown = useRaidStore((s) => s.snapshot?.lockdown ?? false);
  const gateCloseTick = useRaidStore((s) => s.lockdownGateCloseTick);
  const snapshotTick = useRaidStore((s) => s.snapshot?.tick ?? 0);
  const snapshotTs = useRaidStore((s) => s.snapshotTs);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!lockdown || !gateCloseTick) return;
    const tick = () => {
      const tickDelta = Math.max(0, gateCloseTick - snapshotTick);
      const elapsed = (Date.now() - snapshotTs) / 1000;
      setLeft(Math.max(0, Math.ceil(tickDelta / TICK_HZ - elapsed)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [lockdown, gateCloseTick, snapshotTick, snapshotTs]);

  if (!lockdown) return null;
  return (
    <div
      role="alert"
      className="f-num fixed left-1/2 top-16 z-[70] -translate-x-1/2 rounded-lg bg-[var(--alarm)] px-6 py-3 text-center text-lg font-bold text-white shadow-lg"
      style={{ animation: "alarm-pulse 0.5s infinite" }}
    >
      <Siren className="mr-2 inline h-5 w-5" /> CHỦ FARM ĐANG VỀ! Thoát trong {left}s
    </div>
  );
}
