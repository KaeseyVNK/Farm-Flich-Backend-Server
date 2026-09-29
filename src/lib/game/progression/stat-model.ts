// StatModel + modifier layer (ADR-017). Base + mods → derived.
// Perks/gear apply modifiers (push/pop stack), KHÔNG edit base. Recompute-on-equip.
// Pure (testable). Ponytail: pure function, revert inline perks dễ.

export type ModifierOp = "add" | "mul";

export interface StatModifier {
  stat: string;
  op: ModifierOp;
  value: number;
  source: string; // perk id / gear id (debug)
}

export type BaseStats = Record<string, number>;
export type DerivedStats = Record<string, number>;

const stack: StatModifier[] = [];

/** Push modifier (perk unlock, gear equip). */
export function pushModifier(mod: StatModifier): void {
  stack.push(mod);
}

/** Pop modifier theo source (gear unequip). */
export function popModifiersBySource(source: string): void {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].source === source) stack.splice(i, 1);
  }
}

/** Clear all (test / scene reset). */
export function clearModifiers(): void {
  stack.length = 0;
}

/** Compute derived stats: base + all modifiers. add trước, mul sau. */
export function computeStats(base: BaseStats): DerivedStats {
  const out: DerivedStats = { ...base };
  // Phase 1: apply additive modifiers.
  for (const mod of stack) {
    if (mod.op === "add") {
      out[mod.stat] = (out[mod.stat] ?? 0) + mod.value;
    }
  }
  // Phase 2: apply multiplicative modifiers.
  for (const mod of stack) {
    if (mod.op === "mul") {
      out[mod.stat] = (out[mod.stat] ?? 0) * (1 + mod.value);
    }
  }
  return out;
}

/** Inspect active modifiers (debug UI). */
export function activeModifiers(): readonly StatModifier[] {
  return stack;
}

/** Recompute-on-equip helper: pop old source + push new mods. */
export function recomputeOnEquip(source: string, mods: StatModifier[]): void {
  popModifiersBySource(source);
  for (const m of mods) pushModifier(m);
}
