// Wave 1 P6 — RNG injectable cho session câu cá (e2e deterministic).
// Scene gọi fishingRng() thay Math.random; test-bridge (NEXT_PUBLIC_E2E)
// cắm seed qua setFishingRng. Production = Math.random.

let rng: () => number = Math.random;

export function fishingRng(): number {
  return rng();
}

export function setFishingRng(fn: () => number): void {
  rng = fn;
}

export function resetFishingRng(): void {
  rng = Math.random;
}

/** Mulberry32 — PRNG nhỏ deterministic từ seed số (e2e dùng). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
