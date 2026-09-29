// Asset manifest entry type. Contract: implementation-handoff-contract §Asset contract.
//
// Phase 1 evolution (additive): keep `key`/`src`/`dest` stable and required; add the
// readiness state machine + provenance + technical metadata as OPTIONAL fields. Curated
// Farm RPG pack entries are stamped `approved` with known license/credit at module load.
// Newly approved runtime assets MUST populate the metadata; `placeholder`/`blocked` keep
// a documented crisp fallback rather than pretending the real asset exists.

/** Readiness state machine — see verification-and-rollout-matrix §Required readiness. */
export type AssetReadiness = "approved" | "placeholder" | "blocked";

/**
 * Semantic asset family. Drives the documented fallback shape when an asset is not yet
 * approved (a tile falls back to a flat tile rect, a crop to a stage glyph, etc.).
 */
export type AssetKind =
  | "tile"
  | "crop"
  | "character"
  | "npc"
  | "animal"
  | "enemy"
  | "object"
  | "item"
  | "tool"
  | "ui"
  | "raid";

/** Public-safe provenance. Never store raw pack/purchase material or credentials here. */
export interface AssetProvenance {
  /** Curated pack or generator name. */
  pack: string;
  /** Public license identifier (e.g. "CC0", "CC-BY-4.0", pack terms summary). */
  license: string;
  /** Attribution credit string. */
  credit: string;
}

export interface AssetEntry {
  /** Stable programmatic id, e.g. "tile.grass.spring". Never a localized label. */
  key: string;
  /** Path inside the raw pack (source for copy-assets.mjs). */
  src: string;
  /** Destination under public/assets/farm-rpg/. */
  dest: string;
  /** Semantic family; inferred from key namespace if omitted. */
  kind?: AssetKind;
  /** Readiness gate; `approved` required to load as a real asset. */
  readiness?: AssetReadiness;
  /** Public-safe source/license/credit. Required for approved runtime assets. */
  provenance?: AssetProvenance;
  /** Actual source pixel dimensions, recorded after inspecting the file. */
  dimensions?: { width: number; height: number };
  /** Sprite sheet frame rectangle + grid, for atlas slicing. */
  frame?: { width: number; height: number; columns?: number; rows?: number };
  /** Normalized foot/contact point (0..1). */
  pivot?: { x: number; y: number };
}
