// Wave 3 P2 — placement decor thuần: validate ô đặt + footprint theo rot +
// sanitize hydrate. FarmScene/DecorMode build PlacementProbe từ store + layout.
import { T, SOLID_TILES } from "@/lib/game/constants";
import { decorById, type DecorDef } from "@/lib/game/decor/decor-catalog";

export interface PlacedDecor {
  uid: string;
  defId: string;
  zone: "farm" | "house";
  tx: number;
  ty: number;
  rot: 0 | 90 | 180 | 270;
  flip: boolean;
}

export interface PlacementProbe {
  /** Zone đang probe — rule PATH chỉ áp dụng farm (nhà sàn PATH = sàn nhà). */
  zone: "farm" | "house";
  cols: number;
  rows: number;
  terrainAt: (x: number, y: number) => number;
  /** True khi tile bị chặn bởi scenery có sẵn (không tính SOLID_TILES terrain). */
  solidAt: (x: number, y: number) => boolean;
  cropAt: (x: number, y: number) => boolean;
  warps: { x: number; y: number }[];
  decor: PlacedDecor[];
  /** Tile người chơi đang đứng — decor solid không được đè (tự nhốt chính mình). */
  playerAt?: { x: number; y: number };
}

export type PlaceResult = { ok: true } | { ok: false; reason: string };

/** Footprint hiệu dụng — rot 90/270 xoay w↔h; flip không đổi. */
export function footprintOf(def: DecorDef, rot: number, _flip = false): { w: number; h: number } {
  return rot === 90 || rot === 270 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

/** Chiếm chỗ không? (footprint phủ tile). */
function overlaps(fp: { w: number; h: number }, tx: number, ty: number, x: number, y: number): boolean {
  return x >= tx && x < tx + fp.w && y >= ty && y < ty + fp.h;
}

export function canPlaceDecor(
  def: DecorDef,
  tx: number,
  ty: number,
  rot: number,
  probe: PlacementProbe,
): PlaceResult {
  const fp = footprintOf(def, rot);
  if (tx < 0 || ty < 0 || tx + fp.w > probe.cols || ty + fp.h > probe.rows) {
    return { ok: false, reason: "bounds" };
  }
  // Decor solid không đè lên tile người chơi — đặt xong là tự nhốt (không thoát
  // được vì mọi hướng đi đều chạm footprint). Non-solid (bóng bay…) đi qua được.
  if (def.solid && probe.playerAt && overlaps(fp, tx, ty, probe.playerAt.x, probe.playerAt.y)) {
    return { ok: false, reason: "player" };
  }
  for (let y = ty; y < ty + fp.h; y++) {
    for (let x = tx; x < tx + fp.w; x++) {
      const t = probe.terrainAt(x, y);
      if (t === T.WATER) return { ok: false, reason: "water" };
      if (SOLID_TILES.has(t)) return { ok: false, reason: "solid" };
      if (probe.solidAt(x, y)) return { ok: false, reason: "solid" };
      if (probe.cropAt(x, y)) return { ok: false, reason: "crop" };
      // Decor solid không chặn PATH NGOÀI TRỜI (giữ lộ trình đi farm); trong nhà
      // PATH chính là sàn nhà — không áp rule (nếu không toàn bộ đồ đặc bỏ).
      if (def.zone === "farm" && def.solid && t === T.PATH) return { ok: false, reason: "path" };
      if (probe.warps.some((w) => w.x === x && w.y === y)) return { ok: false, reason: "warp" };
      if (probe.decor.some((d) => {
        const dfp = footprintOf(decorById(d.defId) ?? def, d.rot);
        return overlaps(dfp, d.tx, d.ty, x, y);
      })) {
        return { ok: false, reason: "decor" };
      }
    }
  }
  return { ok: true };
}

/** W3P3: tile có bị decor solid chặn không? (footprint theo rot; farm + house). */
export function decorSolidAt(placed: PlacedDecor[], zone: string, x: number, y: number): boolean {
  for (const d of placed) {
    if (d.zone !== zone) continue;
    const def = decorById(d.defId);
    if (!def || !def.solid) continue;
    const fp = footprintOf(def, d.rot);
    if (x >= d.tx && x < d.tx + fp.w && y >= d.ty && y < d.ty + fp.h) return true;
  }
  return false;
}

/** W3P4: decor phủ tile (x,y) trong zone — trả placement cuối cùng (topmost). */
export function decorAt(placed: PlacedDecor[], zone: string, x: number, y: number): PlacedDecor | null {
  let hit: PlacedDecor | null = null;
  for (const d of placed) {
    if (d.zone !== zone) continue;
    const def = decorById(d.defId);
    if (!def) continue;
    const fp = footprintOf(def, d.rot);
    if (x >= d.tx && x < d.tx + fp.w && y >= d.ty && y < d.ty + fp.h) hit = d;
  }
  return hit;
}

const VALID_ROT = new Set([0, 90, 180, 270]);
const ZONE_COLS: Record<"farm" | "house", number> = { farm: 60, house: 16 };
const ZONE_ROWS: Record<"farm" | "house", number> = { farm: 60, house: 12 };

/** Trust-boundary hydrate: bỏ defId lạ / tọa độ ngoài zone / rot lạ về 0, dedupe uid. */
export function sanitizePlacedDecor(list: unknown): PlacedDecor[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: PlacedDecor[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Partial<PlacedDecor>;
    if (typeof p.uid !== "string" || seen.has(p.uid)) continue;
    if (typeof p.defId !== "string" || !decorById(p.defId)) continue;
    if (p.zone !== "farm" && p.zone !== "house") continue;
    if (!Number.isInteger(p.tx) || !Number.isInteger(p.ty)) continue;
    const tx = p.tx as number;
    const ty = p.ty as number;
    if (tx < 0 || ty < 0 || tx >= ZONE_COLS[p.zone] || ty >= ZONE_ROWS[p.zone]) continue;
    seen.add(p.uid);
    out.push({
      uid: p.uid,
      defId: p.defId,
      zone: p.zone,
      tx,
      ty,
      rot: VALID_ROT.has(p.rot ?? -1) ? (p.rot as PlacedDecor["rot"]) : 0,
      flip: p.flip === true,
    });
  }
  return out;
}
