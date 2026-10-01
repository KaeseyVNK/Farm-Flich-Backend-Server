// 1 Cash = 100 Gold; Cash purchases receive a 10% discount.
// All prices are integer milliCash (1 Cash = 1000 milliCash).
export const CASH_ITEMS: Record<string, number> = {
  item_chest_iron: 250,
  item_safe_box: 500,
  seed_potato: 32,
  seed_strawberry: 44,
  seed_pumpkin: 62,
  seed_watermelon: 90,
};

export const CASH_PLOTS: Record<string, number> = { "4": 4200, "5": 12000 };

// Bag row number -> Gold-equivalent price. Row 3 is bought with Gold on UnityServer.
export const CASH_ROWS: Record<string, number> = { "4": 5000 };

export type CashKind = "ITEM" | "PLOT" | "ROW";

const CATALOGS: Record<CashKind, Record<string, number>> = {
  ITEM: CASH_ITEMS,
  PLOT: CASH_PLOTS,
  ROW: CASH_ROWS,
};

export function isCashKind(kind: unknown): kind is CashKind {
  return kind === "ITEM" || kind === "PLOT" || kind === "ROW";
}

export function cashPriceMilli(kind: CashKind, targetId: string, quantity: number): number | null {
  const catalog = CATALOGS[kind];
  const goldPrice = catalog && Object.prototype.hasOwnProperty.call(catalog, targetId) ? catalog[targetId] : null;
  if (!goldPrice || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 ||
      (kind !== "ITEM" && quantity !== 1)) return null;
  return goldPrice * 9 * quantity;
}
