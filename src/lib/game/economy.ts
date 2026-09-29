// Typed accessor for the economy.json single source of truth.
// Provides buy/sell prices for crops, seeds, resources, forage, food, crafts.
import economyData from "./economy.json";

export interface EconomyEntry {
  base?: number;
  seed?: number;
  buy?: number;
  sell?: number;
}
export interface Economy {
  currency: string;
  vendorRate: number;
  shippingRate: number;
  crops: Record<string, EconomyEntry>;
  seeds: Record<string, EconomyEntry>;
  resources: Record<string, EconomyEntry>;
  forage: Record<string, EconomyEntry>;
  food: Record<string, EconomyEntry>;
  crafts: Record<string, EconomyEntry>;
}

export const ECONOMY = economyData as unknown as Economy;

const CATEGORY_MAP: Record<string, keyof Economy> = {
  crop: "crops",
  seed: "seeds",
  resource: "resources",
  forage: "forage",
  food: "food",
};

/** Vendor sell price (100% of base) — what Pierre/Robin pay the player. */
export function vendorSellPrice(itemId: string, type?: string): number {
  const cat = type ? CATEGORY_MAP[type] : null;
  if (cat) {
    const entry = (ECONOMY[cat] as Record<string, EconomyEntry>)[itemId];
    if (entry) {
      if (entry.sell != null) return entry.sell;
      if (entry.base != null) return Math.round(entry.base * ECONOMY.vendorRate);
      if (entry.buy != null) return Math.round(entry.buy * 0.5);
    }
  }
  // fallback: search all categories
  for (const cat of ["crops", "seeds", "resources", "forage", "food", "crafts"] as const) {
    const entry = (ECONOMY[cat] as Record<string, EconomyEntry>)[itemId];
    if (entry) {
      if (entry.sell != null) return entry.sell;
      if (entry.base != null) return Math.round(entry.base * ECONOMY.vendorRate);
    }
  }
  return 0;
}

/** Shipping-box sell price (60% of base) — overnight sale. */
export function shippingSellPrice(itemId: string, type?: string): number {
  const vendor = vendorSellPrice(itemId, type);
  return Math.round(vendor * ECONOMY.shippingRate);
}

/** Seed buy price at the general store. */
export function seedBuyPrice(seedId: string): number {
  const entry = ECONOMY.seeds[seedId];
  if (entry?.buy != null) return entry.buy;
  // fallback: crops[xxx].seed
  const cropId = seedId.replace(/_seed$/, "");
  const crop = ECONOMY.crops[cropId];
  return crop?.seed ?? 0;
}
