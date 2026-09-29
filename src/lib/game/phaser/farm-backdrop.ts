// Collision for the authored spring-farm painting. Tilemap solids do not match
// that illustration, so movement uses these normalized boxes instead.

export interface BackdropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FARM_BACKDROP_KEY = "farm-backdrop";
export const FARM_BACKDROP_URL = "/assets/generated/spring-farm-overworld-v1.png";

/** Walkable yard inside the perimeter fence (normalized 0–1 of the painting). */
export const BACKDROP_YARD: BackdropRect = { x: 0.11, y: 0.16, w: 0.78, h: 0.72 };

/** Solid props in the painting — house, water, trees, well. Gardens stay walkable. */
export const BACKDROP_SOLIDS: BackdropRect[] = [
  { x: 0.36, y: 0.08, w: 0.28, h: 0.34 }, // cottage + porch
  { x: 0.34, y: 0.68, w: 0.32, h: 0.22 }, // pond
  { x: 0.70, y: 0.18, w: 0.13, h: 0.18 }, // well
  { x: 0.02, y: 0.04, w: 0.18, h: 0.28 }, // cherry / left canopy
  { x: 0.80, y: 0.55, w: 0.18, h: 0.34 }, // pine
  { x: 0.02, y: 0.55, w: 0.14, h: 0.28 }, // lower-left trees
  { x: 0.60, y: 0.28, w: 0.12, h: 0.12 }, // workbench / planters
];

export function pointHitsBackdropSolid(nx: number, ny: number): boolean {
  if (
    nx < BACKDROP_YARD.x ||
    ny < BACKDROP_YARD.y ||
    nx > BACKDROP_YARD.x + BACKDROP_YARD.w ||
    ny > BACKDROP_YARD.y + BACKDROP_YARD.h
  ) {
    return true;
  }
  return BACKDROP_SOLIDS.some(
    (s) => nx >= s.x && ny >= s.y && nx <= s.x + s.w && ny <= s.y + s.h,
  );
}

export function worldPointHitsBackdrop(px: number, py: number, bounds: BackdropRect): boolean {
  if (bounds.w <= 0 || bounds.h <= 0) return true;
  return pointHitsBackdropSolid((px - bounds.x) / bounds.w, (py - bounds.y) / bounds.h);
}
