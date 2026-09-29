// Filter post-FX config (ADR-021 dark fantasy). Phaser 4 Filter system.
// Spike NOTES #2: enableFilters() → filters.internal FilterList. Built-ins: addVignette,
// addColorMatrix (desaturation via ColorMatrix#desaturate()), addGlow, addBlur, addMask.
// Phase 8: config values; scene wire browser-only.
export interface VignetteConfig {
  radius: number; // 0..1
  strength: number; // 0..1
}

export interface ColorGradeConfig {
  desaturation: number; // 0..1 (ColorMatrix#desaturate)
  brightness: number; // 0..1+
  contrast: number; // 0..1+
}

export interface FilterPostFx {
  vignette?: VignetteConfig;
  grade?: ColorGradeConfig;
  /** Blood-moon override: desaturation ↓ + red tint grade + vignette ↑. */
  bloodMoon?: boolean;
}

/** Default dark fantasy atmosphere. */
export const DEFAULT_FX: FilterPostFx = {
  vignette: { radius: 0.5, strength: 0.35 },
  grade: { desaturation: 0.15, brightness: 0.95, contrast: 1.1 },
  bloodMoon: false,
};

/** Blood-moon FX override. */
export const BLOOD_MOON_FX: FilterPostFx = {
  vignette: { radius: 0.7, strength: 0.6 },
  grade: { desaturation: 0.4, brightness: 0.85, contrast: 1.2 },
  bloodMoon: true,
};

/** Resolve FX theo blood-moon state. */
export function resolveFx(bloodMoonActive: boolean): FilterPostFx {
  return bloodMoonActive ? BLOOD_MOON_FX : DEFAULT_FX;
}

/** Lighting batching guard: setLighting(true) breaks batching (spike #11).
 *  Lit sprites phải gom adjacent trong Container/SpriteGPULayer. */
export const LIGHTING_BATCH_WARNING = "setLighting(true) breaks render batching — group lit sprites adjacent";
