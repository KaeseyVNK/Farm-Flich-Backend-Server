// Phase 2 — feature registry parity (implementation-handoff-contract §Feature registry).
// One data source must drive desktop + mobile + hotkeys. This test locks parity so the old
// drifting FEATURES/SECONDARY/shop/raid literals cannot re-diverge.
import { describe, it, expect } from "vitest";
import {
  FEATURES,
  getFeature,
  featuresByGroup,
  mobilePrimaryFeatures,
  mobileMoreFeatures,
} from "../../src/lib/game/feature-registry";

describe("Feature registry — structure", () => {
  it("mọi feature có id/labelKey/descriptionKey/icon/target/desktopGroup/mobilePlacement", () => {
    for (const f of FEATURES) {
      expect(f.id.length).toBeGreaterThan(0);
      expect(f.labelKey).toMatch(/^feature\./);
      expect(f.descriptionKey).toMatch(/^feature\./);
      expect(f.icon.length).toBeGreaterThan(0);
      expect(f.target).toBeDefined();
      expect(f.desktopGroup).toBeDefined();
      expect(f.mobilePlacement).toBeDefined();
    }
  });

  it("không id trùng", () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("panel target kind có panel hợp lệ (không phải shop)", () => {
    for (const f of FEATURES) {
      if (f.target.kind === "panel") {
        expect(f.target.panel).not.toBe("shop");
        expect(f.id).toBe(f.target.panel);
      }
      if (f.target.kind === "shop") expect(f.id).toBe("shop");
      if (f.target.kind === "raid") expect(f.id).toBe("raid");
    }
  });
});

describe("Feature registry — parity (desktop + mobile)", () => {
  it("raid không nằm trong registry demo cozy (server raid vẫn giữ)", () => {
    expect(getFeature("raid")).toBeUndefined();
  });

  it("mọi feature reachable trên desktop (thuộc 1 group)", () => {
    const groups = ["daily", "making", "explore", "progress", "utility", "mode"] as const;
    const grouped = groups.flatMap((g) => featuresByGroup(g).map((f) => f.id));
    expect(new Set(grouped)).toEqual(new Set(FEATURES.map((f) => f.id)));
  });

  it("mọi feature reachable trên mobile (primary hoặc more)", () => {
    const reachable = [
      ...mobilePrimaryFeatures().map((f) => f.id),
      ...mobileMoreFeatures().map((f) => f.id),
    ];
    expect(new Set(reachable)).toEqual(new Set(FEATURES.map((f) => f.id)));
  });

  it("mobile primary bar = đúng 4 nút: Bag/Plant/Map + More", () => {
    const primary = mobilePrimaryFeatures().map((f) => f.id);
    // Contract: exactly Bag (inventory) / Plant (seeds) / Map + the More sheet holds the rest.
    expect(primary).toEqual(["inventory", "seeds", "map"]);
    expect(primary.length).toBe(3); // 3 named primaries; "More" is the sheet, not a feature
  });

  it("mobile More sheet chứa crafting + shop + settings (không raid)", () => {
    const more = mobileMoreFeatures().map((f) => f.id);
    expect(more).not.toContain("raid");
    expect(more).toContain("crafting");
    expect(more).toContain("shop");
    expect(more).toContain("settings");
  });
});

describe("Feature registry — shortcut safety", () => {
  it("skills KHÔNG có shortcut 'S' (S là farm MoveDown)", () => {
    const skills = getFeature("skills");
    expect(skills?.shortcut).toBeUndefined();
  });

  it("không hai feature dùng cùng 1 shortcut", () => {
    const shortcuts = FEATURES.map((f) => f.shortcut).filter(Boolean);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });

  it("shortcut nếu có là 1 ký tự hoa A-Z (display keycap)", () => {
    for (const f of FEATURES) {
      if (f.shortcut) expect(f.shortcut).toMatch(/^[A-Z]$/);
    }
  });
});
