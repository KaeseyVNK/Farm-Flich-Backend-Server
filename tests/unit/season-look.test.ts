import { describe, expect, it } from "vitest";
import {
  MAPLE_SEASON_FRAME,
  PINE_SEASON_FRAME,
  WEATHER_SEASON_CELL,
  SEASON_GRASS_FALLBACK,
} from "../../src/lib/game/season-look";

describe("season look", () => {
  it("maple canopy frames differ across seasons", () => {
    expect(MAPLE_SEASON_FRAME.Spring.sx).toBe(0);
    expect(MAPLE_SEASON_FRAME.Summer.sx).toBe(32);
    expect(MAPLE_SEASON_FRAME.Fall.sx).toBe(64);
    expect(MAPLE_SEASON_FRAME.Winter.sx).toBe(96);
    expect(MAPLE_SEASON_FRAME.Spring.sw).toBe(32);
    expect(MAPLE_SEASON_FRAME.Spring.sh).toBe(48);
    expect(new Set(Object.values(MAPLE_SEASON_FRAME).map((f) => f.frame)).size).toBe(4);
  });

  it("pine uses the snow cell only in winter", () => {
    expect(PINE_SEASON_FRAME.Spring.sx).toBe(96);
    expect(PINE_SEASON_FRAME.Winter.sx).toBe(128);
  });

  it("weather season icons sit on the middle row of ui.weather", () => {
    expect(WEATHER_SEASON_CELL.Spring).toEqual({ sx: 0, sy: 16 });
    expect(WEATHER_SEASON_CELL.Winter).toEqual({ sx: 48, sy: 16 });
  });

  it("fallback grass is green in spring and pale in winter", () => {
    expect(SEASON_GRASS_FALLBACK.Spring.grass).toBe(0x79bf56);
    expect(SEASON_GRASS_FALLBACK.Fall.grass).toBe(0xc98a3a);
    expect(SEASON_GRASS_FALLBACK.Winter.grass).toBe(0xe8f0f6);
  });
});
