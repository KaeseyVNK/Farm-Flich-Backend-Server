// Wave 2 P2 — state machine minigame nấu (canh thanh chạy qua vùng ngon), thuần
// như fishing-sm/reel-bar: không import store/Phaser, rng injectable để test.
// Thiết kế cozy (plan W2): miss KHÔNG bỏ cả nồi — món vẫn ra, chỉ mất nửa input.
export type Rng = () => number;

export type RoundResult = "perfect" | "ok" | "miss";
/** perfect = mọi vòng perfect (x2 món) · good = mọi vòng trúng · sloppy = có miss (mất nửa input). */
export type CookQuality = "perfect" | "good" | "sloppy";

export interface CookSession {
  phase: "idle" | "cooking" | "done" | "aborted";
  recipeId: string;
  /** Vòng hiện tại (0-based). */
  round: number;
  rounds: number;
  /** Vị trí thanh chạy 0..1. */
  marker: number;
  dir: 1 | -1;
  /** Vùng ngon [zoneStart, zoneStart + zoneWidth]. */
  zoneStart: number;
  zoneWidth: number;
  /** Tier recipe — quyết định tốc độ marker (COOK_TUNE.markerSpeed). */
  tier: number;
  results: RoundResult[];
}

/** TUNE tập trung — human gate chỉnh tại đây (pattern FISHING_TUNE/REEL_TUNE). */
export const COOK_TUNE = {
  /** Tốc độ thanh theo tier (vòng/giây trên trục 0..1). */
  markerSpeed: { 2: 0.9, 3: 1.25 } as Record<number, number>,
  /** Khoảng đệm hai đầu để vùng ngon không dính biên. */
  zoneMargin: 0.08,
  /** Bán kính lõi perfect = zoneWidth × frac (đo từ tâm vùng). */
  perfectFrac: 0.15,
};

export type CookEvent =
  | { type: "tick"; dt: number }
  | { type: "tap" }
  | { type: "abort" };

export interface CookStartOpts {
  id: string;
  rounds: number;
  zoneWidth: number;
  /** Tier quyết định tốc độ marker (mặc định 2). */
  tier?: number;
}

function rollZone(rng: Rng, width: number): number {
  const lo = COOK_TUNE.zoneMargin;
  const hi = 1 - COOK_TUNE.zoneMargin - width;
  return lo + (hi - lo) * rng();
}

/** Marker khởi đầu/vòng mới luôn BÊN KIA vùng ngon — chặn tap-perfect frame đầu. */
function markerAway(zoneStart: number): number {
  return zoneStart > 0.5 ? Math.max(0, zoneStart - 0.45) : Math.min(1, zoneStart + 0.45);
}

export function startCook(opts: CookStartOpts, rng: Rng): CookSession {
  const width = Math.max(0.05, Math.min(0.5, opts.zoneWidth));
  const zoneStart = rollZone(rng, width);
  return {
    phase: "cooking",
    recipeId: opts.id,
    round: 0,
    rounds: Math.max(1, opts.rounds),
    marker: markerAway(zoneStart),
    dir: rng() < 0.5 ? 1 : -1,
    zoneStart,
    zoneWidth: width,
    tier: opts.tier ?? 2,
    results: [],
  };
}

function judge(marker: number, s: CookSession): RoundResult {
  const center = s.zoneStart + s.zoneWidth / 2;
  const dist = Math.abs(marker - center);
  if (dist <= s.zoneWidth * COOK_TUNE.perfectFrac) return "perfect";
  if (dist <= s.zoneWidth / 2) return "ok";
  return "miss";
}

export function nextCook(s: CookSession, e: CookEvent, rng: Rng): CookSession {
  if (s.phase === "aborted") return s;
  switch (e.type) {
    case "abort":
      return s.phase === "cooking" ? { ...s, phase: "aborted" } : s;
    case "tick": {
      if (s.phase !== "cooking") return s;
      const speed = COOK_TUNE.markerSpeed[s.tier] ?? COOK_TUNE.markerSpeed[2];
      let marker = s.marker + s.dir * speed * e.dt;
      let dir: 1 | -1 = s.dir;
      if (marker >= 1) { marker = 2 - marker; dir = -1; }
      if (marker <= 0) { marker = -marker; dir = 1; }
      return { ...s, marker, dir };
    }
    case "tap": {
      if (s.phase !== "cooking") return s;
      const result = judge(s.marker, s);
      const results = [...s.results, result];
      const nextRound = s.round + 1;
      if (nextRound >= s.rounds) {
        return { ...s, results, round: s.rounds - 1, phase: "done" };
      }
      const nextZone = rollZone(rng, s.zoneWidth);
      return {
        ...s,
        results,
        round: nextRound,
        zoneStart: nextZone,
        marker: markerAway(nextZone),
        dir: rng() < 0.5 ? 1 : -1,
      };
    }
  }
}

export function cookQuality(results: RoundResult[]): CookQuality {
  if (results.length === 0) return "sloppy";
  if (results.every((r) => r === "perfect")) return "perfect";
  if (results.every((r) => r !== "miss")) return "good";
  return "sloppy";
}

/** Quyết định output theo chuỗi kết quả: perfect x2, miss mất nửa input (cozy). */
export function cookOutput(results: RoundResult[]): { qty: number; inputLossFrac: number } {
  const q = cookQuality(results);
  if (q === "perfect") return { qty: 2, inputLossFrac: 0 };
  if (q === "good") return { qty: 1, inputLossFrac: 0 };
  return { qty: 1, inputLossFrac: 0.5 };
}
