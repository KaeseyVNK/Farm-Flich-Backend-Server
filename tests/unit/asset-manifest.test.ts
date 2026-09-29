import { describe, it, expect } from "vitest";
import { ASSET_MANIFEST, ASSET_KEYS, assetUrl } from "../../src/lib/game/assets/asset-manifest";

describe("AssetManifest", () => {
  it("mọi entry có key/src/dest non-empty string", () => {
    for (const e of ASSET_MANIFEST) {
      expect(typeof e.key).toBe("string");
      expect(e.key.length).toBeGreaterThan(0);
      expect(typeof e.src).toBe("string");
      expect(e.src.length).toBeGreaterThan(0);
      expect(typeof e.dest).toBe("string");
      expect(e.dest.length).toBeGreaterThan(0);
    }
  });

  it("không key trùng", () => {
    const keys = ASSET_MANIFEST.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("key format: dot-namespace (type.name[.variant])", () => {
    for (const k of ASSET_KEYS) {
      expect(k).toMatch(/^[a-z][a-z0-9]*\.[a-z][a-z0-9.-]*$/);
    }
  });

  it("dest path dưới public/assets/farm-rpg/ — assetUrl resolve prefix đúng", () => {
    const url = assetUrl("tile.grass.spring");
    expect(url).toBe("/assets/farm-rpg/tiles/grass-spring.png");
  });

  it("assetUrl throw cho key unknown", () => {
    expect(() => assetUrl("nope.nope")).toThrow(/unknown key/);
  });

  it("dest không path traversal", () => {
    for (const e of ASSET_MANIFEST) {
      expect(e.dest).not.toMatch(/\.\./);
      expect(e.dest).not.toMatch(/^\//);
    }
  });
});
