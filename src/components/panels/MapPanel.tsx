"use client";

import { useFarmStore } from "@/store/farmStore";
import { useWorldStore } from "@/store/worldStore";
import { MAP_COLS, MAP_ROWS, T, SEASON_THEME } from "@/lib/game/constants";
import { useGameStore } from "@/store/gameStore";
import { MapPin, Compass } from "lucide-react";
import { ZONE_IDS, getZone, type ZoneId } from "@/lib/game/zones";

const ZONE_LABELS: Record<ZoneId, string> = {
  farm: "Nông trại Tidecrest",
  house: "Nhà",
  village: "Làng",
  cave: "Hang cũ",
  beach: "Bãi biển",
  deepforest: "Rừng sâu",
};

const TILE_COLORS: Record<number, string> = {
  [T.GRASS]: "#6fb84a",
  [T.GRASS_FLOWER]: "#7cc36b",
  [T.PATH]: "#c9a86a",
  [T.WATER]: "#5aa9d9",
  [T.TILLED]: "#7a4f2b",
  [T.TILLED_WET]: "#5a3a1f",
  [T.TREE]: "#2f6b32",
  [T.STUMP]: "#8a6238",
  [T.ROCK]: "#9a9a9a",
  [T.STONE_EMPTY]: "#c0c0c0",
  [T.FENCE]: "#8a6238",
  [T.FLOWER_BUSH]: "#d9694e",
  [T.SAND]: "#e8d6a8",
  [T.BRIDGE]: "#8a6238",
};

export function MapPanel() {
  const terrain = useFarmStore((s) => s.terrain);
  const crops = useFarmStore((s) => s.crops);
  const objects = useFarmStore((s) => s.objects);
  const forage = useFarmStore((s) => s.forage);
  const season = useGameStore((s) => s.season);
  const zone = useWorldStore((s) => s.zone);
  const theme = SEASON_THEME[season];

  const cell = 14;
  const w = MAP_COLS * cell;
  const h = MAP_ROWS * cell;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <Compass className="h-4 w-4" /> Bản đồ Tidecrest
        </h3>
        <p className="text-xs font-medium text-[#5a4a36]">
          Nhìn từ trên cao nông trại Tidecrest. Đi bộ qua cửa, cổng làng, miệng hang và đường biển.
        </p>
      </div>

      {/* Minimap */}
      <div
        className="overflow-hidden rounded-xl border-2 border-[#4a3119] p-2"
        style={{ background: theme.sky }}
      >
        <div
          className="relative mx-auto"
          style={{ width: w, height: h, maxWidth: "100%" }}
        >
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="block h-auto w-full"
            style={{ imageRendering: "pixelated" }}
          >
            {/* tiles */}
            {terrain.map((t, i) => {
              const x = (i % MAP_COLS) * cell;
              const y = Math.floor(i / MAP_COLS) * cell;
              const color = TILE_COLORS[t] ?? "#6fb84a";
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  fill={color}
                  stroke="rgba(0,0,0,0.08)"
                  strokeWidth={0.5}
                />
              );
            })}
            {/* crops */}
            {Object.entries(crops).map(([k, c]) => {
              const i = Number(k);
              const x = (i % MAP_COLS) * cell;
              const y = Math.floor(i / MAP_COLS) * cell;
              return (
                <circle
                  key={`c${k}`}
                  cx={x + cell / 2}
                  cy={y + cell / 2}
                  r={cell / 3}
                  fill={c.dead ? "#7a5230" : "#3a8a2a"}
                />
              );
            })}
            {/* placed objects */}
            {Object.entries(objects).map(([k, o]) => {
              const i = Number(k);
              const x = (i % MAP_COLS) * cell;
              const y = Math.floor(i / MAP_COLS) * cell;
              return (
                <rect
                  key={`o${k}`}
                  x={x + 2}
                  y={y + 2}
                  width={cell - 4}
                  height={cell - 4}
                  fill={o.type === "fence" ? "#8a6238" : "#5aa9d9"}
                />
              );
            })}
            {/* forage */}
            {Object.entries(forage).map(([k]) => {
              const i = Number(k);
              const x = (i % MAP_COLS) * cell;
              const y = Math.floor(i / MAP_COLS) * cell;
              return (
                <circle
                  key={`f${k}`}
                  cx={x + cell / 2}
                  cy={y + cell / 2}
                  r={2}
                  fill="#e7b94e"
                />
              );
            })}
          </svg>
        </div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <MapPin className="h-4 w-4" /> Năm vùng (đi bộ)
        </h3>
        <p className="mb-2 text-[11px] font-medium text-[#6b5b45]">
          Đang ở: <strong>{zone}</strong>
        </p>
        <div className="grid grid-cols-1 gap-2">
          {ZONE_IDS.map((id) => {
            const z = getZone(id);
            return (
              <div
                key={id}
                className="flex items-center gap-3 rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-2.5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4] text-xs font-bold text-[#6b4a2b]">
                  {id.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-[#3b2f23]">{ZONE_LABELS[id]}</p>
                  <p className="text-[11px] font-medium text-[#6b5b45]">
                    {id === "farm" ? "Đi bộ qua cửa, cổng, hang, biển" : (z.warps[0]?.label ?? "")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
