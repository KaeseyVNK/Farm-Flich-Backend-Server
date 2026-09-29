"use client";

import { useCallback, useEffect, useRef } from "react";
import { MoveUp, MoveDown, MoveLeft, MoveRight, Box, DoorOpen } from "lucide-react";

/**
 * RaidTouchControls (phase-05 §5) — touch movement/interact/exit cho mobile raid.
 * Chỉ gửi các intent server-validated CÓ SẴN (ClientMsg): move/interact-chest/exit.
 * KHÔNG simulate movement/loot local — server vẫn là authority (hidden trap rule).
 *
 * Pointer capture/cancel cleanup: giữ direction → release trên pointerup/leave/cancel.
 * Disabled khi puzzle/modal/end state active (banner z-index cao + overlay chặn input)
 * → `disabled` prop do RaidView quyết định, không tự suy luận phase.
 *
 * Nhận `send` là closure gửi qua RaidWsClient — RaidView sở hữu client lifecycle,
 * control chỉ là presentation nút 44px+.
 */
export function RaidTouchControls({
  send,
  onInteract,
  disabled,
}: {
  /** Gửi intent server-validated (move/exit) — RaidView sở hữu client lifecycle. */
  send: (m: Parameters<import("@/lib/raid/ws-client").RaidWsClient["send"]>[0]) => void;
  /** Interact nearest chest — RaidView sở hữu snapshotRef, tái dùng logic Space. */
  onInteract: () => void;
  disabled: boolean;
}) {
  // Pointer-down track: dir đang giữ (tránh spam move khi repeat). Release reset.
  const heldDir = useRef<{ dx: -1 | 0 | 1; dy: -1 | 0 | 1 } | null>(null);

  const clear = useCallback(() => {
    heldDir.current = null;
  }, []);

  useEffect(() => {
    if (!disabled) return;
    // Khi puzzle/modal xuất hiện, release mọi direction đang giữ để không move tiếp.
    clear();
  }, [disabled, clear]);

  const press = useCallback(
    (dx: -1 | 0 | 1, dy: -1 | 0 | 1) => {
      if (disabled) return;
      heldDir.current = { dx, dy };
      send({ t: "move", dx, dy });
    },
    [disabled, send],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      clear();
    },
    [clear],
  );

  const exit = useCallback(() => {
    if (disabled) return;
    send({ t: "exit" });
  }, [disabled, send]);

  const dirBtn = (label: string, icon: React.ReactNode, dx: -1 | 0 | 1, dy: -1 | 0 | 1) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        press(dx, dy);
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={clear}
      className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-[#4a3119] bg-[#fffaf0] text-[#3b2f23] active:bg-[#e7b94e] disabled:opacity-40"
    >
      {icon}
    </button>
  );

  return (
    <div
      data-testid="raid-touch-controls"
      className="pointer-events-auto fixed inset-x-0 bottom-20 z-[55] flex items-end justify-between gap-2 px-3 pb-2"
    >
      {/* Movement D-pad — pointer capture đảm bảo thả ngoài nút vẫn clear */}
      <div className="grid grid-cols-3 grid-rows-3 gap-1">
        <div />
        {dirBtn("Đi lên", <MoveUp className="h-6 w-6" />, 0, -1)}
        <div />
        {dirBtn("Đi trái", <MoveLeft className="h-6 w-6" />, -1, 0)}
        <div className="h-14 w-14" />
        {dirBtn("Đi phải", <MoveRight className="h-6 w-6" />, 1, 0)}
        <div />
        {dirBtn("Đi xuống", <MoveDown className="h-6 w-6" />, 0, 1)}
        <div />
      </div>

      {/* Interact + Exit */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-label="Mở rương gần nhất"
          disabled={disabled}
          onClick={onInteract}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#4a3119] bg-[#e7b94e] text-[#4a3318] active:brightness-110 disabled:opacity-40"
        >
          <Box className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Thoát raid"
          disabled={disabled}
          onClick={exit}
          className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-[var(--alarm)] bg-[var(--night-deep)] text-white active:brightness-110 disabled:opacity-40"
        >
          <DoorOpen className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
