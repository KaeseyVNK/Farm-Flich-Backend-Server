/**
 * Raid map biome config (phase 7). 3 biome: beach/farm/forest.
 * Config-driven alertMod override (KHÔNG hardcode room). Per-farm seed hash(farmId+mapId) (anti replay).
 * ponytail: WATER/BRIDGE BFS = roadmap; MVP terrain solid pattern giữ.
 */
export type BiomeId = "beach" | "farm" | "forest";

export interface BiomeConfig {
  biome: BiomeId;
  visionMul: number; // DOG_VISION_TILES multiplier
  hearingMul: number;
  decayMul: number; // alert decay rate multiplier
  label: string;
}

export const BIOMES: Record<BiomeId, BiomeConfig> = {
  beach: { biome: "beach", visionMul: 1.4, hearingMul: 1.0, decayMul: 0.8, label: "Biển" },
  farm: { biome: "farm", visionMul: 1.0, hearingMul: 1.0, decayMul: 1.0, label: "Ruộng" },
  forest: { biome: "forest", visionMul: 0.6, hearingMul: 1.0, decayMul: 1.2, label: "Rừng" },
};

export const DEFAULT_BIOME: BiomeConfig = BIOMES.farm;

export function getBiome(mapId: string): BiomeConfig {
  return BIOMES[mapId as BiomeId] ?? DEFAULT_BIOME;
}

/** Assert alertMod trong range [0.3, 2.0] (chặn config độc hại). */
export function assertMapConfig(c: BiomeConfig): void {
  const valid = ["beach", "farm", "forest"].includes(c.biome);
  const inRange = (v: number) => v >= 0.3 && v <= 2.0;
  if (!valid || !inRange(c.visionMul) || !inRange(c.hearingMul) || !inRange(c.decayMul)) {
    throw new Error(`invalid biome config: ${c.biome}`);
  }
}

/** Per-farm seed stable (hash farmId + mapId) — anti replay cheese. */
export function mapSeed(farmId: string, mapId: string): string {
  return `${farmId}:${mapId}`;
}

/**
 * Blood-moon biome override (phase 7 blood-moon raid mechanic).
 * Áp blood-moon effects lên biome config — dog AI mạnh hơn:
 * - visionMul ×1.5 (dog nhìn xa hơn)
 * - hearingMul ×1.5 (dog nghe xa hơn)
 * - decayMul ×0.9 (alert decay chậm hơn = dog cảnh giác dai hơn)
 *
 * Server copy của bloodMoonEffects (client `src/lib/game/story/blood-moon.ts`) —
 * raid-server isolated (không import client, pattern constants.ts). Deterministic
 * pure function → replay re-sim truyền cùng flag cho cùng biome.
 */
export function bloodMoonBiome(base: BiomeConfig): BiomeConfig {
  return {
    ...base,
    visionMul: base.visionMul * 1.5,
    hearingMul: base.hearingMul * 1.5,
    decayMul: base.decayMul * 0.9,
  };
}
