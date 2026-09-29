// Per-zone scenery registry + solid dispatch.
// The registry starts EMPTY — zone layout tasks (3+) self-register via
// registerZoneScenery so nothing needs to import back into this module.
// "farm" keeps a permanent fallback to isFarmScenerySolid because the farm
// is authored in farm-scenery-layout.ts, not as data-driven placements.
import { isFarmScenerySolid } from "@/lib/game/farm-scenery-layout";
import type { ZoneScenery } from "./types";

export type { SpritePlacement, ZoneScenery } from "./types";

const registry: Record<string, ZoneScenery> = {};

/** Zones self-register (avoids circular imports on this index). */
export function registerZoneScenery(zoneId: string, scenery: ZoneScenery): void {
  registry[zoneId] = scenery;
}

export function getZoneScenery(zoneId: string): ZoneScenery | undefined {
  return registry[zoneId];
}

/** Solid dispatch: registered zone data first, farm fallback second, else open. */
export function isZoneScenerySolid(zone: string, tx: number, ty: number): boolean {
  const scenery = registry[zone];
  if (scenery) return scenery.isSolid(tx, ty);
  if (zone === "farm") return isFarmScenerySolid(tx, ty);
  return false;
}
