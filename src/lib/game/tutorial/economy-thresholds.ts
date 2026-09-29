/**
 * W9 economy-thresholds — ngưỡng cân bằng kinh tế (P4 balance pass dùng).
 * Pure — không import economy.json (test giữ benchmark drift 1 phía có chủ ý).
 *
 * Mục tiêu plan: bicycle 2–3 ngày chơi, horse 8–12 ngày, không nguồn income > 60%
 * tổng. Số liệu income/ngày từng nguồn được tính ở economy-balance doc (P4).
 */
export interface IncomeBreakdown {
  total: number;
  farming: number;
  fishing: number;
  cooking: number;
  raid: number;
}

/** % share từng nguồn trong tổng income/ngày — tổng 0 → chia đều 0 (không NaN). */
export function incomeShare(income: Omit<IncomeBreakdown, "total">): IncomeBreakdown {
  const total = income.farming + income.fishing + income.cooking + income.raid;
  if (total <= 0) return { total: 0, farming: 0, fishing: 0, cooking: 0, raid: 0 };
  return {
    total,
    farming: income.farming / total,
    fishing: income.fishing / total,
    cooking: income.cooking / total,
    raid: income.raid / total,
  };
}

/** Số ngày chơi mục tiêu để mua được sink chính (P4 test ngưỡng — giá sau TUNE cf5a2d8). */
export const INCOME_TARGET_DAYS = {
  bicycle: 3, // 1500g — 2–3 ngày
  horse: 10, // 6000g — 8–12 ngày
  fancyDecor: 6, // 1200g fanciest
} as const;

/** Benchmark drift detector: giá bán lẻ mốc nguồn fishing (economy.json). */
export const SUNFISH_RIVER_PRICE = 25;