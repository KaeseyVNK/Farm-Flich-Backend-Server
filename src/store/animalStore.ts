import { create } from "zustand";

export type AnimalKind = "chicken" | "cow" | "duck";

export interface Animal {
  id: string;
  kind: AnimalKind;
  tx: number;
  ty: number;
  fedToday: boolean;
  hasProduct: boolean;
}

export const ANIMAL_PRODUCT: Record<AnimalKind, string> = {
  chicken: "egg",
  cow: "milk",
  duck: "egg",
};

export const ANIMAL_FEED = new Set(["wheat", "parsnip"]);

// Phase 3 hayday: phút 1 không có livestock — gà lv3, bò lv4 qua syncForLevel.
const STARTER: Animal[] = [];

export interface AnimalState {
  animals: Animal[];
}

export interface AnimalActions {
  animalAt: (x: number, y: number) => Animal | undefined;
  feed: (id: string) => boolean;
  collect: (id: string) => string | null;
  newDay: () => void;
  /** Phase 3: spawn livestock theo level (gà lv3, bò lv4) — idempotent. */
  syncForLevel: (level: number) => void;
  reset: () => void;
  hydrate: (data: Partial<AnimalState>) => void;
}

function cloneStarter(): Animal[] {
  return STARTER.map((a) => ({ ...a }));
}

export const useAnimalStore = create<AnimalState & AnimalActions>((set, get) => ({
  animals: cloneStarter(),

  animalAt: (x, y) => get().animals.find((a) => a.tx === x && a.ty === y),

  feed: (id) => {
    const cur = get().animals.find((a) => a.id === id);
    if (!cur || cur.fedToday) return false;
    set({
      animals: get().animals.map((a) => (a.id === id ? { ...a, fedToday: true } : a)),
    });
    return true;
  },

  collect: (id) => {
    const target = get().animals.find((a) => a.id === id);
    if (!target?.hasProduct) return null;
    set({
      animals: get().animals.map((a) => (a.id === id ? { ...a, hasProduct: false } : a)),
    });
    return ANIMAL_PRODUCT[target.kind];
  },

  newDay: () =>
    set({
      animals: get().animals.map((a) => ({
        ...a,
        hasProduct: a.fedToday,
        fedToday: false,
      })),
    }),

  syncForLevel: (level) => {
    const have = new Set(get().animals.map((a) => a.id));
    const add: Animal[] = [];
    if (level >= 3 && !have.has("hen-1"))
      add.push({ id: "hen-1", kind: "chicken", tx: 25, ty: 8, fedToday: false, hasProduct: false });
    if (level >= 3 && !have.has("hen-2"))
      add.push({ id: "hen-2", kind: "chicken", tx: 26, ty: 9, fedToday: false, hasProduct: false });
    if (level >= 4 && !have.has("cow-1"))
      add.push({ id: "cow-1", kind: "cow", tx: 24, ty: 6, fedToday: false, hasProduct: false });
    if (add.length) set({ animals: [...get().animals, ...add] });
  },

  reset: () => set({ animals: cloneStarter() }),

  hydrate: (data) => {
    if (!Array.isArray(data.animals)) return;
    const kinds: AnimalKind[] = ["chicken", "cow", "duck"];
    const animals: Animal[] = [];
    for (const raw of data.animals) {
      if (!raw || typeof raw !== "object") continue;
      const a = raw as Partial<Animal>;
      if (typeof a.id !== "string" || !kinds.includes(a.kind as AnimalKind)) continue;
      if (typeof a.tx !== "number" || typeof a.ty !== "number") continue;
      animals.push({
        id: a.id,
        kind: a.kind as AnimalKind,
        tx: Math.floor(a.tx),
        ty: Math.floor(a.ty),
        fedToday: a.fedToday === true,
        hasProduct: a.hasProduct === true,
      });
    }
    set({ animals });
  },
}));
