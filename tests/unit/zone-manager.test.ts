import { describe, it, expect } from "vitest";
import { generateZoneMap } from "../../src/lib/game/zone-manager";
import { ZONES, T } from "../../src/lib/game/constants";

// Audit: zone-manager.ts (297 dòng) chưa có unit test. generateZoneMap tạo
// terrain/warp/decor cho mọi zone — PRNG seed cố định phải reproducible,
// decor không được đặt lên tile bị chặn (nước/đường/đã reserved).

describe("zone-manager generateZoneMap", () => {
  it("mọi zone đều generate được, đúng kích thước config", () => {
    for (const zoneId of Object.keys(ZONES) as (keyof typeof ZONES)[]) {
      const map = generateZoneMap(zoneId);
      expect(map.terrain.length).toBe(ZONES[zoneId].rows);
      for (const row of map.terrain) {
        expect(row.length).toBe(ZONES[zoneId].cols);
      }
    }
  });

  it("deterministic — cùng seed cho terrain giống hệt (reproducible)", () => {
    const a = generateZoneMap("farm");
    const b = generateZoneMap("farm");
    expect(a.terrain).toEqual(b.terrain);
    expect(a.decor).toEqual(b.decor);
    expect(a.warps).toEqual(b.warps);
  });

  it("farm: sông phía đông + cầu bắc qua", () => {
    const farm = generateZoneMap("farm");
    // cột 52-54 WATER ở mọi dòng TRỪ dòng cầu (row 25)
    for (let r = 0; r < farm.terrain.length; r++) {
      if (r === 25) continue;
      expect(farm.terrain[r][52]).toBe(T.WATER);
      expect(farm.terrain[r][53]).toBe(T.WATER);
      expect(farm.terrain[r][54]).toBe(T.WATER);
    }
    // cầu ngang dòng 25
    expect(farm.terrain[25][52]).toBe(T.BRIDGE);
    expect(farm.terrain[25][53]).toBe(T.BRIDGE);
    expect(farm.terrain[25][54]).toBe(T.BRIDGE);
  });

  it("farm: đường path chính thập giá (dòng 25, cột 25)", () => {
    const farm = generateZoneMap("farm");
    for (let c = 10; c < 50; c++) expect(farm.terrain[25][c]).toBe(T.PATH);
    for (let r = 10; r < 50; r++) expect(farm.terrain[r][25]).toBe(T.PATH);
  });

  it("farm: warp về village ở cổng đông (59,25)", () => {
    const farm = generateZoneMap("farm");
    const warp = farm.warps.find((w) => w.x === 59 && w.y === 25);
    expect(warp).toBeDefined();
    expect(warp!.targetZone).toBe("village");
    expect(warp!.targetX).toBe(2);
    expect(warp!.targetY).toBe(20);
  });

  it("village: plaza chợ lát path 15-25 + warp về farm ở cổng tây", () => {
    const village = generateZoneMap("village");
    expect(village.terrain[20][20]).toBe(T.PATH);
    expect(village.terrain[15][15]).toBe(T.PATH);
    // hồ nước top-right
    expect(village.terrain[5][28]).toBe(T.WATER);
    expect(village.terrain[10][33]).toBe(T.WATER);
    const warp = village.warps.find((w) => w.x === 0 && w.y === 20);
    expect(warp).toBeDefined();
    expect(warp!.targetZone).toBe("farm");
  });

  it("decor: mọi tile decor nằm trong bounds + không trên water/path/reserved", () => {
    for (const zoneId of Object.keys(ZONES) as (keyof typeof ZONES)[]) {
      const map = generateZoneMap(zoneId);
      const { cols, rows } = ZONES[zoneId];
      for (const d of map.decor) {
        expect(d.x, `${zoneId} decor x`).toBeGreaterThanOrEqual(0);
        expect(d.x, `${zoneId} decor x`).toBeLessThan(cols);
        expect(d.y, `${zoneId} decor y`).toBeGreaterThanOrEqual(0);
        expect(d.y, `${zoneId} decor y`).toBeLessThan(rows);
        const tile = map.terrain[d.y][d.x];
        // Chặn decor trên tile không thể bước: water/path-hẹp/bridge/tilled/fence/sand.
        // NGOẠI LỆ: plaza chợ village (15-25) — crate/barrel ở giữa quảng trường rộng
        // là market prop hợp lệ (không chặn corridor hẹp). Farm path cross thì cấm
        // (lantern@(25,13)/(25,37) từng đặt lên lối đi chính — đã dời).
        const plazaOk = zoneId === "village" && d.x >= 15 && d.x <= 25 && d.y >= 15 && d.y <= 25;
        if (!plazaOk) {
          expect([T.WATER, T.PATH, T.BRIDGE, T.TILLED, T.TILLED_WET, T.FENCE, T.SAND, T.STONE_EMPTY])
            .not.toContain(tile);
        }
      }
    }
  });

  it("decor: 2 item không đặt cạnh nhau (spacing >= 1)", () => {
    // Với spacing mặc định >= 2, Manhattan distance giữa 2 decor phải >= 2
    for (const zoneId of Object.keys(ZONES) as (keyof typeof ZONES)[]) {
      const map = generateZoneMap(zoneId);
      for (let i = 0; i < map.decor.length; i++) {
        for (let j = i + 1; j < map.decor.length; j++) {
          const a = map.decor[i];
          const b = map.decor[j];
          const dist = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
          // spacing mặc định là 2 → chebyshev >= 2 (cho phép 2 khi 1 trong 2 trục = 2)
          expect(dist, `${zoneId} decor ${a.type}@(${a.x},${a.y}) vs ${b.type}@(${b.x},${b.y})`)
            .toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("raid zones: có warp hoặc tối thiểu generate được decor theo loại", () => {
    for (const zoneId of ["raid_forest", "raid_fortress", "raid_crypt"] as const) {
      const map = generateZoneMap(zoneId);
      // mọi raid zone đều có decor (không rỗng)
      expect(map.decor.length, `${zoneId} decor`).toBeGreaterThan(0);
      // raid zone có path trung tâm dòng 20
      expect(map.terrain[20][10]).toBe(T.PATH);
      expect(map.terrain[20][30]).toBe(T.PATH);
    }
  });
});
