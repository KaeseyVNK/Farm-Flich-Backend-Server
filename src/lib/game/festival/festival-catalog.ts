/**
 * W8 — Catalog festival (§14/§17): event decor theo mùa (2/mùa), trophy 4 hoạt
 * động, ngưỡng thưởng bronze/silver/gold. Event decor KHÔNG mua (decor-catalog
 * tier "event" + decorFor lọc + buyDecor guard) — chỉ claim 1 lần/lễ.
 */

import type { ActivityId, Season } from "./festival-schedule";

/** Event decor của mùa (ngưỡng silver/gold nhận 1 trong 2). */
export const SEASON_EVENT_DECOR: Record<Season, [string, string]> = {
  Spring: ["ev_spring_balloons", "ev_spring_cottoncandy"],
  Summer: ["ev_summer_umbrella", "ev_summer_icecream"],
  Fall: ["ev_fall_popcorn", "ev_fall_noticeboard"],
  Winter: ["ev_winter_pine", "ev_winter_xmas_outdoor"],
};

/** Trophy id theo hoạt động (ngưỡng gold). */
export const ACTIVITY_TROPHY: Record<ActivityId, string> = {
  contest: "trophy_contest",
  derby: "trophy_derby",
  cookoff: "trophy_cookoff",
  puzzle: "trophy_puzzle",
};

export interface FestivalReward {
  tier: "bronze" | "silver" | "gold";
  /** Ngưỡng điểm đạt (score ≥). */
  at: number;
  gold: number;
  /** Event decor mùa (silver/gold) — bronze chỉ gold. */
  decorId?: string;
  /** Trophy (chỉ gold, lần đầu mỗi hoạt động). */
  trophy?: boolean;
}

/** Thang thưởng chung 4 hoạt động (điểm chuẩn hoá 0-300). */
export const FESTIVAL_REWARDS: readonly FestivalReward[] = [
  { tier: "bronze", at: 30, gold: 150 },
  { tier: "silver", at: 100, gold: 400, decorId: "SEASON_DECOR_0" },
  { tier: "gold", at: 200, gold: 800, decorId: "SEASON_DECOR_1", trophy: true },
];

/** Thưởng theo tier cho mùa cụ thể (thay placeholder decor mùa). */
export function rewardsForSeason(season: Season): FestivalReward[] {
  const [d0, d1] = SEASON_EVENT_DECOR[season];
  return FESTIVAL_REWARDS.map((r) => ({
    ...r,
    decorId: r.decorId === "SEASON_DECOR_0" ? d0 : r.decorId === "SEASON_DECOR_1" ? d1 : r.decorId,
  }));
}

/** Tier cao nhất đạt được theo điểm (null nếu dưới bronze). */
export function rewardTierForScore(score: number): FestivalReward["tier"] | null {
  let best: FestivalReward["tier"] | null = null;
  for (const r of FESTIVAL_REWARDS) {
    if (score >= r.at) best = r.tier;
  }
  return best;
}

/** Tổng thưởng tích luỹ tới tier (claim trọn gói theo tier — đơn giản UI). */
export function rewardPackForScore(score: number, season: Season): FestivalReward | null {
  const tier = rewardTierForScore(score);
  if (!tier) return null;
  return rewardsForSeason(season).find((r) => r.tier === tier) ?? null;
}
