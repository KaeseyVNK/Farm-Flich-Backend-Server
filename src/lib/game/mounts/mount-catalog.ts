// Wave 6 — Mount catalog (pure). §11: mount CHỈ tăng tốc độ — không thêm teleport.
// §3: farm toàn cảnh 1 màn hình — mount giá trị ngoài farm/đường dài, KHÔNG dùng
// được trong house; KHÔNG tốn energy (MAX stamina chưa có — KISS theo plan).
import { ASSET_MANIFEST } from "@/lib/game/assets/asset-manifest";

export type MountId = "horse" | "bicycle";

export interface MountDef {
  id: MountId;
  name: string;
  price: number; // vàng mua shop
  /** Nhân lên DEFAULT_KINETICS.walkSpeed (120) / runSpeed (190). */
  walkMult: number;
  runMult: number;
  unlockLevel: number;
  /** Sheet keys (ASSET_MANIFEST) — walk dùng lại run sheet chạy frameRate thấp (pack không có walk riêng). */
  sheets: { idle: string; walk: string; run: string };
  /** Frame 32 cao (rider + ngựa) thay vì 32×32 — scene slice riêng. */
  frameH: number;
  framesPerDir: number;
  /** Icon HUD (emoji — HUD chip + shop). */
  icon: string;
}

export const MOUNTS: MountDef[] = [
  {
    id: "horse",
    name: "Ngựa",
    // W9P4 economy pass: 2500 → 6000 (target 8–12 ngày @ ~800g/ngày).
    price: 6000,
    walkMult: 1.5,
    runMult: 1.47,
    unlockLevel: 4,
    sheets: { idle: "char.alex.horse.idle", walk: "char.alex.horse.run", run: "char.alex.horse.run" },
    frameH: 48,
    framesPerDir: 6,
    icon: "🐴",
  },
  {
    id: "bicycle",
    name: "Xe đạp",
    // W9P4 economy pass: 800 → 1500 (target 2–3 ngày — tránh mua ngày 1–2).
    price: 1500,
    walkMult: 1.25,
    runMult: 1.24,
    unlockLevel: 2,
    sheets: { idle: "char.alex.bicycle.run", walk: "char.alex.bicycle.run", run: "char.alex.bicycle.run" },
    frameH: 32,
    framesPerDir: 4,
    icon: "🚲",
  },
];

export function mountById(id: string): MountDef | undefined {
  return MOUNTS.find((m) => m.id === id);
}

export type MountRefuseReason = "unknown" | "level" | "zone" | "tool" | "fishing";

export interface MountCheck {
  ok: boolean;
  reason?: MountRefuseReason;
}

/**
 * Có được lên/mount không? Thứ tự check: unknown → level → zone (house cấm) →
 * tool đang cầm → đang câu cá. Caller notify theo reason.
 */
export function canMount(
  mountId: string,
  level: number,
  zone: string,
  holdingTool: boolean,
  fishing: boolean,
): MountCheck {
  const def = mountById(mountId);
  if (!def) return { ok: false, reason: "unknown" };
  if (level < def.unlockLevel) return { ok: false, reason: "level" };
  if (zone === "house") return { ok: false, reason: "zone" };
  if (holdingTool) return { ok: false, reason: "tool" };
  if (fishing) return { ok: false, reason: "fishing" };
  return { ok: true };
}
