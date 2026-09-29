// Phase 5 stretch: silo kho nông sản riêng — cap theo level (contract).
// Pure module; farmStore giữ state + methods.

export function siloCapacity(level: number): number {
  if (level >= 4) return 80;
  if (level >= 3) return 60;
  if (level >= 2) return 40;
  return 20;
}

export function siloUsed(silo: Record<string, number>): number {
  return Object.values(silo).reduce((a, n) => a + n, 0);
}

export function canAdd(silo: Record<string, number>, qty: number, level: number): boolean {
  return siloUsed(silo) + qty <= siloCapacity(level);
}
