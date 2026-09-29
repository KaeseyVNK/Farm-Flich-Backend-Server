"use client";

import { useEffect } from "react";
import { useProgressionStore } from "@/store/progressionStore";
import { useUiStore } from "@/store/uiStore";
import { Trophy } from "lucide-react";

/** Level-up toast — hiển thị khi addXp vượt ngưỡng curve (phase 6). */
export function LevelUpToast() {
  const levelUpToast = useProgressionStore((s) => s.levelUpToast);
  const clearLevelUpToast = useProgressionStore((s) => s.clearLevelUpToast);
  const openPanel = useUiStore((s) => s.openPanel);

  // Auto-dismiss sau 4s (nếu user không click).
  useEffect(() => {
    if (!levelUpToast) return;
    const t = setTimeout(() => clearLevelUpToast(), 4000);
    return () => clearTimeout(t);
  }, [levelUpToast, clearLevelUpToast]);

  if (!levelUpToast) return null;
  const { level, gained } = levelUpToast;

  return (
    <div role="alert" className="pointer-events-none absolute inset-0 z-[65] flex items-center justify-center">
      <div className="animate-pop-in pointer-events-auto rounded-2xl border-2 border-[#e7b94e] bg-[#1c1408]/95 px-6 py-4 text-center shadow-2xl">
        <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#e7b94e] bg-gradient-to-br from-[#4e7d3a] to-[#2e5a22]">
          <Trophy className="h-6 w-6 text-[#e7b94e]" />
        </div>
        <p className="font-pixel text-lg font-extrabold text-[#e7b94e]">LEVEL {level}!</p>
        {gained > 1 && <p className="text-xs font-bold text-[#fbf7ec]/70">×{gained} levels</p>}
        <p className="mt-1 text-xs font-semibold text-[#fbf7ec]/80">
          +1 skill point earned
        </p>
        <button
          onClick={() => {
            clearLevelUpToast();
            openPanel("skills");
          }}
          className="lift-on-hover mt-3 rounded-lg border-2 border-[#e7b94e] bg-[#e7b94e] px-4 py-1.5 text-sm font-extrabold text-[#1c1408] hover:bg-[#f0c964]"
        >
          Dùng điểm kỹ năng
        </button>
      </div>
    </div>
  );
}
