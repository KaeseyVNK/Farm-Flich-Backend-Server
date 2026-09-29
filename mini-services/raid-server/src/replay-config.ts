// W7 audit-fix (debt replay): map RaidSession (+ configSnapshot nếu có) → ReplayConfig
// cho /replay re-sim. Pure — tách khỏi HTTP handler để bun-test trust-boundary.
import type { ReplayConfig } from "./replay-headless.js";

/** Snapshot DefenseConfig build lúc raid START (index.ts persist). */
export interface RaidConfigSnapshot {
  enterTile: { x: number; y: number };
  dogs: { x: number; y: number; breed?: string; patrol?: { x: number; y: number }[] }[];
  chests: { id: string; x: number; y: number; kind?: string }[];
  traps: { id: string; kind: string; tile: number; durability: number; level: number }[];
  dogLevel: number;
  trapLevel: number;
}

// Map raid 30×22 (parity validation patrol ở index.ts).
const MAP_W = 30;
const MAP_H = 22;

function intIn(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Sanitize dog entry từ DB JSON — rác thì null (drop), giữ bounds 30×22. */
function saneDog(raw: unknown): { x: number; y: number; breed?: string; patrol?: { x: number; y: number }[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { x?: unknown; y?: unknown; breed?: unknown; patrol?: unknown };
  const x = intIn(r.x, 0, MAP_W - 1);
  const y = intIn(r.y, 0, MAP_H - 1);
  if (x === null || y === null) return null;
  const patrol = Array.isArray(r.patrol)
    ? (r.patrol as { x?: unknown; y?: unknown }[])
        .map((pt) => {
          const px = intIn(pt?.x, 0, MAP_W - 1);
          const py = intIn(pt?.y, 0, MAP_H - 1);
          return px !== null && py !== null ? { x: px, y: py } : null;
        })
        .filter((pt): pt is { x: number; y: number } => pt !== null)
    : undefined;
  return {
    x,
    y,
    breed: typeof r.breed === "string" ? r.breed : undefined,
    patrol: patrol && patrol.length >= 2 ? patrol : undefined,
  };
}

function saneChest(raw: unknown): { id: string; x: number; y: number; kind?: "wood" | "iron" | "safe" } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { id?: unknown; x?: unknown; y?: unknown; kind?: unknown };
  const x = intIn(r.x, 0, MAP_W - 1);
  const y = intIn(r.y, 0, MAP_H - 1);
  if (typeof r.id !== "string" || x === null || y === null) return null;
  const kind = r.kind === "iron" || r.kind === "safe" ? r.kind : r.kind === "wood" ? "wood" : undefined;
  return { id: r.id, x, y, kind };
}

const TRAP_KINDS = new Set(["bear", "spike", "alarm"]);

function saneTrap(raw: unknown): { id: string; kind: "bear" | "spike" | "alarm"; tile: number; durability: number; level: 1 | 2 | 3 } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { id?: unknown; kind?: unknown; tile?: unknown; durability?: unknown; level?: unknown };
  const tile = intIn(r.tile, 0, MAP_W * MAP_H - 1);
  if (typeof r.id !== "string" || tile === null) return null;
  const kind = typeof r.kind === "string" && TRAP_KINDS.has(r.kind) ? (r.kind as "bear" | "spike" | "alarm") : "spike";
  const level = intIn(r.level, 1, 3) ?? 1;
  return { id: r.id, kind, tile, durability: intIn(r.durability, 0, 99) ?? 3, level: level as 1 | 2 | 3 };
}

/**
 * Session row (+ snapshot) → ReplayConfig. Snapshot (persist lúc raid START)
 * ưu tiên; session cũ NULL/rác → fallback default cũ (1 dog giữa, 1 chest, 0
 * trap) — đúng hành vi pre-snapshot, không breaking.
 */
export function replayConfigFromSession(
  sess: {
    mapId?: string;
    thiefMaskId?: string;
    bloodMoon?: boolean;
    guardBonus?: boolean;
    configSnapshot?: RaidConfigSnapshot | null;
  },
  terrain: number[] | undefined,
  sessionId: string,
): ReplayConfig {
  const snap = sess.configSnapshot;
  const dogs = Array.isArray(snap?.dogs)
    ? (snap!.dogs as unknown[]).map(saneDog).filter((d): d is NonNullable<ReturnType<typeof saneDog>> => d !== null)
    : [];
  const chests = Array.isArray(snap?.chests)
    ? (snap!.chests as unknown[]).map(saneChest).filter((c): c is NonNullable<ReturnType<typeof saneChest>> => c !== null)
    : [];
  const traps = Array.isArray(snap?.traps)
    ? (snap!.traps as unknown[]).map(saneTrap).filter((t): t is NonNullable<ReturnType<typeof saneTrap>> => t !== null)
    : [];
  return {
    terrain: terrain ?? new Array(660).fill(0),
    enterTile:
      snap && intIn(snap.enterTile?.x, 0, MAP_W - 1) !== null && intIn(snap.enterTile?.y, 0, MAP_H - 1) !== null
        ? { x: intIn(snap.enterTile.x, 0, MAP_W - 1)!, y: intIn(snap.enterTile.y, 0, MAP_H - 1)! }
        : { x: 1, y: 1 },
    dogs: dogs.length ? dogs : [{ x: 15, y: 10 }],
    chests: chests.length ? chests : [{ id: "chest-wood-1", x: 20, y: 10, kind: "wood" }],
    seed: sessionId,
    mapId: sess.mapId ?? "farm",
    maskId: sess.thiefMaskId,
    bloodMoon: sess.bloodMoon ?? false,
    guardBonus: sess.guardBonus ?? false,
    traps: traps.length ? traps : undefined,
    dogLevel: snap ? intIn(snap.dogLevel, 1, 3) ?? 1 : undefined,
    trapLevel: snap ? intIn(snap.trapLevel, 1, 3) ?? 1 : undefined,
  };
}
