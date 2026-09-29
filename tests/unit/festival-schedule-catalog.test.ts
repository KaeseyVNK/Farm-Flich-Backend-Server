import { describe, it, expect } from "vitest";
import {
  isFestivalDay,
  activitiesToday,
  festivalTheme,
  FESTIVAL_MAIN_DAY,
  FESTIVAL_SIDE_DAY,
  SEASON_MAIN_ACTIVITY,
  type Season,
} from "@/lib/game/festival/festival-schedule";
import {
  rewardsForSeason,
  rewardTierForScore,
  rewardPackForScore,
  SEASON_EVENT_DECOR,
  ACTIVITY_TROPHY,
} from "@/lib/game/festival/festival-catalog";
import { DECOR, decorFor, decorById, DECOR_STEALABLE } from "@/lib/game/decor/decor-catalog";
import { ASSET_MANIFEST } from "@/lib/game/assets/asset-manifest";

const SEASONS: Season[] = ["Spring", "Summer", "Fall", "Winter"];

describe("festival-schedule (W8 P1)", () => {
  it("ngày 13 = main, 24 = side, còn lại null — mọi mùa", () => {
    for (const s of SEASONS) {
      expect(isFestivalDay(s, 13)).toBe("main");
      expect(isFestivalDay(s, 24)).toBe("side");
      for (const d of [1, 12, 14, 23, 25, 28]) {
        expect(isFestivalDay(s, d)).toBeNull();
      }
    }
    expect(FESTIVAL_MAIN_DAY).toBe(13); // khớp CalendarPanel dots sẵn
    expect(FESTIVAL_SIDE_DAY).toBe(24);
  });

  it("hoạt động chủ đề đúng mùa: xuân contest/hạ derby/thu cookoff/đông puzzle", () => {
    expect(SEASON_MAIN_ACTIVITY.Spring).toBe("contest");
    expect(SEASON_MAIN_ACTIVITY.Summer).toBe("derby");
    expect(SEASON_MAIN_ACTIVITY.Fall).toBe("cookoff");
    expect(SEASON_MAIN_ACTIVITY.Winter).toBe("puzzle");
  });

  it("lễ chính mở 4 hoạt động (chủ đề đầu tiên), lễ phụ 2, ngày thường null", () => {
    const theme = festivalTheme("Spring");
    expect(theme.mainActivities).toHaveLength(4);
    expect(theme.mainActivities[0]).toBe("contest");
    expect(new Set(theme.mainActivities).size).toBe(4);
    expect(activitiesToday("Spring", 13)).toEqual(theme.mainActivities);
    expect(activitiesToday("Spring", 24)).toEqual(theme.sideActivities);
    expect(theme.sideActivities).toHaveLength(2);
    expect(theme.sideActivities[0]).toBe("contest");
    expect(activitiesToday("Spring", 5)).toBeNull();
  });

  it("NPC host đủ 4 mùa (không trùng lặp loạn) + tên lễ", () => {
    const hosts = SEASONS.map((s) => festivalTheme(s).hostNpc);
    expect(new Set(hosts).size).toBe(4);
    expect(festivalTheme("Spring").name).toContain("Hoa");
    expect(festivalTheme("Winter").hostNpc).toBe("elyria");
  });
});

describe("festival event decor + trophy (W8 P1)", () => {
  const eventDecor = DECOR.filter((d) => d.tier === "event");

  it("12 event decor (8 theo mùa + 4 trophy), source festival, price 0", () => {
    expect(eventDecor).toHaveLength(12);
    for (const d of eventDecor) {
      expect(d.source).toBe("festival");
      expect(d.price).toBe(0);
      expect(DECOR_STEALABLE).toBe(false); // §7 nhóm không-trộm
    }
  });

  it("KHÔNG mua được: decorFor (shop) không bao giờ chứa tier event", () => {
    for (const zone of ["farm", "house"] as const) {
      for (let lv = 1; lv <= 10; lv++) {
        const shop = decorFor(zone, lv);
        expect(shop.some((d) => d.tier === "event")).toBe(false);
      }
    }
  });

  it("mọi manifestKey tồn tại trong ASSET_MANIFEST (chặn key ma)", () => {
    const keys = new Set(ASSET_MANIFEST.map((e) => e.key));
    for (const d of eventDecor) {
      expect(keys.has(d.manifestKey), d.manifestKey).toBe(true);
      expect(decorById(d.id)?.id).toBe(d.id); // lookup đầy đủ cho placement
    }
  });

  it("SEASON_EVENT_DECOR + ACTIVITY_TROPHY đều là id thật trong catalog", () => {
    for (const pair of Object.values(SEASON_EVENT_DECOR)) {
      expect(pair).toHaveLength(2);
      for (const id of pair) expect(decorById(id)?.tier).toBe("event");
    }
    for (const id of Object.values(ACTIVITY_TROPHY)) {
      expect(id.startsWith("trophy_")).toBe(true);
      expect(decorById(id)?.tier).toBe("event");
    }
  });
});

describe("festival rewards (W8 P1)", () => {
  it("ngưỡng bronze/silver/gold + boundary chính xác", () => {
    expect(rewardTierForScore(0)).toBeNull();
    expect(rewardTierForScore(29)).toBeNull();
    expect(rewardTierForScore(30)).toBe("bronze");
    expect(rewardTierForScore(99)).toBe("bronze");
    expect(rewardTierForScore(100)).toBe("silver");
    expect(rewardTierForScore(199)).toBe("silver");
    expect(rewardTierForScore(200)).toBe("gold");
    expect(rewardTierForScore(999)).toBe("gold");
  });

  it("pack theo mùa: silver/gold nhận đúng event decor mùa", () => {
    const spring = rewardPackForScore(150, "Spring");
    expect(spring?.tier).toBe("silver");
    expect(spring?.decorId).toBe(SEASON_EVENT_DECOR.Spring[0]);
    const winterGold = rewardPackForScore(250, "Winter");
    expect(winterGold?.decorId).toBe(SEASON_EVENT_DECOR.Winter[1]);
    expect(winterGold?.trophy).toBe(true);
    expect(rewardPackForScore(10, "Spring")).toBeNull();
  });

  it("gold tăng dần theo tier", () => {
    const rs = rewardsForSeason("Fall");
    expect(rs[0].gold).toBeLessThan(rs[1].gold);
    expect(rs[1].gold).toBeLessThan(rs[2].gold);
  });
});
