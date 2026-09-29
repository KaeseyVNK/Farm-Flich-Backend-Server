// Phase 1 — manifest collision detection (copy-assets strictness foundation).
// The copy script cannot be imported in tests (top-level side effects delete public/), so
// the collision logic lives as a pure function on the TS side and is mirrored in the
// script. This test pins both the real manifest (must be collision-free) and synthetic
// cases (detector actually fires).
import { describe, it, expect } from "vitest";
import {
  ASSET_MANIFEST,
  findManifestCollisions,
} from "../../src/lib/game/assets/asset-manifest";
import type { AssetEntry } from "../../src/lib/game/assets/asset-types";

describe("findManifestCollisions", () => {
  it("manifest curated thực không có collision (key lẫn dest)", () => {
    const hits = findManifestCollisions(ASSET_MANIFEST);
    expect(hits).toEqual([]);
  });

  it("phát hiện hai entry cùng dest", () => {
    const entries: AssetEntry[] = [
      { key: "a.x", src: "a.png", dest: "out/a.png" },
      { key: "b.y", src: "b.png", dest: "out/a.png" }, // same dest
    ];
    const hits = findManifestCollisions(entries);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("dest");
    expect(hits[0].value).toBe("out/a.png");
    expect(hits[0].keys).toEqual(expect.arrayContaining(["a.x", "b.y"]));
  });

  it("phát hiện hai entry cùng key", () => {
    const entries: AssetEntry[] = [
      { key: "dup.k", src: "a.png", dest: "out/a.png" },
      { key: "dup.k", src: "b.png", dest: "out/b.png" }, // same key
    ];
    const hits = findManifestCollisions(entries);
    expect(hits.find((h) => h.kind === "key")).toBeDefined();
  });

  it("không báo false positive khi key/dest đều duy nhất", () => {
    const entries: AssetEntry[] = [
      { key: "a.x", src: "a.png", dest: "out/a.png" },
      { key: "b.y", src: "b.png", dest: "out/b.png" },
    ];
    expect(findManifestCollisions(entries)).toEqual([]);
  });
});
