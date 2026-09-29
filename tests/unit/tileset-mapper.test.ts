import { describe, it, expect } from "vitest";
import { tileSourceRect, seasonSheet, WATER_ANIM_FRAMES, WATER_SHORE_CELLS } from "../../src/lib/game/assets/tileset-mapper";
import { T } from "../../src/lib/game/constants";

describe("TilesetMapper", () => {
  it("GRASS → seasonal sheet solid meadow fill (144,32)", () => {
    const s = tileSourceRect(T.GRASS, "Spring");
    expect(s.sheet).toBe("tile.grass.spring");
    expect(s.sx).toBe(144);
    expect(s.sy).toBe(32);
  });

  it("season sheet swap: Spring/Summer/Fall/Winter", () => {
    expect(seasonSheet("Spring")).toBe("tile.grass.spring");
    expect(seasonSheet("Summer")).toBe("tile.grass.summer");
    expect(seasonSheet("Fall")).toBe("tile.grass.fall");
    expect(seasonSheet("Winter")).toBe("tile.grass.winter");
  });

  it("WATER → solid water-base fill (not autotile edge)", () => {
    expect(tileSourceRect(T.WATER, "Summer").sheet).toBe("tile.water.base");
  });

  it("TILLED vs TILLED_WET khác source x (dry vs wet)", () => {
    const dry = tileSourceRect(T.TILLED, "Spring");
    const wet = tileSourceRect(T.TILLED_WET, "Spring");
    expect(dry.sheet).toBe("tile.tilled");
    expect(wet.sheet).toBe("tile.tilled");
    expect(dry.sx).not.toBe(wet.sx);
  });

  it("FALLOW → tile.tilled cell fully-opaque (112,0), khác TILLED và TILLED_WET", () => {
    // Cell (0,0) có 54/256 px trong suốt → lộ cỏ lệch dưới (bug ô vuông lởm chởm).
    const fallow = tileSourceRect(T.FALLOW, "Spring");
    const dry = tileSourceRect(T.TILLED, "Spring");
    const wet = tileSourceRect(T.TILLED_WET, "Spring");
    expect(fallow.sheet).toBe("tile.tilled");
    expect(fallow.sx).toBe(112);
    expect(fallow.sy).toBe(0);
    expect(`${fallow.sx},${fallow.sy}`).not.toBe(`${dry.sx},${dry.sy}`);
    expect(`${fallow.sx},${fallow.sy}`).not.toBe(`${wet.sx},${wet.sy}`);
  });

  it("unknown type fallback grass", () => {
    const s = tileSourceRect(999 as never, "Spring");
    expect(s.sheet).toBe("tile.grass.spring");
    expect(s.sx).toBe(144);
    expect(s.sy).toBe(32);
  });

  it("PATH → seasonal grass dirt fill (not dungeon brick)", () => {
    const s = tileSourceRect(T.PATH, "Spring");
    expect(s.sheet).toBe("tile.grass.spring");
    expect(s.sx).toBe(144);
    expect(s.sy).toBe(128);
  });

  it("SAND uses dirt fill; ROCK uses cave sheet", () => {
    expect(tileSourceRect(T.SAND, "Spring").sy).toBe(128);
    expect(tileSourceRect(T.ROCK, "Spring").sheet).toBe("tile.caves");
  });

  it("house / cave / beach swap sheets so maps are not a cropped meadow", () => {
    expect(tileSourceRect(T.GRASS, "Spring", "house").sheet).toBe("tile.house");
    expect(tileSourceRect(T.PATH, "Spring", "cave").sheet).toBe("tile.caves");
    expect(tileSourceRect(T.SAND, "Spring", "beach").sheet).toBe("tile.beach");
    expect(tileSourceRect(T.WATER, "Spring", "beach").sheet).toBe("tile.water.base");
  });

  it("water shore 9-slice sits on the band-0 4×4 blob (cols 16–19, rows 0–3)", () => {
    expect(WATER_SHORE_CELLS["corner-nw"]).toEqual({ sx: 256, sy: 0 });
    expect(WATER_SHORE_CELLS["edge-n"]).toEqual({ sx: 272, sy: 0 });
    expect(WATER_SHORE_CELLS["corner-se"]).toEqual({ sx: 304, sy: 48 });
    expect(WATER_SHORE_CELLS["edge-w"].sx).not.toBe(WATER_ANIM_FRAMES[0].sx);
  });

  it("water anim frames là 4 ô interior của khối nước xanh (sparkle orbit 2×2)", () => {
    expect(WATER_ANIM_FRAMES).toHaveLength(4);
    // Cả 4 frame đều nằm trong block interior cols 17–18 / rows 1–2 của band 0.
    for (const f of WATER_ANIM_FRAMES) {
      expect([272, 288]).toContain(f.sx);
      expect([16, 32]).toContain(f.sy);
    }
    // 4 frame phải là 4 ô phân biệt (mỗi góc đúng 1 lần — vòng lặp kín).
    const uniq = new Set(WATER_ANIM_FRAMES.map((f) => `${f.sx},${f.sy}`));
    expect(uniq.size).toBe(4);
    // Thứ tự TL→TR→BR→BL (kim đồng hồ) — đổi thứ tự = đảo chiều orbit.
    expect(WATER_ANIM_FRAMES).toEqual([
      { sx: 272, sy: 16 },
      { sx: 288, sy: 16 },
      { sx: 288, sy: 32 },
      { sx: 272, sy: 32 },
    ]);
  });
});
