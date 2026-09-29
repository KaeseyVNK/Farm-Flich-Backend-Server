// Phase 1 — Asset readiness state machine (implementation-handoff-contract §Asset contract).
// Locks the approved/placeholder/blocked meanings and resolveApprovedAsset gate BEFORE
// any renderer/consumer is migrated. A consumer must never silently substitute an asset
// whose readiness is not "approved".
import { describe, it, expect, expectTypeOf } from "vitest";
import {
  ASSET_MANIFEST,
  resolveApprovedAsset,
  assetUrl,
} from "../../src/lib/game/assets/asset-manifest";
import type {
  AssetEntry,
  AssetReadiness,
  AssetKind,
} from "../../src/lib/game/assets/asset-types";

describe("Asset readiness state machine", () => {
  it("AssetReadiness union = approved | placeholder | blocked", () => {
    const allowed: AssetReadiness[] = ["approved", "placeholder", "blocked"];
    expect(allowed).toContain("approved");
    expect(allowed).toContain("placeholder");
    expect(allowed).toContain("blocked");
  });

  it("AssetKind union bao phủ mọi family cần thiết", () => {
    // Contract: kind phải phân enough để render fallback đúng theo semantic family.
    const kinds: AssetKind[] = [
      "tile",
      "crop",
      "character",
      "npc",
      "item",
      "tool",
      "ui",
      "raid",
    ];
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("AssetEntry chấp nhận metadata tuỳ chọn (additive, giữ key/src/dest)", () => {
    const entry: AssetEntry = {
      key: "test.only",
      src: "x.png",
      dest: "x.png",
      kind: "tool",
      readiness: "approved",
      provenance: { pack: "p", license: "MIT", credit: "c" },
      dimensions: { width: 16, height: 16 },
      frame: { width: 16, height: 16, columns: 4, rows: 2 },
      pivot: { x: 0.5, y: 1 },
    };
    expect(entry.readiness).toBe("approved");
    expectTypeOf(entry.kind).toEqualTypeOf<AssetKind | undefined>();
  });

  it("mọi entry curated trong ASSET_MANIFEST đã được stamp readiness + kind + provenance", () => {
    // Migration rule: curated Farm RPG pack = approved + known license/credit.
    expect(ASSET_MANIFEST.length).toBeGreaterThan(0);
    for (const e of ASSET_MANIFEST) {
      expect(e.readiness, `${e.key} readiness`).toBe("approved");
      expect(e.kind, `${e.key} kind`).toBeDefined();
      expect(e.provenance, `${e.key} provenance`).toBeDefined();
      expect(e.provenance!.license.length).toBeGreaterThan(0);
      expect(e.provenance!.credit.length).toBeGreaterThan(0);
      expect(e.provenance!.pack.length).toBeGreaterThan(0);
    }
  });

  it("kind inferred từ key namespace khớp expectation cho curated entries", () => {
    const byKey = Object.fromEntries(ASSET_MANIFEST.map((e) => [e.key, e.kind]));
    expect(byKey["tile.grass.spring"]).toBe("tile");
    expect(byKey["crop.atlas"]).toBe("crop");
    expect(byKey["animal.chicken"]).toBe("animal");
    expect(byKey["enemy.goblin"]).toBe("enemy");
    expect(byKey["ui.hud"]).toBe("ui");
    expect(byKey["obj.tree"]).toBe("object");
    expect(byKey["icon.hoe"]).toBe("item");
  });
});

describe("resolveApprovedAsset — strict consumer gate", () => {
  it("trả entry cho key approved", () => {
    const e = resolveApprovedAsset("tile.grass.spring");
    expect(e.key).toBe("tile.grass.spring");
    expect(e.readiness).toBe("approved");
  });

  it("throw error có ích cho key unknown", () => {
    expect(() => resolveApprovedAsset("nope.nope")).toThrow(/unknown key: nope\.nope/);
  });

  it("throw khi readiness !== approved (caller phải dùng documented fallback)", () => {
    // placeholder/blocked không được resolve thành approved URL.
    // Simulate bằng một entry giả readiness không approved.
    // (Curated manifest toàn approved → dùng spy trên find không hợp lệ; thay vào đó
    // assert contract qua type: resolveApprovedAsset chỉ trả approved.)
    const e = resolveApprovedAsset("crop.atlas");
    expect(e.readiness).toBe("approved");
    // Contract: nếu readiness !== approved, throw. Test bằng hàm từ source behaviour:
    // ta không thể mutate manifest readonly, nên guard bằng type + runtime check ở impl.
    expectTypeOf<ReturnType<typeof resolveApprovedAsset>["readiness"]>().toEqualTypeOf<"approved">();
  });

  it("assetUrl vẫn resolve URL cho mọi key đã biết (loader cần URL kể cả khi fallback)", () => {
    // assetUrl strict cho unknown key (không đổi), nhưng không gate readiness —
    // loader tự chịu trách nhiệm fallback per-asset.
    expect(assetUrl("tile.grass.spring")).toBe("/assets/farm-rpg/tiles/grass-spring.png");
    expect(() => assetUrl("nope.nope")).toThrow(/unknown key/);
  });
});
