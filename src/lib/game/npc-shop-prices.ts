// NPC shop prices (phase 6) — floor/ceiling reference cho marketplace (±60%).
// ponytail: hardcode MVP; sync economy.ts = roadmap.
export const NPC_PRICES: Record<string, number> = {
  wood: 5,
  stone: 8,
  iron: 15,
  cloth: 12,
  gem: 50,
  gold_ore: 30,
  parsnip: 35,
  potato: 80,
  tomato: 60,
};

export const PRICE_BAND = 0.6; // ±60%

export function priceFloor(itemId: string): number {
  const npc = NPC_PRICES[itemId] ?? 10;
  return Math.max(1, Math.floor(npc * (1 - PRICE_BAND)));
}
export function priceCeiling(itemId: string): number {
  const npc = NPC_PRICES[itemId] ?? 10;
  return Math.ceil(npc * (1 + PRICE_BAND));
}
export function isValidListingPrice(itemId: string, priceUnit: number): boolean {
  return priceUnit >= priceFloor(itemId) && priceUnit <= priceCeiling(itemId);
}

export const MAX_ACTIVE_LISTINGS = 20;
export const LISTING_TTL_DAYS = 7;
