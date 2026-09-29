import { describe, expect, it } from "vitest";
import { daylightRemainingPct } from "../../src/lib/game/daylight";
import { DAY_END_HOUR, DAY_START_HOUR } from "../../src/lib/game/constants";

describe("daylightRemainingPct", () => {
  it("full at dawn", () => {
    expect(daylightRemainingPct(DAY_START_HOUR * 60)).toBe(100);
  });

  it("empty at forced-sleep", () => {
    expect(daylightRemainingPct(DAY_END_HOUR * 60)).toBe(0);
  });

  it("clamps before dawn and after night", () => {
    expect(daylightRemainingPct(0)).toBe(100);
    expect(daylightRemainingPct(DAY_END_HOUR * 60 + 120)).toBe(0);
  });

  it("midday is between dawn and night", () => {
    const noon = 12 * 60;
    const pct = daylightRemainingPct(noon);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});
