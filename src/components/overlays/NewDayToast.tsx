"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { SEASON_THEME } from "@/lib/game/constants";
import { BedDouble } from "lucide-react";

function ToastCard({ text, day, season, onClose }: { text: string; day: number; season: string; onClose: () => void }) {
  const theme = SEASON_THEME[season as keyof typeof SEASON_THEME];
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Fade-out sau 1800ms, onClose (unmount) sau 2200ms — grace cho animation.
    // Trước đây parent gate isSleeping (store clear 1200ms) → unmount trước khi
    // fade kịp chạy → toast biến mất đột ngột thay vì fade mượt.
    const t = setTimeout(() => setVisible(false), 1800);
    const tClose = setTimeout(onClose, 2200);
    return () => {
      clearTimeout(t);
      clearTimeout(tClose);
    };
  }, [day, season, onClose]);

  return (
    // z-[45] (< modal z-50): toast có pointer-events-none nên player có thể mở shop
    // xuyên qua trong lúc flash ngày mới. Nếu toast z-[55] đè lên, shop z-50 bị
    // overlay đen phủ → nhìn như "game đứng". Toast nằm dưới modal, trên game UI.
    <div
      className={`pointer-events-none absolute inset-0 z-[45] flex items-center justify-center bg-black/50 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="animate-pop-in rounded-3xl border-4 border-[#4a3119] bg-[#fffaf0] px-8 py-6 text-center shadow-2xl">
        <BedDouble className="mx-auto mb-2 h-10 w-10 text-[#4e7d3a]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#8a6238]">
          A new day dawns
        </p>
        <p className="mt-1 text-2xl font-black text-[#3b2f23]">{text}</p>
        <p className="mt-2 text-sm font-semibold" style={{ color: theme.accent }}>
          {theme.emoji} {theme.label} is here — time to farm!
        </p>
      </div>
    </div>
  );
}

export function NewDayToast() {
  const isSleeping = useGameStore((s) => s.isSleeping);
  const newDayToast = useGameStore((s) => s.newDayToast);
  const day = useGameStore((s) => s.day);
  const season = useGameStore((s) => s.season);
  // activeKey = day-season của toast đang hiển thị (hoặc đang fade-out).
  // Khi isSleeping true + newDayToast set → capture key. Giữ đến khi ToastCard
  // gọi onClose (2200ms sau) — độc lập với isSleeping (store clear 1200ms).
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    // Cạnh lên của isSleeping → set key (re-show). setState trong effect OK đây:
    // chỉ fire khi isSleeping true && newDayToast && key mới — không cascade loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSleeping && newDayToast) setActiveKey(`${day}-${season}`);
  }, [isSleeping, newDayToast, day, season]);

  if (!activeKey || !newDayToast) return null;
  return (
    <ToastCard
      key={activeKey}
      text={newDayToast}
      day={day}
      season={season}
      onClose={() => setActiveKey(null)}
    />
  );
}
