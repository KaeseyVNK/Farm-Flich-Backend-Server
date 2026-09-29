import { BEACH_ZONE } from "./beach";
import { CAVE_ZONE } from "./cave";
import { DEEPFOREST_ZONE } from "./deepforest";
import { FARM_ZONE } from "./farm";
import { HOUSE_ZONE } from "./house";
import { VILLAGE_ZONE } from "./village";
// Side-effect: registers the village + beach + house ZoneScenery into the
// scenery registry (layout modules import the registry index — no cycle back).
import "@/lib/game/scenery/village-layout";
import "@/lib/game/scenery/beach-layout";
import "@/lib/game/scenery/house-interior-layout";
import type { TilePos, Warp, ZoneId, ZoneLayout } from "./types";

export type { TilePos, Warp, ZoneId, ZoneLayout };
export { FARM_ZONE, HOUSE_ZONE, VILLAGE_ZONE, CAVE_ZONE, BEACH_ZONE, DEEPFOREST_ZONE };

const ZONES: Record<ZoneId, ZoneLayout> = {
  farm: FARM_ZONE,
  house: HOUSE_ZONE,
  village: VILLAGE_ZONE,
  cave: CAVE_ZONE,
  beach: BEACH_ZONE,
  deepforest: DEEPFOREST_ZONE,
};

export function getZone(id: ZoneId): ZoneLayout {
  return ZONES[id];
}

export function findWarp(layout: ZoneLayout, x: number, y: number): Warp | undefined {
  return layout.warps.find((w) => w.x === x && w.y === y);
}

export function isBedTile(layout: ZoneLayout, x: number, y: number): boolean {
  return layout.beds.some((b) => b.x === x && b.y === y);
}

export function isWellTile(layout: ZoneLayout, x: number, y: number): boolean {
  return layout.wells.some((w) => w.x === x && w.y === y);
}

export function isPondTile(layout: ZoneLayout, x: number, y: number): boolean {
  return layout.ponds.some((p) => p.x === x && p.y === y);
}

export const ZONE_IDS: ZoneId[] = ["farm", "house", "village", "cave", "beach", "deepforest"];
