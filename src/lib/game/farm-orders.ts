// Phase 5 stretch: 3 đơn hàng/ngày deterministic (không RNG) — lv1 luôn
// parsnip; level cao thay thế từng đơn (contract). tryFillOrder nằm ở actions.
export type Order = { id: string; wants: Record<string, number>; gold: number };

export function ordersForDay(day: number, level: number): Order[] {
  const base: Order[] = [
    { id: `d${day}-a`, wants: { parsnip: 2 }, gold: 80 },
    { id: `d${day}-b`, wants: { parsnip: 3 }, gold: 120 },
    { id: `d${day}-c`, wants: { parsnip: 4 }, gold: 160 },
  ];
  if (level >= 2) base[2] = { id: `d${day}-c`, wants: { potato: 3 }, gold: 150 };
  if (level >= 3) base[1] = { id: `d${day}-b`, wants: { egg: 2 }, gold: 80 };
  if (level >= 4) base[0] = { id: `d${day}-a`, wants: { milk: 1 }, gold: 100 };
  return base;
}
