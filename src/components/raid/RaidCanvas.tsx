"use client";

import { useEffect, useRef, useState } from "react";
import { useRaidStore } from "@/store/raidStore";
import { interpolateEntity, computeAlpha } from "@/lib/raid/interpolation";
import type { AlertLevel, RaidEntity } from "@/lib/raid/types";
import { MAP_COLS, MAP_ROWS } from "@/lib/raid/constants";
import { mapRaidEntity, type RaidDisplayKind, type RaidDisplaySpec } from "./raid-display-mapper";

const NIGHT_OPACITY: Record<AlertLevel, number> = {
  stealth: 0.55,
  caution: 0.65,
  alarm: 0.75,
};

// Entity kinds → shared raid-display-mapper kinds. Live canvas + replay canvas render
// through the SAME mapper (phase-05 §Live/replay display mapper contract) so colours/
// shapes cannot drift. `size`/`radius` stay local per-canvas presentation detail.
const KIND_MAP: Record<"you" | "dog" | "chest" | "chestOpen" | "lure", RaidDisplayKind> = {
  you: "raider",
  dog: "dog",
  chest: "chest-closed",
  chestOpen: "chest-open",
  lure: "lure",
};

const SIZE: Record<"you" | "dog" | "chest" | "chestOpen" | "lure", number> = {
  you: 28,
  dog: 24,
  chest: 26,
  chestOpen: 26,
  lure: 14,
};

const RADIUS: Record<RaidDisplaySpec["primitive"], string> = {
  disc: "9999px",
  square: "8px",
  crate: "4px",
};

function Entity({
  kind,
  e,
  label,
}: {
  kind: keyof typeof KIND_MAP;
  e: RaidEntity;
  label?: string;
}) {
  const spec = mapRaidEntity(KIND_MAP[kind]);
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${(e.x / MAP_COLS) * 100}%`,
        top: `${(e.y / MAP_ROWS) * 100}%`,
        filter: "drop-shadow(0 2px 2px rgba(0,0,0,.5))",
      }}
    >
      <div
        className="border"
        style={{
          width: SIZE[kind],
          height: SIZE[kind],
          background: spec.color,
          borderRadius: RADIUS[spec.primitive],
          borderColor: spec.stroke,
        }}
      />
      {label && <div className="text-center text-[10px] text-white">{label}</div>}
    </div>
  );
}

/** Render snapshot server (server-authoritative) + interpolation theo velocity (red-team #12).
 * `overview` (Tab): phóng canvas fullscreen — §3.2 fog vẫn giữ vì snapshot CHƯA BAO GIỜ
 * chứa traps/patrol-future/chest-content (server chỉ gửi you/dogs/chests-open-flags). */
export function RaidCanvas({ overview = false }: { overview?: boolean }) {
  const snapshot = useRaidStore((s) => s.snapshot);
  const prev = useRaidStore((s) => s.prevSnapshot);
  const snapshotTs = useRaidStore((s) => s.snapshotTs);
  const prevTs = useRaidStore((s) => s.prevSnapshotTs);
  const [, force] = useState(0);
  const raf = useRef<number>(0);

  // RAF → re-render interpolation mượt. Gate trên snapshot — trước đây RAF chạy
  // vô hạn kể cả khi snapshot null (raid chưa start / đã end) → pin drain mobile.
  useEffect(() => {
    if (!snapshot) return;
    const loop = () => {
      force((n) => n + 1);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [snapshot]);

  if (!snapshot) return null;

  const alpha = prev ? computeAlpha(prevTs, snapshotTs, Date.now()) : 1;
  const you = prev ? interpolateEntity(prev.you, snapshot.you, alpha) : snapshot.you;
  const dogs = snapshot.dogs.map((d, i) =>
    prev?.dogs[i] ? interpolateEntity(prev.dogs[i], d, alpha) : d,
  );

  return (
    // Outer: vị trí — thường nằm trong layout (w-full); overview = fixed fullscreen
    // (§3.2: chỉ zoom-out, fog giữ vì snapshot không bao giờ chứa traps/patrol).
    <div
      className={
        overview
          ? "fixed inset-0 z-[64] flex flex-col items-center justify-center bg-black/80 p-4"
          : "w-full"
      }
    >
      {overview && (
        <div
          data-testid="raid-overview-hint"
          className="mb-2 rounded-full border border-[#d9a441]/60 bg-[#3a2a10]/90 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[#ffd98a]"
        >
          Đang xem toàn cảnh — bẫy ẩn! (Tab để đóng)
        </div>
      )}
      {/* Inner: canvas thật — luôn relative + aspect-ratio để entities % khớp arena. */}
      <div
        className={
          overview
            ? "relative max-h-full w-full max-w-[1280px] overflow-hidden border-2 border-[#d9a441]"
            : "relative w-full overflow-hidden border-2 border-[#4a3119]"
        }
        style={{ aspectRatio: "960 / 704", background: "#5c8744" }}
      >
        {/* entities — color rects (audit emoji verdict: gameplay visuals không emoji) */}
        <Entity kind="you" e={you} />
        {dogs.map((d) => (
          <Entity key={d.id} kind="dog" e={d} />
        ))}
        {(snapshot.placedItems ?? []).map((it, i) => (
        <Entity
          key={`lure-${i}`}
          kind="lure"
          e={{ id: `lure${i}`, x: it.x, y: it.y, dx: 0, dy: 0, facing: "down" }}
        />
      ))}
      {snapshot.chests.map((c) => (
          <Entity
            key={c.id}
            kind={c.open ? "chestOpen" : "chest"}
            e={{ id: c.id, x: c.x, y: c.y, dx: 0, dy: 0, facing: "down" }}
          />
        ))}

        {/* night overlay 3 cấp (audit M4) — KHÔNG blur, giữ crisp */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `rgba(21,27,56,${NIGHT_OPACITY[snapshot.alert.level]})` }}
        />
      </div>
    </div>
  );
}
