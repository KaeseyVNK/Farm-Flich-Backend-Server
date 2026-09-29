import { describe, it, expect } from "vitest";
import {
  parseSafeArea,
  safeAreaPadding,
  meetsHitTarget,
  type SafeAreaInsets,
} from "../../src/lib/ui/safe-area";

describe("Safe area (ADR-009)", () => {
  it("parseSafeArea: đọc inset từ CSS get_PROPERTY_", () => {
    const fake = (name: string) => {
      const m: Record<string, string> = {
        "safe-area-inset-top": "44px",
        "safe-area-inset-bottom": "34px",
        "safe-area-inset-left": "0px",
        "safe-area-inset-right": "0px",
      };
      return m[name] ?? "";
    };
    const insets = parseSafeArea(fake);
    expect(insets.top).toBe(44);
    expect(insets.bottom).toBe(34);
    expect(insets.left).toBe(0);
  });

  it("parseSafeArea: fallback 0 khi không support", () => {
    const insets = parseSafeArea(() => "");
    expect(insets).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("safeAreaPadding: CSS padding string 'top right bottom left'", () => {
    const insets: SafeAreaInsets = { top: 44, bottom: 34, left: 0, right: 0 };
    expect(safeAreaPadding(insets)).toBe("44px 0px 34px 0px");
  });

  it("meetsHitTarget: ≥44px (Apple HIG)", () => {
    expect(meetsHitTarget(44)).toBe(true);
    expect(meetsHitTarget(48)).toBe(true);
    expect(meetsHitTarget(32)).toBe(false);
  });
});
