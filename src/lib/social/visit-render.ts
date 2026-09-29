// W4 — pure mapper cho VisitFarmCanvas (SVG schematic, read-only).
// Tách khỏi component để unit test không cần jsdom render.

/** Decor rect render model — footprint theo rot (90/270 swap w↔h, parity W3). */
export interface DecorRect {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  /** Chữ cái đầu tên món — nhãn schematic 1 ký tự. */
  label: string;
}

/** Màu theo tier — cùng palette gỗ/đất của canvas. */
export const DECOR_TIER_COLORS: Record<string, string> = {
  basic: "#8a6238",
  nice: "#d9a441",
  fancy: "#b06ad9",
};

/** Tint phủ toàn map theo mùa (RGBA thưa — không che terrain). */
export const SEASON_TINT: Record<string, string> = {
  Spring: "rgba(140, 220, 120, 0.06)",
  Summer: "rgba(255, 220, 90, 0.10)",
  Fall: "rgba(217, 122, 42, 0.14)",
  Winter: "rgba(168, 200, 255, 0.18)",
};

export function seasonTint(season: string | undefined): string | null {
  return season ? SEASON_TINT[season] ?? null : null;
}

interface RawPlaced {
  uid?: string;
  defId?: string;
  tx?: number;
  ty?: number;
  rot?: number;
}

interface RawDef {
  id: string;
  name: string;
  w: number;
  h: number;
  tier: string;
}

/**
 * placedDecor (server JSONB, đã sanitize hydrate client) → rects SVG.
 * Bỏ entry hỏng (defId lạ / tọa độ NaN) — render không crash vì 1 row lạ.
 */
export function decorRects(
  placed: unknown,
  defs: readonly RawDef[],
  cell: number,
): DecorRect[] {
  if (!Array.isArray(placed)) return [];
  const byId = new Map(defs.map((d) => [d.id, d]));
  const out: DecorRect[] = [];
  for (const raw of placed as RawPlaced[]) {
    if (!raw || typeof raw !== "object") continue;
    const def = byId.get(String(raw.defId));
    if (!def) continue;
    const tx = Number(raw.tx);
    const ty = Number(raw.ty);
    if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0) continue;
    const rot = raw.rot ?? 0;
    const swap = rot === 90 || rot === 270;
    const w = (swap ? def.h : def.w) * cell;
    const h = (swap ? def.w : def.h) * cell;
    out.push({
      key: String(raw.uid ?? `${raw.defId}-${tx}-${ty}`),
      x: tx * cell,
      y: ty * cell,
      w,
      h,
      fill: DECOR_TIER_COLORS[def.tier] ?? DECOR_TIER_COLORS.basic,
      label: def.name.charAt(0).toUpperCase(),
    });
  }
  return out;
}

// ── W4 audit-gap: cá ao (chấm trên ô nước + tooltip tên) ───────────────────────

/** Chấm cá ao render model — đặt trên ô nước, tooltip tên + số ngày nuôi. */
export interface PondFishDot {
  key: string;
  x: number;
  y: number;
  label: string;
}

interface RawPondFish {
  fishId?: unknown;
  daysGrown?: unknown;
}

interface FishNameDef {
  id: string;
  name: string;
}

/**
 * pondFish (server JSONB farm.pondFish) → chấm SVG trên các ô nước.
 * Rải thứ tự deterministic theo mảng (mỗi con 1 ô riêng — thừa bị bỏ),
 * row hỏng / fishId lạ bỏ qua như decorRects (render không crash).
 */
export function pondFishDots(
  terrain: readonly number[] | undefined,
  pondFish: unknown,
  cell: number,
  cols: number,
  waterTile: number,
  fishDefs: readonly FishNameDef[],
): PondFishDot[] {
  if (!Array.isArray(pondFish) || !terrain) return [];
  const byId = new Map(fishDefs.map((f) => [f.id, f]));
  // Chỉ quét đủ số ô nước cần dùng — map lớn, cá cap nhỏ (POND_FISH_CAP).
  const waterIdx: number[] = [];
  for (let i = 0; i < terrain.length && waterIdx.length < pondFish.length; i++) {
    if (terrain[i] === waterTile) waterIdx.push(i);
  }
  const out: PondFishDot[] = [];
  let n = 0;
  for (const raw of pondFish as RawPondFish[]) {
    const idx = waterIdx[n];
    if (!raw || typeof raw !== "object" || idx === undefined) continue;
    const def = byId.get(String(raw.fishId));
    if (!def) continue;
    const days = Number(raw.daysGrown) || 0;
    out.push({
      key: `pf${n}`,
      x: (idx % cols) * cell + cell / 2,
      y: Math.floor(idx / cols) * cell + cell / 2,
      label: `${def.name} · ${days} ngày`,
    });
    n++;
  }
  return out;
}
