"use client";

import { useEffect, useRef, useState } from "react";
import type { RaidSnapshot } from "@/lib/raid/types";
import { mapRaidEntity } from "@/components/raid/raid-display-mapper";
import { Play, Pause } from "lucide-react";

/**
 * ReplayCanvasPlayer (phase 9 F9.7) — play/pause + scrub timeline + canvas render 10Hz.
 * Owner-only (audit M9) — authz check server-side ở /replay endpoint.
 * Reuse RaidCanvas-style pixel render.
 */
export function ReplayCanvasPlayer({ snaps }: { snaps: RaidSnapshot[] }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snap = snaps[Math.min(idx, snaps.length - 1)] ?? null;

  // Play loop 10Hz
  useEffect(() => {
    if (!playing) return;
    rafRef.current = setInterval(() => {
      setIdx((i) => {
        if (i >= snaps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 100);
    return () => {
      if (rafRef.current) clearInterval(rafRef.current);
    };
  }, [playing, snaps.length]);

  // Render canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !snap) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const tile = 24;
    // biome bg
    const bg = snap.mapBiome === "beach" ? "#e8d8a8" : snap.mapBiome === "forest" ? "#2d4a1f" : "#5a8e44";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    // grid
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    for (let x = 0; x <= c.width; x += tile) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, c.height);
      ctx.stroke();
    }
    for (let y = 0; y <= c.height; y += tile) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(c.width, y);
      ctx.stroke();
    }
    // Entities — shared raid-display-mapper (non-emoji pixel primitives, same spec as live
    // raid canvas). Chests use ch.x/ch.y (audit: no more hardcoded overlap point).
    const kSize = (p: "disc" | "square" | "crate") => (p === "disc" ? 20 : 18);
    const drawKind = (kind: "raider" | "dog" | "chest-closed" | "chest-open", x: number, y: number) => {
      const spec = mapRaidEntity(kind);
      ctx.fillStyle = spec.color;
      ctx.strokeStyle = spec.stroke;
      const s = kSize(spec.primitive);
      ctx.beginPath();
      if (spec.primitive === "disc") {
        ctx.arc(x * tile + tile / 2, y * tile + tile / 2, s / 2, 0, Math.PI * 2);
      } else {
        const ins = (tile - s) / 2;
        ctx.rect(x * tile + ins, y * tile + ins, s, s);
      }
      ctx.fill();
      // crate cross for chests (visual + non-colour cue for open/closed)
      if (spec.primitive === "crate") {
        ctx.beginPath();
        const ins = (tile - s) / 2;
        ctx.moveTo(x * tile + ins, y * tile + ins);
        ctx.lineTo(x * tile + ins + s, y * tile + ins + s);
        ctx.moveTo(x * tile + ins + s, y * tile + ins);
        ctx.lineTo(x * tile + ins, y * tile + ins + s);
        ctx.stroke();
      }
      ctx.stroke();
    };
    snap.chests.forEach((ch) => drawKind(ch.open ? "chest-open" : "chest-closed", ch.x, ch.y));
    snap.dogs.forEach((d) => drawKind("dog", d.x, d.y));
    drawKind("raider", snap.you.x, snap.you.y);
  }, [snap]);

  if (!snap) {
    return <p className="text-[var(--alarm)]">Không có dữ liệu replay.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="f-num flex items-center gap-3 text-sm">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-1.5 rounded bg-[var(--mystic)] px-3 py-1 font-bold text-white"
          aria-label={playing ? "Tạm dừng replay" : "Phát replay"}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <span>
          Tick {snap.tick} ({idx + 1}/{snaps.length})
        </span>
        <span className={snap.lockdown ? "text-[var(--alarm)]" : ""}>
          {snap.lockdown ? "LOCKDOWN" : `Alert: ${snap.alert.level} (${snap.alert.score})`}
        </span>
      </div>
      <canvas ref={canvasRef} width={720} height={528} className="rounded border-2 border-black/40" />
      <input
        type="range"
        min={0}
        max={snaps.length - 1}
        value={idx}
        onChange={(e) => {
          setPlaying(false);
          setIdx(Number(e.target.value));
        }}
        className="w-full"
      />
    </div>
  );
}
