// Wave 1 P3 — tryStartFishing pure-check + rod tool + XP fish + starter rod.
// V4 pre-check: silo đầy + túi đầy → chặn TRƯỚC cast (không bao giờ mất cá oan).
import { describe, it, expect } from "vitest";
import { tryStartFishing } from "../../src/lib/game/fishing/fishing-session";
import { FARM_ZONE } from "../../src/lib/game/zones/farm";
import { BEACH_ZONE } from "../../src/lib/game/zones/beach";
import { MAP_COLS } from "../../src/lib/game/constants";
import type { ZoneId } from "../../src/lib/game/zones/types";

const farmAt = (x: number, y: number) => FARM_ZONE.terrain[y * MAP_COLS + x];
const beachAt = (x: number, y: number) => BEACH_ZONE.terrain[y * 40 + x];

const OK = {
  energy: 10,
  siloFull: false,
  bagFull: false,
  modalOpen: false,
};

describe("tryStartFishing (P3 pure-check)", () => {
  it("đứng cạnh ao farm → pond", () => {
    const r = tryStartFishing({ zone: "farm", x: 9, y: 20, terrainAt: farmAt, ...OK });
    expect(r).toEqual({ ok: true, waterType: "pond" });
  });

  it("đứng cạnh hồ lớn → lake", () => {
    const r = tryStartFishing({ zone: "farm", x: 24, y: 16, terrainAt: farmAt, ...OK });
    expect(r).toEqual({ ok: true, waterType: "lake" });
  });

  it("đứng mép biển (bờ cát nhìn ra nước) → sea", () => {
    // (5,6) — hàng 6 là bờ, rows 0-5 là biển
    const r = tryStartFishing({ zone: "beach", x: 5, y: 6, terrainAt: beachAt, ...OK });
    expect(r).toEqual({ ok: true, waterType: "sea" });
  });

  it("xa nước (>2 tile) → no-water", () => {
    const r = tryStartFishing({ zone: "farm", x: 4, y: 4, terrainAt: farmAt, ...OK });
    expect(r).toEqual({ ok: false, reason: "no-water" });
  });

  it("energy thiếu (< rod toolEnergy 2) → energy", () => {
    const r = tryStartFishing({ zone: "farm", x: 9, y: 20, terrainAt: farmAt, ...OK, energy: 1 });
    expect(r).toEqual({ ok: false, reason: "energy" });
  });

  it("V4 matrix: silo đầy túi trống OK · túi đầy silo trống OK · cả hai đầy → full", () => {
    const base = { zone: "farm" as ZoneId, x: 9, y: 20, terrainAt: farmAt, ...OK };
    expect(tryStartFishing({ ...base, siloFull: true, bagFull: false })).toEqual({ ok: true, waterType: "pond" });
    expect(tryStartFishing({ ...base, siloFull: false, bagFull: true })).toEqual({ ok: true, waterType: "pond" });
    expect(tryStartFishing({ ...base, siloFull: true, bagFull: true })).toEqual({ ok: false, reason: "full" });
  });

  it("modal đang mở → modal", () => {
    const r = tryStartFishing({ zone: "farm", x: 9, y: 20, terrainAt: farmAt, ...OK, modalOpen: true });
    expect(r).toEqual({ ok: false, reason: "modal" });
  });

  it("nước phải thật sự là T.WATER — tile lạ gần rect nước không tính (terrainAt kiểm tra)", () => {
    // giả terrain: mọi ô là GRASS → không nước → no-water dù tọa độ cạnh ao
    const r = tryStartFishing({ zone: "farm", x: 9, y: 20, terrainAt: () => 0, ...OK });
    expect(r).toEqual({ ok: false, reason: "no-water" });
  });
});
