// Wave 1 P3 — pre-cast check (pure). FarmScene (P4) gọi trước khi mở session.
// V4 (validation): silo đầy + túi đầy → chặn TRƯỚC cast — nhất quán harvest
// gate, không bao giờ mất cá sau khi câu xong mới phát hiện đầy.
import { waterTypeAt, type WaterZone } from "@/lib/game/fish-catalog";
import { T } from "@/lib/game/constants";
import { getItem } from "@/lib/game/data";
import type { ZoneId } from "@/lib/game/zones/types";

/** Bán kính tìm nước quanh player (Chebyshev) — đứng cách nước ≤2 tile là câu được. */
export const FISH_REACH = 2;

const ROD_ENERGY = getItem("fishing_rod")?.toolEnergy ?? 2;

export interface FishableArgs {
  zone: ZoneId;
  x: number;
  y: number;
  /** Đọc terrain tile (x,y) — truyền hàm để pure, không import store. */
  terrainAt: (x: number, y: number) => number;
  energy: number;
  siloFull: boolean;
  bagFull: boolean;
  modalOpen: boolean;
}

export type FishableResult =
  | { ok: true; waterType: WaterZone }
  | { ok: false; reason: "no-water" | "energy" | "full" | "modal" };

export function tryStartFishing(a: FishableArgs): FishableResult {
  if (a.modalOpen) return { ok: false, reason: "modal" };
  if (a.energy < ROD_ENERGY) return { ok: false, reason: "energy" };
  if (a.siloFull && a.bagFull) return { ok: false, reason: "full" };
  // Tìm ô NƯỚC thật (T.WATER) trong bán kính — waterTypeAt phân loại pond/lake/sea.
  for (let dy = -FISH_REACH; dy <= FISH_REACH; dy++) {
    for (let dx = -FISH_REACH; dx <= FISH_REACH; dx++) {
      const tx = a.x + dx;
      const ty = a.y + dy;
      if (a.terrainAt(tx, ty) !== T.WATER) continue;
      const w = waterTypeAt(a.zone, tx, ty);
      if (w) return { ok: true, waterType: w };
    }
  }
  return { ok: false, reason: "no-water" };
}

/** Ô nước câu được gần nhất (theo khoảng cách Chebyshev) — scene dùng đặt bobber. */
export function nearestWaterTile(
  a: Pick<FishableArgs, "zone" | "x" | "y" | "terrainAt">,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let dy = -FISH_REACH; dy <= FISH_REACH; dy++) {
    for (let dx = -FISH_REACH; dx <= FISH_REACH; dx++) {
      const tx = a.x + dx;
      const ty = a.y + dy;
      if (a.terrainAt(tx, ty) !== T.WATER) continue;
      if (!waterTypeAt(a.zone, tx, ty)) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < bestD) {
        bestD = d;
        best = { x: tx, y: ty };
      }
    }
  }
  return best;
}
