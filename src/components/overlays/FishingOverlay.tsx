// Wave 1 P4 — overlay câu cá: hint chờ/cắn + reel bar (hold Space/pointer).
// Mirror state từ fishingStore (scene là authority). Reduced-motion: không pulse.
"use client";

import { useEffect, useRef } from "react";
import { useFishingStore } from "@/store/fishingStore";

/** Reel bar dọc — fish zone (vàng) + bar người chơi (xanh) + progress (đáy). */
function ReelBar({ reel }: { reel: { barPos: number; fishPos: number; progress: number } | null }) {
  const setHolding = useFishingStore((s) => s.setHolding);
  const holdRef = useRef(false);

  // Space hold (desktop) — window listener khi còn reel.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !holdRef.current) {
        holdRef.current = true;
        setHolding(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        holdRef.current = false;
        setHolding(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      if (holdRef.current) setHolding(false);
    };
  }, [setHolding]);

  if (!reel) return null;
  // barPos/fishPos 0..1 (0=đáy) → CSS bottom %.
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative h-48 w-12 touch-none rounded-lg border-2 border-[#4a3119] bg-[#1d3a5f]"
        data-testid="fishing-reel-bar"
        onPointerDown={(e) => {
          e.preventDefault();
          holdRef.current = true;
          setHolding(true);
        }}
        onPointerUp={() => {
          holdRef.current = false;
          setHolding(false);
        }}
        onPointerLeave={() => {
          if (holdRef.current) {
            holdRef.current = false;
            setHolding(false);
          }
        }}
        role="slider"
        aria-label="Thanh câu cá — giữ để nâng thanh theo cá"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(reel.progress * 100)}
      >
        {/* Vùng cá di chuyển */}
        <div
          className="absolute left-1 right-1 h-3 rounded bg-[#e7b94e]/80"
          style={{ bottom: `calc(${reel.fishPos * 100}% - 6px)` }}
          data-testid="fishing-reel-fish"
        />
        {/* Thanh người chơi giữ */}
        <div
          className="absolute left-0.5 right-0.5 h-6 rounded border border-[#0f2a44] bg-[#4e9de0]"
          style={{ bottom: `calc(${reel.barPos * 100}% - 12px)` }}
          data-testid="fishing-reel-player"
        />
      </div>
      {/* Progress ngang */}
      <div className="h-2.5 w-24 overflow-hidden rounded-full border border-[#4a3119] bg-[#f3e8cf]">
        <div className="h-full bg-[#4e7d3a]" style={{ width: `${reel.progress * 100}%` }} data-testid="fishing-reel-progress" />
      </div>
      <p className="text-[11px] font-bold text-[#fbf7ec]">GIỮ (Space / chạm) để theo cá</p>
    </div>
  );
}

export function FishingOverlay() {
  const { active, phase, waterLabel, reel } = useFishingStore();
  const requestCancel = useFishingStore((s) => s.requestCancel);
  // Không render khi không session — pointer-events-none để không chặn canvas.
  if (!active) return null;

  const hint =
    phase === "casting"
      ? "Quẳng cần..."
      : phase === "wait"
        ? `Câu ở ${waterLabel || "nước"}... chờ cá cắn`
        : phase === "bite"
          ? "CÁ CẮN! Nhấn ngay!"
          : phase === "caught"
            ? "Bắt được!"
            : phase === "escaped"
              ? "Tuột..."
              : "Câu";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex items-end justify-center gap-4 p-4 md:bottom-8">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border-2 border-[#4a3119] bg-[#1d3a5f]/90 px-4 py-3 shadow-xl">
        <div className="min-w-36 text-center">
          <p
            className={`text-sm font-extrabold ${phase === "bite" ? "motion-safe:animate-pulse text-[#ffd24a]" : "text-[#fbf7ec]"}`}
            data-testid="fishing-hint"
          >
            {hint}
          </p>
          {phase === "bite" ? (
            <p className="text-[11px] font-bold text-[#ffd24a]">Space / chạm màn hình</p>
          ) : null}
          {phase === "wait" ? (
            <p className="text-[11px] font-medium text-[#fbf7ec]/70">Di chuyển = thu cần</p>
          ) : null}
        </div>
        {phase === "reel" ? <ReelBar reel={reel} /> : null}
        <button
          onClick={requestCancel}
          className="min-h-[44px] rounded border border-[#4a3119] bg-[#8a6238] px-3 text-xs font-bold text-[#fbf7ec] hover:bg-[#9a7248]"
        >
          Thu cần
        </button>
      </div>
    </div>
  );
}
