/**
 * W8 — Lịch festival thuần (concept §14 festival + §2 làng). Mỗi mùa 2 ngày:
 * ngày 13 = lễ chính (main), ngày 24 = lễ phụ (side). Deterministic theo
 * (season, day) — client tự tính, KHÔNG cron server.
 * Khớp dots CalendarPanel sẵn (13/24 mỗi mùa).
 */

export type Season = "Spring" | "Summer" | "Fall" | "Winter";

export type FestivalKind = "main" | "side";

export type ActivityId = "contest" | "derby" | "cookoff" | "puzzle";

export const FESTIVAL_MAIN_DAY = 13;
export const FESTIVAL_SIDE_DAY = 24;

/** Ngày lễ chính của mùa (hoạt động chủ đề) — deterministic. */
export const SEASON_MAIN_ACTIVITY: Record<Season, ActivityId> = {
  Spring: "contest",
  Summer: "derby",
  Fall: "cookoff",
  Winter: "puzzle",
};

/** Lễ phụ: hoạt động chính + 1 phụ cố định theo mùa (deterministic). */
const SIDE_SECOND: Record<Season, ActivityId> = {
  Spring: "puzzle",
  Summer: "cookoff",
  Fall: "contest",
  Winter: "derby",
};

export interface FestivalTheme {
  season: Season;
  name: string;
  /** NPC chủ trì (dialogue mở activity panel). */
  hostNpc: "gaston" | "jack" | "alaric" | "elyria";
  /** Hoạt động lễ chính (4 = chủ đề + 3 phụ). */
  mainActivities: ActivityId[];
  /** Hoạt động lễ phụ (2). */
  sideActivities: ActivityId[];
}

/** Day 13 → main, day 24 → side, còn lại null. */
export function isFestivalDay(season: Season, day: number): FestivalKind | null {
  if (day === FESTIVAL_MAIN_DAY) return "main";
  if (day === FESTIVAL_SIDE_DAY) return "side";
  return null;
}

/** Chủ đề mùa — tên lễ + NPC host + hoạt động. */
export function festivalTheme(season: Season): FestivalTheme {
  const main = SEASON_MAIN_ACTIVITY[season];
  const all: ActivityId[] = ["contest", "derby", "cookoff", "puzzle"];
  const names: Record<Season, string> = {
    Spring: "Lễ Hội Hoa",
    Summer: "Hội Bãi Biển",
    Fall: "Lễ Mùa Gặt",
    Winter: "Lễ Băng Giá",
  };
  const hosts: Record<Season, FestivalTheme["hostNpc"]> = {
    Spring: "alaric",
    Summer: "jack",
    Fall: "gaston",
    Winter: "elyria",
  };
  return {
    season,
    name: names[season],
    hostNpc: hosts[season],
    // Main: chủ đề đầu tiên + 3 phụ (mọi hoạt động đều mở).
    mainActivities: [main, ...all.filter((a) => a !== main)],
    // Side: chủ đề + 1 phụ cố định.
    sideActivities: [main, SIDE_SECOND[season]],
  };
}

/** Hoạt động đang mở hôm nay (lễ chính 4, lễ phụ 2, thường null). */
export function activitiesToday(season: Season, day: number): ActivityId[] | null {
  const kind = isFestivalDay(season, day);
  if (!kind) return null;
  return kind === "main" ? festivalTheme(season).mainActivities : festivalTheme(season).sideActivities;
}
