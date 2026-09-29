// Audio dB mapping (phase 8). Slider 0..1 → linear_to_db (logarithmic).
// Bus arch: Master ← {Music, SFX, Ambience, UI, Voice}. Master peak < 0 dBFS + headroom.
// Spike VERIFIED: Tone.setContext(game.sound.context) share AudioContext.

/** Slider 0..1 → dB. 0 = -∞ (mute), 1 = 0 dBFS. Logarithmic. */
export function sliderToDb(slider: number): number {
  if (slider <= 0) return -Infinity;
  // Amplitude 0..1 → dB = 20 * log10(amplitude).
  return 20 * Math.log10(slider);
}

/** dB → slider (inverse). -∞ → 0, 0 → 1. */
export function dbToSlider(db: number): number {
  if (db === -Infinity) return 0;
  return Math.pow(10, db / 20);
}

/** Ducking: voice/dialogue phát → music bus dip. -12dB, attack 10ms, release 300-500ms. */
export const DUCK = {
  dipDb: -12,
  attackMs: 10,
  releaseMs: 400, // midpoint 300-500
};

/** Master headroom + limiter target. Peak dưới 0 dBFS, headroom -1 dB. */
export const MASTER_HEADROOM_DB = -1;

/** Apply ducking gain to music bus (caller multiply Tone.js gain node). */
export function duckingGain(active: boolean): number {
  return active ? dbToSlider(DUCK.dipDb) : 1;
}

/** SFX variation: pitch ±6% tránh "machine-gun". Deterministic per seed. */
export function pitchVariation(seed: number): number {
  // ±6% = 0.94..1.06. Deterministic từ seed (no Math.random).
  const v = ((seed * 9301 + 49297) % 233280) / 233280; // 0..1
  return 0.94 + v * 0.12;
}

/** visibilitychange pause/resume AudioContext khi tab mất focus — sidechain ducking ngắt. */
export function shouldPauseAudio(documentHidden: boolean): boolean {
  return documentHidden;
}
