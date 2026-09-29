import { describe, it, expect } from "vitest";
import { neighborBitmask, decomposeShore, waterShoreDecomp } from "../../src/lib/game/assets/auto-tile";
import { T } from "../../src/lib/game/constants";

// W = WATER(3), G = GRASS(0)
const W = T.WATER;
const G = T.GRASS;

describe("AutoTile bitmask", () => {
  it("neighborBitmask: tile ngập (không water neighbor) → mask 0", () => {
    const terrain = [
      [G, G, G],
      [G, W, G],
      [G, G, G],
    ];
    expect(neighborBitmask(terrain, 1, 1, (t) => t === W)).toBe(0);
  });

  it("neighborBitmask: 4 cardinal water → mask 1|4|16|64=85", () => {
    // N=(0,1),S=(2,1),E=(1,2),W=(1,0) phải là water.
    const terrain = [
      [G, W, G],
      [W, W, W],
      [G, W, G],
    ];
    expect(neighborBitmask(terrain, 1, 1, (t) => t === W)).toBe(1 | 4 | 16 | 64);
  });

  it("neighborBitmask: edge boundary → neighbor ngoài grid = false", () => {
    const terrain = [[W]];
    // 1×1: mọi neighbor ngoài grid → false → mask 0 (full).
    expect(neighborBitmask(terrain, 0, 0, (t) => t === W)).toBe(0);
  });

  it("decomposeShore: mask 0 → không bờ (nước cô lập, renderer tự vẽ)", () => {
    const d = decomposeShore(0);
    expect(d.edge).toBeUndefined();
    expect(d.corner).toBeUndefined();
    expect(d.innerCorners).toEqual([]);
  });

  it("decomposeShore: all-8-neighbor → không bờ (nước nội địa)", () => {
    const d = decomposeShore(0xff);
    expect(d.edge).toBeUndefined();
    expect(d.corner).toBeUndefined();
    expect(d.innerCorners).toEqual([]);
  });

  it("decomposeShore: land phía S → edge-s", () => {
    const d = decomposeShore(1 | 4 | 64); // n,e,w là nước; s là đất
    expect(d.edge).toBe("s");
    expect(d.corner).toBeUndefined();
  });

  it("decomposeShore: corner combos — 2 cardinal kề nhau là đất", () => {
    // e+s đất → corner-nw
    expect(decomposeShore(4 | 16).corner).toBe("nw");
    // w+s đất → corner-ne
    expect(decomposeShore(64 | 16).corner).toBe("ne");
    // n+w đất → corner-se
    expect(decomposeShore(1 | 64).corner).toBe("se");
    // n+e đất → corner-sw
    expect(decomposeShore(1 | 4).corner).toBe("sw");
  });

  it("decomposeShore: inner corner — diagonal đất nhưng cả 2 cardinal kề là nước", () => {
    // SE diagonal đất (bit8=0), S+E nước (bits 16|4 set) → innerCorners ['se']
    const d = decomposeShore(1 | 4 | 16 | 64 | 2 | 32 | 128); // chỉ thiếu SE
    expect(d.innerCorners).toContain("se");
    expect(d.innerCorners).toHaveLength(1);
  });

  it("decomposeShore: diagonal đất nhưng 1 cardinal kề cũng đất → KHÔNG inner corner", () => {
    // SE + S đều đất → bờ xử lý bởi edge/corner, không phải góc lõm
    const d = decomposeShore(1 | 4 | 64 | 2 | 32 | 128); // thiếu SE và S
    expect(d.innerCorners).not.toContain("se");
  });

  it("decomposeShore: 3+ cardinal đất (dải nước mảnh) → không edge/corner cell", () => {
    // Chỉ E là nước → đất N,S,W → renderer tự bo, không shore cell
    const d = decomposeShore(4);
    expect(d.edge).toBeUndefined();
    expect(d.corner).toBeUndefined();
  });

  it("waterShoreDecomp: integration — corner se + inner corner ne", () => {
    const terrain = [
      [W, W, W],
      [W, W, G],
      [W, G, G],
    ];
    // tile (1,1): S,E đất + SE đất → corner "se"; NE đường chéo? N nước, E đất → không inner
    const d = waterShoreDecomp(terrain, 1, 1);
    expect(d.corner).toBe("se");
  });
});
