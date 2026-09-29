"use client";

import { MAP_COLS, MAP_ROWS, T } from "@/lib/game/constants";
import { DECOR } from "@/lib/game/decor/decor-catalog";
import { FISH } from "@/lib/game/fish-catalog";
import { decorRects, pondFishDots, seasonTint } from "@/lib/social/visit-render";

/**
 * Visit-farm canvas (phase 5 F5.5 + W4 upgrade). READ-ONLY — không có input handlers.
 * Render terrain + crops + objects + placedDecor W3 + season tint từ safe keys
 * (KHÔNG Inventory/gold/energy). KHÔNG Phaser — SVG schematic nhẹ cho visit.
 */

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

interface Crop {
  dead?: boolean;
}
interface PlacedObject {
  type?: string;
}
/** Shape client gửi qua FarmSaveData.placedDecor (đã sanitize hydrate). */
interface PlacedDecorRow {
  uid?: string;
  defId?: string;
  tx?: number;
  ty?: number;
  rot?: number;
}

export function VisitFarmCanvas({
  terrain,
  crops,
  objects,
  placedDecor,
  pondFish,
  season,
}: {
  terrain: number[];
  crops?: Record<string, Crop>;
  objects?: Record<string, PlacedObject>;
  placedDecor?: PlacedDecorRow[];
  /** W4 audit-fix: cá ao của bạn — chấm trên ô nước + tooltip tên/ngày. */
  pondFish?: unknown;
  /** gameMeta.season của farm bạn — phủ tint mùa (W4). */
  season?: string;
}) {
  const cell = 14;
  const w = MAP_COLS * cell;
  const h = MAP_ROWS * cell;
  const decor = decorRects(placedDecor, DECOR, cell);
  const fishDots = pondFishDots(terrain, pondFish, cell, MAP_COLS, T.WATER, FISH);
  const tint = seasonTint(season);

  return (
    <div className="overflow-hidden rounded-xl border-2 border-[#4a3119] bg-[#d7e8c8] p-2" data-testid="visit-farm-canvas">
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" style={{ imageRendering: "pixelated" }}>
        {terrain.map((t, i) => {
          const x = (i % MAP_COLS) * cell;
          const y = Math.floor(i / MAP_COLS) * cell;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={cell}
              height={cell}
              fill={TILE_COLORS[t] ?? "#6fb84a"}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={0.5}
            />
          );
        })}
        {crops &&
          Object.entries(crops).map(([k, c]) => {
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
        {objects &&
          Object.entries(objects).map(([k, o]) => {
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
        {/* W4 audit-fix: cá ao — chấm vàng trên ô nước, hover tooltip tên + ngày nuôi
            (SVG <title> = native tooltip, không cần JS hover state). */}
        {fishDots.map((f) => (
          <circle key={f.key} cx={f.x} cy={f.y} r={cell / 4} fill="#f0c964" stroke="rgba(0,0,0,0.45)" strokeWidth={0.8}>
            <title>{f.label}</title>
          </circle>
        ))}
        {/* W4: decor đã đặt — rect màu tier + nhãn 1 ký tự (fancy tím/nice vàng/basic nâu) */}
        {decor.map((d) => (
          <g key={`d${d.key}`}>
            <rect x={d.x + 1} y={d.y + 1} width={d.w - 2} height={d.h - 2} rx={2} fill={d.fill} stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
            <text
              x={d.x + d.w / 2}
              y={d.y + d.h / 2 + 3}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill="#fffaf0"
              style={{ pointerEvents: "none" }}
            >
              {d.label}
            </text>
          </g>
        ))}
        {tint ? <rect x={0} y={0} width={w} height={h} fill={tint} style={{ pointerEvents: "none" }} /> : null}
      </svg>
    </div>
  );
}
