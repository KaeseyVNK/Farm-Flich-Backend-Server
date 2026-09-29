import type { RaidEntity } from "@/lib/raid/types";

/**
 * Entity interpolation (audit C3, red-team #12).
 * Snapshot 5Hz — lerp vị trí theo velocity (dx,dy) giữa 2 snapshot để dog không "bước" qua tường.
 * KHÔNG prediction phức tạp — extrapolate nhẹ theo hướng server gửi.
 */

/**
 * Interpolate 1 entity từ snapshot cũ → mới với alpha [0,1].
 * alpha = (now - prevSnapshotTime) / (curSnapshotTime - prevSnapshotTime).
 * Khi alpha > 1 (chờ snapshot mới), extrapolate theo velocity (giới hạn để không xuyên tường).
 */
export function interpolateEntity(prev: RaidEntity, cur: RaidEntity, alpha: number): RaidEntity {
  const a = Math.max(0, alpha);
  // Linear lerp clamp tại cur (alpha ≤ 1) — KHÔNG vượt cur theo trục tọa độ.
  const lin = Math.min(1, a);
  const x = prev.x + (cur.x - prev.x) * lin;
  const y = prev.y + (cur.y - prev.y) * lin;
  // Extrapolate nhẹ THEO VELOCITY khi alpha > 1 (cap 0.5 tile để không xuyên wall).
  const extra = Math.max(0, a - 1);
  const xExt = x + cur.dx * Math.min(extra, 0.5);
  const yExt = y + cur.dy * Math.min(extra, 0.5);
  return { ...cur, x: xExt, y: yExt };
}

/** Tính alpha giữa 2 timestamp. Clamp [0, 1.5] (cho phép extrapolate nhẹ). */
export function computeAlpha(prevTs: number, curTs: number, now: number): number {
  if (curTs <= prevTs) return 1;
  const alpha = (now - prevTs) / (curTs - prevTs);
  return Math.max(0, Math.min(1.5, alpha));
}
