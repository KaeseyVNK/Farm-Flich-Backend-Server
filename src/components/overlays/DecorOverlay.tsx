"use client";

// W3P4 — overlay hướng dẫn DecorMode (đang bật thì hiện hint + nút mobile).
// Lệnh thật nằm decor-commands (scene phím + nút ở đây dùng chung).
import { useDecorModeStore } from "@/store/decorModeStore";
import { useFarmStore } from "@/store/farmStore";
import { decorById } from "@/lib/game/decor/decor-catalog";
import {
  decorPlaceAtCursor,
  decorPickAtCursor,
  decorRotateAtCursor,
} from "@/lib/game/decor/decor-commands";
import { DecorArt } from "@/components/game-ui/decor-art";
import { Button } from "@/components/ui/button";
import { Hammer, RotateCw, FlipHorizontal2, PackageOpen, X } from "lucide-react";

export function DecorOverlay() {
  const m = useDecorModeStore();
  if (!m.active) return null;
  const def = m.defId ? decorById(m.defId) : null;
  const owned = m.defId ? (useFarmStore.getState().decorOwned[m.defId] ?? 0) : 0;
  return (
    <div
      data-testid="decor-overlay"
      className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex max-w-lg flex-col items-center gap-2 rounded-xl border-2 border-[#4a3119] bg-[#fffaf0]/95 px-4 py-2 shadow-lg">
        <p className="flex items-center justify-center gap-2 text-center text-xs font-bold text-[#4a3119]" data-testid="decor-hint">
          {def ? <DecorArt def={def} size={28} /> : null}
          {def
            ? `Đặt ${def.name} (kho: ${owned}) — WASD di chuyển · R xoay${def.rotatable ? "" : " (không xoay được)"} · Space đặt · X nhặt · Esc thoát`
            : "Chỉnh sửa trang trí — WASD di chuyển · X nhặt decor · R xoay decor dưới con trỏ · Esc thoát"}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={decorRotateAtCursor} data-testid="decor-rotate-btn">
            <RotateCw className="h-4 w-4" /> Xoay (R)
          </Button>
          <Button size="sm" variant="secondary" onClick={() => useDecorModeStore.getState().dispatch({ type: "flip" })} data-testid="decor-flip-btn">
            <FlipHorizontal2 className="h-4 w-4" /> Lật (F)
          </Button>
          {def ? (
            <Button size="sm" onClick={decorPlaceAtCursor} data-testid="decor-place-btn">
              <Hammer className="h-4 w-4" /> Đặt (Space)
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={decorPickAtCursor} data-testid="decor-pick-btn">
              <PackageOpen className="h-4 w-4" /> Nhặt (X)
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => useDecorModeStore.getState().dispatch({ type: "exit" })}
            data-testid="decor-exit-btn"
          >
            <X className="h-4 w-4" /> Thoát
          </Button>
        </div>
      </div>
    </div>
  );
}
