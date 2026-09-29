"use client";

import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { setVirtualKey, triggerInteract } from "@/lib/game/bridge";

/**
 * TouchControls — an on-screen D-pad + action button for mobile devices.
 * Shown only below the `md` breakpoint (768px). Uses pointer events so it
 * works with both touch and mouse. Each D-pad button sets a virtual movement
 * key on press and clears it on release.
 */
export function TouchControls() {
  // Handler that sets a virtual key while pressed, clears on release/leave
  const press = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setVirtualKey(key, true);
    },
    onPointerUp: () => setVirtualKey(key, false),
    onPointerLeave: () => setVirtualKey(key, false),
    onPointerCancel: () => setVirtualKey(key, false),
  });

  // bottom-[9.75rem]: sits ABOVE the hotbar strip (which sits just above the
  // nav) so the D-pad / Use corner cluster never collides with the centered
  // hotbar (Phase 2 safe-zone). Stack: nav + hotbar tray 80px (bottom 4.5rem)
  // → D-pad cần offset ≥ 4.5rem + 5rem tray = 9.5rem; +0.25rem gap. Trước đây
  // bottom-36 (9rem) khớp tray 72px cũ — redesign nâng slot h-14 → tray 80px
  // → chèn 8px (4 spec responsive fail).
  return (
    <div data-testid="touch-controls" className="pointer-events-auto absolute bottom-[9.75rem] left-3 z-[var(--z-hud)] flex select-none items-end gap-3 md:hidden">
      {/* D-pad cross layout */}
      <div className="relative grid h-36 w-36 grid-cols-3 grid-rows-3">
        {/* Up */}
        <button
          {...press("w")}
          className="col-start-2 row-start-1 flex min-h-[44px] items-center justify-center rounded-t-[4px] border-2 border-[var(--mf-frame)] bg-[var(--mf-paper-raised)]/90 text-[var(--mf-ink)] active:bg-[var(--mf-harvest)]"
          aria-label="Đi lên"
        >
          <ChevronUp className="h-6 w-6" strokeWidth={3} />
        </button>
        {/* Left */}
        <button
          {...press("a")}
          className="col-start-1 row-start-2 flex min-w-[44px] items-center justify-center rounded-l-[4px] border-2 border-[var(--mf-frame)] bg-[var(--mf-paper-raised)]/90 text-[var(--mf-ink)] active:bg-[var(--mf-harvest)]"
          aria-label="Đi trái"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={3} />
        </button>
        {/* Center spacer */}
        <div className="col-start-2 row-start-2 border-2 border-[var(--mf-frame)] bg-[var(--mf-muted-ink)]/30" />
        {/* Right */}
        <button
          {...press("d")}
          className="col-start-3 row-start-2 flex min-w-[44px] items-center justify-center rounded-r-[4px] border-2 border-[var(--mf-frame)] bg-[var(--mf-paper-raised)]/90 text-[var(--mf-ink)] active:bg-[var(--mf-harvest)]"
          aria-label="Đi phải"
        >
          <ChevronRight className="h-6 w-6" strokeWidth={3} />
        </button>
        {/* Down */}
        <button
          {...press("s")}
          className="col-start-2 row-start-3 flex min-h-[44px] items-center justify-center rounded-b-[4px] border-2 border-[var(--mf-frame)] bg-[var(--mf-paper-raised)]/90 text-[var(--mf-ink)] active:bg-[var(--mf-harvest)]"
          aria-label="Đi xuống"
        >
          <ChevronDown className="h-6 w-6" strokeWidth={3} />
        </button>
      </div>

      {/* Action button — 44px+ target, 4px corner (contract: no rounded-full on buttons) */}
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          triggerInteract();
        }}
        className="flex h-16 w-16 touch-none select-none items-center justify-center rounded-[4px] border-2 border-[var(--mf-frame)] bg-[var(--mf-leaf)] text-[var(--mf-paper-raised)] shadow-[3px_3px_0_rgba(0,0,0,0.25)] active:brightness-110"
        aria-label="Interact / use tool"
      >
        <Hand className="h-7 w-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
