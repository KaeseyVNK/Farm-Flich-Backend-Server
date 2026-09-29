import { describe, it, expect } from "vitest";
import {
  DARK_FANTASY,
  relativeLuminance,
  contrastRatio,
  meetsAA,
} from "../../src/lib/game/theme/dark-fantasy-tokens";

describe("Dark Fantasy theme tokens + WCAG contrast", () => {
  it("palette hex hợp lệ (6-digit)", () => {
    for (const [k, v] of Object.entries(DARK_FANTASY)) {
      expect(v).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("relativeLuminance: black=0, white≈1", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 2);
  });

  it("contrastRatio: identical = 1", () => {
    expect(contrastRatio("#888888", "#888888")).toBe(1);
  });

  it("contrastRatio: black/white = 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("WCAG AA: textPrimary trên panelBg ≥ 4.5", () => {
    expect(meetsAA(DARK_FANTASY.textPrimary, DARK_FANTASY.panelBg)).toBe(true);
  });

  it("WCAG AA: textPrimary trên bg ≥ 4.5", () => {
    expect(meetsAA(DARK_FANTASY.textPrimary, DARK_FANTASY.bg)).toBe(true);
  });

  it("WCAG AA: textSecondary trên panelBg ≥ 4.5", () => {
    expect(meetsAA(DARK_FANTASY.textSecondary, DARK_FANTASY.panelBg)).toBe(true);
  });

  it("accentGold trên panelBg đủ contrast cho large/icon text (≥ 3)", () => {
    expect(contrastRatio(DARK_FANTASY.accentGold, DARK_FANTASY.panelBg)).toBeGreaterThanOrEqual(3);
  });
});
