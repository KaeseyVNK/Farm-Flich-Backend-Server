import { describe, it, expect } from "vitest";
import { decorRects, seasonTint, SEASON_TINT, DECOR_TIER_COLORS, pondFishDots } from "../../src/lib/social/visit-render";
import { FISH } from "../../src/lib/game/fish-catalog";
import { DECOR } from "../../src/lib/game/decor/decor-catalog";

const cell = 14;

describe("visit-render decorRects (W4 P2)", () => {
  it("map decor thật: fence_wood 1×2 rot0 → rect w=1×cell h=2×cell, màu tier basic", () => {
    const fence = DECOR.find((d) => d.id === "fence_wood")!;
    const out = decorRects([{ uid: "u1", defId: "fence_wood", tx: 5, ty: 6, rot: 0 }], [fence], cell);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ x: 5 * cell, y: 6 * cell, w: cell, h: 2 * cell, fill: DECOR_TIER_COLORS.basic, label: "H" });
  });

  it("rot 90/270 swap w↔h (parity footprintOf W3)", () => {
    const fence = DECOR.find((d) => d.id === "fence_wood")!; // w1 h2
    const [r90] = decorRects([{ uid: "u2", defId: "fence_wood", tx: 0, ty: 0, rot: 90 }], [fence], cell);
    expect(r90.w).toBe(2 * cell);
    expect(r90.h).toBe(cell);
    const [r270] = decorRects([{ uid: "u3", defId: "fence_wood", tx: 0, ty: 0, rot: 270 }], [fence], cell);
    expect(r270.w).toBe(2 * cell);
    expect(r270.h).toBe(cell);
  });

  it("defId lạ / tọa độ NaN / row hỏng → bỏ, không crash", () => {
    const fence = DECOR.find((d) => d.id === "fence_wood")!;
    const out = decorRects(
      [
        null,
        "junk",
        { defId: "khong_co", tx: 1, ty: 1 },
        { defId: "fence_wood", tx: NaN, ty: 1 },
        { defId: "fence_wood", tx: 2, ty: 2 }, // vẫn ok (rot undefined → 0)
      ],
      [fence],
      cell,
    );
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(2 * cell);
  });

  it("mảng không phải array / undefined → rỗng", () => {
    expect(decorRects(undefined, [], cell)).toEqual([]);
    expect(decorRects("haha", [], cell)).toEqual([]);
    expect(decorRects({}, [], cell)).toEqual([]);
  });

  it("uid thiếu → fallback key defId-tx-ty (React key duy nhất)", () => {
    const fence = DECOR.find((d) => d.id === "fence_wood")!;
    const [r] = decorRects([{ defId: "fence_wood", tx: 3, ty: 4 }], [fence], cell);
    expect(r.key).toBe("fence_wood-3-4");
  });

  it("tier fancy/nice có màu riêng", () => {
    const defs = [
      { id: "x1", name: "X", w: 1, h: 1, tier: "fancy" },
      { id: "x2", name: "Y", w: 1, h: 1, tier: "nice" },
    ];
    const out = decorRects(
      [
        { defId: "x1", tx: 0, ty: 0 },
        { defId: "x2", tx: 1, ty: 0 },
      ],
      defs,
      cell,
    );
    expect(out[0].fill).toBe(DECOR_TIER_COLORS.fancy);
    expect(out[1].fill).toBe(DECOR_TIER_COLORS.nice);
  });
});

describe("visit-render seasonTint (W4 P2)", () => {
  it("4 mùa có tint; mùa lạ/undefined → null (không phủ)", () => {
    for (const s of ["Spring", "Summer", "Fall", "Winter"]) {
      expect(seasonTint(s)).toBe(SEASON_TINT[s]);
    }
    expect(seasonTint("Rainy")).toBeNull();
    expect(seasonTint(undefined)).toBeNull();
  });
});

// ── W4 audit-gap: pondFish chấm (đặt trên ô nước, tooltip tên cá) ──────────────
describe("visit-render pondFishDots (W4 audit fix)", () => {
  const cell = 14;
  const cols = 30;
  const fishDefs = FISH.map((f) => ({ id: f.id, name: f.name }));
  // Map 3×… giả lập: index 2, 5 là nước (T.WATER = 3), còn lại cỏ.
  const terrain = Array.from({ length: 30 }, (_, i) => (i === 2 || i === 5 || i === 8 ? 3 : 0));

  it("mỗi con cá 1 chấm trên ô nước riêng, đúng toạ độ cell, tooltip tên + ngày", () => {
    const dots = pondFishDots(
      terrain,
      [
        { fishId: "sunfish", daysGrown: 2 },
        { fishId: "perch", daysGrown: 0 },
      ],
      cell,
      cols,
      3,
      fishDefs,
    );
    expect(dots).toHaveLength(2);
    expect(dots[0].x).toBe((2 % cols) * cell + cell / 2);
    expect(dots[0].y).toBe(Math.floor(2 / cols) * cell + cell / 2);
    expect(dots[0].label).toContain("Mặt Trời");
    expect(dots[0].label).toContain("2");
    expect(dots[1].label).toContain("Rô");
  });

  it("nhiều cá hơn ô nước → thừa bị bỏ (không đè cùng ô)", () => {
    const dots = pondFishDots(
      terrain,
      [
        { fishId: "sunfish", daysGrown: 1 },
        { fishId: "perch", daysGrown: 1 },
        { fishId: "carp", daysGrown: 1 },
        { fishId: "sunfish", daysGrown: 1 },
      ],
      cell,
      cols,
      3,
      fishDefs,
    );
    expect(dots).toHaveLength(3); // map chỉ có 3 ô nước
  });

  it("fishId lạ / row hỏng / không phải array → bỏ, không crash", () => {
    expect(pondFishDots(terrain, [{ fishId: "alien", daysGrown: 1 }], cell, cols, 3, fishDefs)).toEqual([]);
    expect(pondFishDots(terrain, [null, "x", {}], cell, cols, 3, fishDefs)).toEqual([]);
    expect(pondFishDots(terrain, undefined, cell, cols, 3, fishDefs)).toEqual([]);
    expect(pondFishDots(undefined, [{ fishId: "sunfish", daysGrown: 1 }], cell, cols, 3, fishDefs)).toEqual([]);
  });

  it("không có ô nước → rỗng", () => {
    expect(pondFishDots([0, 0, 0], [{ fishId: "sunfish", daysGrown: 1 }], cell, cols, 3, fishDefs)).toEqual([]);
  });
});
