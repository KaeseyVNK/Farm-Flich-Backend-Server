// Wave 1 P1 — bảng cá launch (12 con, data-driven pattern farm-catalog).
// Pure module: không import store/Phaser. UI + fishing-sm + shop cùng đọc đây.
// V1 superseded: Icons/Fish có River+Sea icon unique → 12 cá 12 icon riêng.
import {
  isFarmLakeTile,
  isFarmPondTile,
  isFarmRiverTile,
} from "@/lib/game/farm-scenery-layout";
import type { ZoneId } from "@/lib/game/zones/types";

export type WaterZone = "pond" | "lake" | "sea";
export type FishRarity = "common" | "medium" | "rare";

export interface FishDef {
  id: string;
  name: string;
  zone: WaterZone;
  rarity: FishRarity;
  unlockLevel: number;
  sellPrice: number;
  /** Energy hồi khi ăn sống (W2 nấu ăn sẽ nhân倍). */
  energy: number;
}

/** 12 cá launch — mỗi vùng 4, mỗi rarity 4, unlock 1–5 (single-level V3). */
export const FISH: readonly FishDef[] = [
  // ── Ao (farm pond) ──────────────────────────────────────────────────────────
  { id: "sunfish", name: "Cá Mặt Trời", zone: "pond", rarity: "common", unlockLevel: 1, sellPrice: 25, energy: 12 },
  { id: "perch", name: "Cá Rô", zone: "pond", rarity: "common", unlockLevel: 1, sellPrice: 30, energy: 12 },
  { id: "carp", name: "Cá Chép", zone: "pond", rarity: "medium", unlockLevel: 2, sellPrice: 60, energy: 20 },
  { id: "chub", name: "Cá Chub", zone: "pond", rarity: "medium", unlockLevel: 2, sellPrice: 65, energy: 20 },
  // ── Hồ (farm lake — wilderness south-west) ─────────────────────────────────
  { id: "bass", name: "Cá Vược", zone: "lake", rarity: "common", unlockLevel: 1, sellPrice: 35, energy: 14 },
  { id: "pike", name: "Cá Pike", zone: "lake", rarity: "medium", unlockLevel: 3, sellPrice: 85, energy: 22 },
  { id: "tiger_trout", name: "Cá Hồi Vằn", zone: "lake", rarity: "rare", unlockLevel: 4, sellPrice: 160, energy: 30 },
  { id: "sturgeon", name: "Cá Tầm", zone: "lake", rarity: "rare", unlockLevel: 4, sellPrice: 180, energy: 30 },
  // ── Biển (beach rows 0–5) ──────────────────────────────────────────────────
  { id: "anchovy", name: "Cá Cơm", zone: "sea", rarity: "common", unlockLevel: 1, sellPrice: 25, energy: 10 },
  { id: "sardine", name: "Cá Mòi", zone: "sea", rarity: "common", unlockLevel: 2, sellPrice: 40, energy: 14 },
  { id: "red_snapper", name: "Cá Hồng", zone: "sea", rarity: "medium", unlockLevel: 3, sellPrice: 90, energy: 24 },
  { id: "tuna", name: "Cá Ngừ", zone: "sea", rarity: "rare", unlockLevel: 5, sellPrice: 220, energy: 32 },
];

/** Cá lạ → 99 (pattern seedUnlockLevel — khoá cứng khi thiếu data). */
export function fishUnlockLevel(id: string): number {
  return FISH.find((f) => f.id === id)?.unlockLevel ?? 99;
}

// ── Wave 1 P5: cá bột (fry) — nuôi trong ao farm ────────────────────────────

export interface FryDef {
  /** itemId trong túi: fry_<fishId>. */
  itemId: string;
  /** Cá trưởng thành khi thu hoạch. */
  fishId: string;
  name: string;
  /** Số ngày lớn (qua newDay). */
  growDays: number;
  /** Giá mua ở shop (~60% sellPrice cá trưởng thành). */
  price: number;
  sellPrice: number;
}

/** 3 loại fry ao (sunfish/perch/carp) — plan P5. */
export const FRY: readonly FryDef[] = [
  { itemId: "fry_sunfish", fishId: "sunfish", name: "Cá Bột Mặt Trời", growDays: 2, price: 15, sellPrice: 25 },
  { itemId: "fry_perch", fishId: "perch", name: "Cá Bột Rô", growDays: 2, price: 18, sellPrice: 30 },
  { itemId: "fry_carp", fishId: "carp", name: "Cá Bột Chép", growDays: 3, price: 36, sellPrice: 60 },
];

export function isFryItemId(itemId: string): boolean {
  return FRY.some((f) => f.itemId === itemId);
}

/** Số ngày lớn của fry (itemId); fry lạ → Infinity (không bao giờ lớn). */
export function fryGrowDays(itemId: string): number {
  return FRY.find((f) => f.itemId === itemId)?.growDays ?? Infinity;
}

/** Cá câu được tại vùng + level hiện tại (chưa tính tỉ lệ roll — thuộc P2). */
export function fishForZone(zone: WaterZone, level: number): FishDef[] {
  return FISH.filter((f) => f.zone === zone && f.unlockLevel <= level);
}

/** Biển (beach) — 6 hàng biển phía bắc. */
const SEA_ROWS = 6;

/**
 * Vùng nước tại ô (zone, x, y) — pond/lake/sea hoặc null.
 */
export function waterTypeAt(zone: ZoneId, x: number, y: number): WaterZone | null {
  if (zone === "farm") {
    if (isFarmPondTile(x, y)) return "pond";
    if (isFarmLakeTile(x, y)) return "lake";
    if (isFarmRiverTile(x, y)) return "lake";
    return null;
  }
  if (zone === "beach" && y < SEA_ROWS) return "sea";
  return null;
}
