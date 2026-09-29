"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import type { RaidPuzzleKind } from "@/lib/raid/types";
import { CircuitRenderer, JigsawRenderer, LockRotateRenderer } from "./puzzle-extra-renderers";

/**
 * PuzzleModal (concept §8 + W7c §8.1). 6 kind — mỗi tier chest 2 puzzle:
 * - memory (wood): click 4 nút theo thứ tự seq.
 * - circuit (wood): xoay 4×4 ống nối A→B (renderer ở puzzle-extra-renderers).
 * - timing (iron): bar `size` ô, click 1 ô ∈ [lo,hi].
 * - lock-rotate (iron): xoay 3 vòng khắc về đỉnh.
 * - sequence (safe): giống memory (lit-only, deadlineMs).
 * - jigsaw (safe): swap mảnh 4×4 về đúng chỗ.
 * Client gửi attempt (KHÔNG "solved"), server validate.
 */
export interface PuzzleProps {
  kind: RaidPuzzleKind;
  seq?: number[];
  lo?: number;
  hi?: number;
  size?: number;
  shapes?: number[];
  rot?: number[];
  offsets?: number[];
  sizes?: number[];
  perm?: number[];
  deadlineMs?: number;
  /** W7d-P2: có lockpick trong túi + chưa dùng raid này → nút +2s deadline. */
  hasLockpick?: boolean;
  onUseLockpick?: () => void;
  onSubmit: (attempt: number[]) => void;
  onCancel: () => void;
}

export function PuzzleModal(props: PuzzleProps) {
  const { kind, seq, lo, hi, size } = props;
  const [attempt, setAttempt] = useState<number[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  // PuzzleModal luôn mounted (RaidView render có điều kiện) → trap khi xuất hiện.
  useFocusTrap(true, dialogRef);

  if (kind === "timing") {
    const bar = size ?? 10;
    return (
      <Shell dialogRef={dialogRef} deadlineMs={props.deadlineMs} lockpick={{ has: props.hasLockpick, onUse: props.onUseLockpick }}>
        <div className="w-80 rounded border-2 border-[#4a3119] bg-[#fffaf0] p-4 text-center">
          <h3 className="f-display mb-2 text-sm text-[#4e7d3a]">Mở rương — Cán thời gian</h3>
          <p className="mb-3 text-xs text-[#6b5b45]">Click 1 ô trong vùng sáng</p>
          <div className="mb-3 flex gap-px">
            {Array.from({ length: bar }).map((_, i) => {
              const inWin = i >= (lo ?? 0) && i <= (hi ?? 0);
              return (
                <button
                  key={i}
                  onClick={() => props.onSubmit([i])}
                  className={`h-8 flex-1 rounded-sm border border-[#4a3119] ${
                    inWin ? "bg-[#4e7d3a]" : "bg-[#e8d9b5]"
                  } hover:brightness-110`}
                />
              );
            })}
          </div>
          <button onClick={props.onCancel} className="rounded border-2 border-[#c0452f] px-3 py-1 text-sm text-[#c0452f]">
            Bỏ qua
          </button>
        </div>
      </Shell>
    );
  }

  // W7c — 3 renderer mới (logic + UI riêng file puzzle-extra-renderers).
  if (kind === "lock-rotate") {
    return (
      <Shell dialogRef={dialogRef} deadlineMs={props.deadlineMs} lockpick={{ has: props.hasLockpick, onUse: props.onUseLockpick }}>
        <LockRotateRenderer
          offsets={props.offsets ?? [1, 1, 1]}
          sizes={props.sizes ?? [4, 6, 8]}
          onSubmit={props.onSubmit}
          onCancel={props.onCancel}
        />
      </Shell>
    );
  }
  if (kind === "circuit") {
    return (
      <Shell dialogRef={dialogRef} deadlineMs={props.deadlineMs} lockpick={{ has: props.hasLockpick, onUse: props.onUseLockpick }}>
        <CircuitRenderer
          shapes={props.shapes ?? []}
          rot={props.rot ?? []}
          onSubmit={props.onSubmit}
          onCancel={props.onCancel}
        />
      </Shell>
    );
  }
  if (kind === "jigsaw") {
    return (
      <Shell dialogRef={dialogRef} deadlineMs={props.deadlineMs} lockpick={{ has: props.hasLockpick, onUse: props.onUseLockpick }}>
        <JigsawRenderer perm={props.perm ?? []} onSubmit={props.onSubmit} onCancel={props.onCancel} />
      </Shell>
    );
  }

  // memory + sequence: grid 4 nút click seq
  const target = seq ?? [];
  const done = attempt.length >= target.length;
  return (
    <Shell dialogRef={dialogRef} deadlineMs={props.deadlineMs} lockpick={{ has: props.hasLockpick, onUse: props.onUseLockpick }}>
      <div className="w-72 rounded border-2 border-[#4a3119] bg-[#fffaf0] p-4 text-center">
        <h3 className="f-display mb-1 text-sm text-[#4e7d3a]">
          Mở rương — {kind === "sequence" ? "Tổ hợp" : "Ghi nhớ"}
        </h3>
        <p className="mb-3 text-xs text-[#6b5b45]">
          Nhấn {target.length} ô theo thứ tự ({attempt.length}/{target.length})
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              disabled={done}
              onClick={() => setAttempt((a) => [...a, n])}
              className="h-14 rounded border-2 border-[#4a3119] bg-[#f3e8cf] text-2xl disabled:opacity-40"
            >
              {n + 1}
            </button>
          ))}
        </div>
        <div className="mb-3 text-sm text-[#3b2f23]">Đã bấm: [{attempt.map((n) => n + 1).join(", ")}]</div>
        <div className="flex gap-2">
          <button
            onClick={() => (done ? props.onSubmit(attempt) : null)}
            disabled={!done}
            className="flex-1 rounded border-2 border-[#4a3119] bg-[#4e7d3a] px-3 py-1.5 text-sm text-[#fbf7ec] disabled:opacity-40"
          >
            Kết thúc
          </button>
          <button onClick={props.onCancel} className="rounded border-2 border-[#c0452f] px-3 py-1.5 text-sm text-[#c0452f]">
            Bỏ qua
          </button>
        </div>
      </div>
    </Shell>
  );
}

/** Vỏ modal chung: overlay + focus trap + đếm ngược deadline (mọi kind). */
function Shell({
  dialogRef,
  deadlineMs,
  lockpick,
  children,
}: {
  dialogRef: React.RefObject<HTMLDivElement | null>;
  deadlineMs?: number;
  /** W7d-P2 (review W7 #7): lockpick dùng được cho MỌI kind — nút ở Shell chung. */
  lockpick?: { has?: boolean; onUse?: () => void };
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineMs) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadlineMs]);
  const left = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - now) / 1000)) : null;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Câu đố rương" className="absolute inset-0 z-[7] flex items-center justify-center bg-black/60">
      <div className="relative">
        {left !== null && (
          <div
            data-testid="puzzle-deadline"
            className={`absolute -top-7 right-0 rounded px-2 py-0.5 text-xs font-bold ${
              left <= 3 ? "bg-[#c0452f] text-[#fbf7ec]" : "bg-[#4a3119] text-[#fbf7ec]"
            }`}
          >
            ⏱ {left}s
          </div>
        )}
        {lockpick?.has && lockpick.onUse && (
          <button
            onClick={lockpick.onUse}
            data-testid="lockpick-button"
            className="absolute -top-7 left-0 rounded border-2 border-[#4a3119] bg-[#e7b94e] px-2 py-0.5 text-xs font-bold text-[#3b2f23] hover:bg-[#f0c964]"
          >
            🔓 +2s
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
