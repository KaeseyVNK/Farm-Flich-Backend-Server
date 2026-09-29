"use client";

import { useState, useEffect } from "react";
import { upsertTrapAction, deleteTrapAction, listTrapsAction } from "@/app/actions/defense";
import { MAP_COLS, MAP_ROWS, TRAP_CAP_PER_FARM, TRAP_DEFAULT_DURABILITY } from "@/lib/raid/constants";
import type { TrapKind } from "@/lib/raid/defense-config-service";

/**
 * TrapConfigPanel (owner, phase 1). Grid 30×22 click-to-place trap.
 * Toolbar chọn kind (bear/spike/alarm). Cap 6/farm. Click placed trap → delete.
 * Load existing traps on mount (persist view across reload).
 */
const KINDS: { id: TrapKind; label: string; emoji: string }[] = [
  { id: "bear", label: "Gấu (slow)", emoji: "🐞" },
  { id: "spike", label: "Chông (alert)", emoji: "⛔" },
  { id: "alarm", label: "Báo động", emoji: "🚨" },
];

export function TrapConfigPanel() {
  const [kind, setKind] = useState<TrapKind>("spike");
  const [placed, setPlaced] = useState<number[]>([]); // tile indices
  const [msg, setMsg] = useState("");

  // Load existing traps on mount.
  useEffect(() => {
    void listTrapsAction().then((traps) => {
      setPlaced(traps.map((t) => t.tile));
    });
  }, []);

  const onPlace = async (tile: number) => {
    if (placed.includes(tile)) {
      // click trap đã đặt → delete. slot = tile (map 1:1 — tile là duy nhất mỗi
      // trap, dùng làm slot identifier). Trước đây slot = placed.indexOf(tile)
      // (vị trí trong mảng UI) → lệch DB khi delete giữa (slot DB != index UI).
      await deleteTrapAction(tile);
      setPlaced((p) => p.filter((t) => t !== tile));
      return;
    }
    if (placed.length >= TRAP_CAP_PER_FARM) {
      setMsg(`Cap ${TRAP_CAP_PER_FARM} trap/farm`);
      return;
    }
    // slot = tile: map 1:1 ổn định. Trước đây slot = placed.length → delete giữa
    // rồi place mới → slot trùng DB cũ → ON CONFLICT overwrite trap khác (data loss).
    const res = await upsertTrapAction(tile, {
      kind,
      tile,
      durability: TRAP_DEFAULT_DURABILITY,
      level: 1,
    });
    if (!res.ok) {
      setMsg(res.error ?? "lỗi");
      return;
    }
    setPlaced((p) => [...p, tile]);
    setMsg("");
  };

  return (
    <div className="f-body rounded-xl border-2 border-[#4a3119] bg-[#fffaf0] p-3 text-[#3b2f23]">
      <h3 className="f-display mb-2 text-lg text-[var(--mystic)]">Đặt bẫy (cap {TRAP_CAP_PER_FARM})</h3>
      <div className="mb-2 flex gap-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`rounded border px-2 py-1 text-xs font-bold ${
              kind === k.id ? "border-[var(--mystic)] bg-[var(--mystic)] text-white" : "border-[#4a3119] bg-[#efe2c4]"
            }`}
          >
            {k.emoji} {k.label}
          </button>
        ))}
      </div>
      {msg && <p className="mb-1 text-xs text-[var(--alarm)]">{msg}</p>}
      <div
        className="f-num grid gap-px"
        style={{ gridTemplateColumns: `repeat(${MAP_COLS}, 1fr)`, fontSize: "8px" }}
      >
        {Array.from({ length: MAP_COLS * MAP_ROWS }).map((_, tile) => (
          <button
            key={tile}
            onClick={() => onPlace(tile)}
            className={`aspect-square ${
              placed.includes(tile) ? "bg-[var(--alarm)]" : "bg-[#e8d9b5] hover:bg-[#d9c79a]"
            }`}
            aria-label={`tile ${tile}`}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] opacity-60">Đã đặt {placed.length}/{TRAP_CAP_PER_FARM}. Click ô đã đặt để xóa.</p>
    </div>
  );
}
