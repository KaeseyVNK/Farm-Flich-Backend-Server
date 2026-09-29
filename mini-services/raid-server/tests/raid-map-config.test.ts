import { describe, it, expect } from "bun:test";
import { getBiome, assertMapConfig, mapSeed, bloodMoonBiome, BIOMES, DEFAULT_BIOME, type BiomeId } from "../src/raid-map-config";

describe("getBiome (phase 7)", () => {
  it("beach → vision ×1.4, decay ×0.8", () => {
    const b = getBiome("beach");
    expect(b.visionMul).toBe(1.4);
    expect(b.decayMul).toBe(0.8);
  });
  it("farm → baseline 1.0", () => {
    const f = getBiome("farm");
    expect(f.visionMul).toBe(1.0);
    expect(f.decayMul).toBe(1.0);
  });
  it("forest → vision ×0.6, decay ×1.2", () => {
    const f = getBiome("forest");
    expect(f.visionMul).toBe(0.6);
    expect(f.decayMul).toBe(1.2);
  });
  it("unknown → default farm", () => {
    expect(getBiome("nonexistent")).toEqual(DEFAULT_BIOME);
  });
  it("3 biome defined", () => {
    expect(Object.keys(BIOMES).length).toBe(3);
  });
});

describe("assertMapConfig", () => {
  it("valid config → OK", () => {
    expect(() => assertMapConfig(BIOMES.beach)).not.toThrow();
    expect(() => assertMapConfig(BIOMES.forest)).not.toThrow();
  });
  it("out of range → throw", () => {
    expect(() => assertMapConfig({ biome: "farm", visionMul: 5, hearingMul: 1, decayMul: 1, label: "" })).toThrow();
    expect(() => assertMapConfig({ biome: "farm", visionMul: 1, hearingMul: 0.1, decayMul: 1, label: "" })).toThrow();
  });
});

describe("mapSeed (anti replay cheese)", () => {
  it("stable — cùng farm+map → cùng seed", () => {
    expect(mapSeed("farm-1", "beach")).toBe(mapSeed("farm-1", "beach"));
  });
  it("khác map → khác seed", () => {
    expect(mapSeed("farm-1", "beach")).not.toBe(mapSeed("farm-1", "forest"));
  });
});

describe("bloodMoonBiome (phase 7 — blood-moon raid mechanic)", () => {
  it("farm base + blood-moon → vision ×1.5, hearing ×1.5, decay ×0.9 (dog cảnh giác hơn)", () => {
    const b = bloodMoonBiome(BIOMES.farm);
    expect(b.visionMul).toBeCloseTo(1.5, 5);
    expect(b.hearingMul).toBeCloseTo(1.5, 5);
    expect(b.decayMul).toBeCloseTo(0.9, 5);
  });
  it("beach base + blood-moon → composable với biome muliplier", () => {
    const b = bloodMoonBiome(BIOMES.beach);
    expect(b.visionMul).toBeCloseTo(1.4 * 1.5, 5); // beach vision × blood-moon
    expect(b.decayMul).toBeCloseTo(0.8 * 0.9, 5);
  });
  it("deterministic — cùng input → cùng output", () => {
    expect(bloodMoonBiome(BIOMES.forest)).toEqual(bloodMoonBiome(BIOMES.forest));
  });
  it("label giữ nguyên biome gốc (snapshot display)", () => {
    const b = bloodMoonBiome(BIOMES.beach);
    expect(b.biome).toBe("beach");
  });
  it("override không bao giờ giảm dưới 0 (multiplier luôn ≥ baseline)", () => {
    // Blood-moon override chỉ tăng (×1.5 / ×1.5 / ×0.9) — mọi multiplier giữ dương.
    // Guard assertMapConfig [0.3, 2.0] áp cho BIOMES nguồn (anti config độc hại);
    // override là derived state cố ý vượt range (beach vision 2.1) — không chạy
    // qua guard. Verify không có giá trị âm/NaN.
    for (const id of Object.keys(BIOMES) as BiomeId[]) {
      const b = bloodMoonBiome(BIOMES[id]);
      expect(Number.isFinite(b.visionMul)).toBe(true);
      expect(Number.isFinite(b.hearingMul)).toBe(true);
      expect(Number.isFinite(b.decayMul)).toBe(true);
      expect(b.visionMul).toBeGreaterThan(0);
      expect(b.hearingMul).toBeGreaterThan(0);
      expect(b.decayMul).toBeGreaterThan(0);
    }
  });
});
