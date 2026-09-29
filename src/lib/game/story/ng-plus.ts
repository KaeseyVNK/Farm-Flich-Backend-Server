// New Game+ (phase 7). Reset scope explicit (validate decision #5):
// RESET power (level/xp/skillPoints/inventory/world/farm/quests).
// GIỮ knowledge: recipes unlocked, wardrobe unlocks, endingUnlocked badge.
// endingUnlocked persist Global Meta-Save (localStorage hh-global-meta), độc lập slot.
import type { ProgressionState } from "../progression/progression-curve";
import { createProgression } from "../progression/progression-curve";

export type EndingId = "redemption" | "tyranny" | "sacrifice";

export interface EndingDef {
  id: EndingId;
  name: string;
  /** Flag accumulation threshold để unlock ending. min = giá trị tối thiểu; max = tối đa. */
  requires: { flag: string; min?: number; max?: number }[];
}

export const ENDINGS: EndingDef[] = [
  { id: "redemption", name: "Redemption", requires: [{ flag: "mercy", min: 5 }, { flag: "corruption", max: 2 }] },
  { id: "tyranny", name: "Tyranny", requires: [{ flag: "corruption", min: 5 }] },
  { id: "sacrifice", name: "Sacrifice", requires: [{ flag: "selfless", min: 5 }] },
];

/** Knowledge carry = GIỮ qua NG+. */
export interface KnowledgeState {
  recipesUnlocked: string[];
  wardrobeUnlocks: string[];
  endingUnlocked: EndingId[];
}

/** Global Meta-Save (localStorage hh-global-meta) — độc lập slot. */
const META_KEY = "hh-global-meta";

export function loadGlobalMeta(): KnowledgeState {
  if (typeof localStorage === "undefined") return { recipesUnlocked: [], wardrobeUnlocks: [], endingUnlocked: [] };
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { recipesUnlocked: [], wardrobeUnlocks: [], endingUnlocked: [] };
    const p = JSON.parse(raw) as Partial<KnowledgeState>;
    return {
      recipesUnlocked: p.recipesUnlocked ?? [],
      wardrobeUnlocks: p.wardrobeUnlocks ?? [],
      endingUnlocked: p.endingUnlocked ?? [],
    };
  } catch {
    return { recipesUnlocked: [], wardrobeUnlocks: [], endingUnlocked: [] };
  }
}

export function saveGlobalMeta(meta: KnowledgeState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // quota ignore
  }
}

/** Reset power cho NG+. Progression về default; knowledge GIỮ. */
export function ngPlusReset(knowledge: KnowledgeState): {
  progression: ProgressionState;
  knowledge: KnowledgeState;
} {
  return {
    progression: createProgression(),
    knowledge, // carry: recipes + wardrobe + ending badges
  };
}

/** Unlock ending badge → Global Meta-Save. */
export function unlockEnding(ending: EndingId): KnowledgeState {
  const meta = loadGlobalMeta();
  if (!meta.endingUnlocked.includes(ending)) {
    meta.endingUnlocked.push(ending);
    saveGlobalMeta(meta);
  }
  return meta;
}

/**
 * Resolve ending từ flag accumulation. Trả ending match đầu tiên hoặc null.
 * Validate decision #5: branch theo累计 flag.
 */
export function resolveEnding(flags: Record<string, number>): EndingId | null {
  for (const ending of ENDINGS) {
    const allMet = ending.requires.every((req) => {
      const val = flags[req.flag] ?? 0;
      if ("min" in req && req.min !== undefined) return val >= req.min;
      if ("max" in req && (req as { max?: number }).max !== undefined) return val <= (req as { max?: number }).max!;
      return false;
    });
    if (allMet) return ending.id;
  }
  return null;
}
