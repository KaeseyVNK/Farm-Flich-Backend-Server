import { describe, it, expect, beforeEach } from "vitest";
import {
  canPlaceDecor,
  footprintOf,
  sanitizePlacedDecor,
  decorSolidAt,
  type PlacedDecor,
  type PlacementProbe,
} from "../../src/lib/game/decor/decor-placement";
import { decorById } from "../../src/lib/game/decor/decor-catalog";
import { useFarmStore } from "../../src/store/farmStore";
import { T, MAP_COLS } from "../../src/lib/game/constants";
import { getZone } from "../../src/lib/game/zones";
import { isFarmScenerySolid } from "../../src/lib/game/farm-scenery-layout";
import { SAVE_SCHEMA_VERSION, migrate } from "../../src/lib/game/save";

const fence = decorById("fence_wood")!;

function probe(over: Partial<PlacementProbe> = {}): PlacementProbe {
  return {
    zone: "farm",
    cols: 60,
    rows: 60,
    terrainAt: () => T.GRASS,
    solidAt: () => false,
    cropAt: () => false,
    warps: [{ x: 19, y: 16 }],
    decor: [],
    ...over,
  };
}

describe("canPlaceDecor (W3 P2)", () => {
  it("footprint: rot 90/270 đổi chỗ w↔h; rot 0/180 + flip giữ nguyên", () => {
    expect(footprintOf(fence, 0)).toEqual({ w: 1, h: 2 });
    expect(footprintOf(fence, 180)).toEqual({ w: 1, h: 2 });
    expect(footprintOf(fence, 90)).toEqual({ w: 2, h: 1 });
    expect(footprintOf(fence, 270)).toEqual({ w: 2, h: 1 });
    expect(footprintOf(fence, 0, true)).toEqual({ w: 1, h: 2 });
  });

  it("ok trên cỏ trống", () => {
    expect(canPlaceDecor(fence, 10, 10, 0, probe())).toEqual({ ok: true });
  });

  it("bounds: lệch map → từ chối", () => {
    expect(canPlaceDecor(fence, 59, 59, 0, probe()).ok).toBe(false); // h=2 tràn row
    expect(canPlaceDecor(fence, -1, 5, 0, probe()).ok).toBe(false);
  });

  it("nước / tile solid / scenery solid → từ chối", () => {
    expect(canPlaceDecor(fence, 10, 10, 0, probe({ terrainAt: (x, y) => (x === 10 && y === 11 ? T.WATER : T.GRASS) })).ok).toBe(false);
    expect(canPlaceDecor(fence, 10, 10, 0, probe({ terrainAt: (x, y) => (x === 10 && y === 11 ? T.TREE : T.GRASS) })).ok).toBe(false);
    expect(canPlaceDecor(fence, 10, 10, 0, probe({ solidAt: (x, y) => x === 10 && y === 10 })).ok).toBe(false);
  });

  it("crop đang trồng / warp tile → từ chối", () => {
    expect(canPlaceDecor(fence, 10, 10, 0, probe({ cropAt: (x, y) => x === 10 && y === 11 })).ok).toBe(false);
    expect(canPlaceDecor(fence, 19, 16, 0, probe()).ok).toBe(false);
  });

  it("đè decor đã đặt → từ chối (kể cả rot đổi footprint)", () => {
    const existing: PlacedDecor[] = [
      { uid: "u1", defId: "fence_wood", zone: "farm", tx: 12, ty: 12, rot: 0, flip: false },
    ];
    expect(canPlaceDecor(fence, 12, 13, 0, probe({ decor: existing })).ok).toBe(false);
    expect(canPlaceDecor(fence, 11, 12, 90, probe({ decor: existing })).ok).toBe(false); // rot 90 chiếm (11..12,12)
    expect(canPlaceDecor(fence, 14, 12, 0, probe({ decor: existing })).ok).toBe(true);
  });

  it("decor solid KHÔNG đặt trên PATH NGOÀI TRỜI (giữ đường đi); non-solid thì được", () => {
    const p = probe({ terrainAt: (x, y) => (x === 10 ? T.PATH : T.GRASS) });
    expect(canPlaceDecor(fence, 10, 10, 0, p).ok).toBe(false);
    const balloon = decorById("flower_sign")!; // solid: false
    expect(canPlaceDecor(balloon, 10, 10, 0, p).ok).toBe(true);
  });

  it("W3P5-fix: trong nhà PATH là SÀN — decor solid house đặt ĐƯỢC trên PATH house", () => {
    // Sàn nhà = toàn T.PATH (stampInterior); nếu rule PATH áp mọi zone thì 5/6
    // món nhà (table_small/sofa_arm/cat_furn/xmas_tree/dresser) không đặt được đâu hết.
    const houseProbe = probe({ zone: "house", cols: 16, rows: 12, warps: [], terrainAt: () => T.PATH });
    const table = decorById("table_small")!; // solid: true, zone house
    expect(canPlaceDecor(table, 5, 5, 0, houseProbe).ok).toBe(true);
    // fence là item farm — rule PATH vẫn áp cho nó
    expect(canPlaceDecor(fence, 5, 5, 0, houseProbe).ok).toBe(false);
  });

  it("W3P5-fix: decor solid KHÔNG đè tile người chơi (tự nhốt); non-solid được", () => {
    const p = probe({ playerAt: { x: 10, y: 10 } });
    expect(canPlaceDecor(fence, 10, 10, 0, p)).toEqual({ ok: false, reason: "player" });
    expect(canPlaceDecor(fence, 10, 9, 0, p)).toEqual({ ok: false, reason: "player" }); // footprint 9..10 phủ (10,10)
    expect(canPlaceDecor(fence, 11, 10, 0, p).ok).toBe(true); // lệch 1 tile — ok
    const balloon = decorById("flower_sign")!; // non-solid đi xuyên được
    expect(canPlaceDecor(balloon, 10, 10, 0, p).ok).toBe(true);
  });

  it("W3P3 decorSolidAt: solid chặn đúng footprint (rot đổi hướng); non-solid không chặn", () => {
    const placed: PlacedDecor[] = [
      { uid: "s1", defId: "fence_wood", zone: "farm", tx: 10, ty: 10, rot: 0, flip: false }, // 1×2
      { uid: "s2", defId: "fence_wood", zone: "farm", tx: 20, ty: 20, rot: 90, flip: false }, // 2×1
      { uid: "s3", defId: "flower_sign", zone: "farm", tx: 30, ty: 30, rot: 0, flip: false }, // non-solid
      { uid: "s4", defId: "candle", zone: "house", tx: 5, ty: 5, rot: 0, flip: false }, // house + non-solid
    ];
    expect(decorSolidAt(placed, "farm", 10, 10)).toBe(true);
    expect(decorSolidAt(placed, "farm", 10, 11)).toBe(true);
    expect(decorSolidAt(placed, "farm", 10, 12)).toBe(false); // ngoài footprint
    expect(decorSolidAt(placed, "farm", 20, 20)).toBe(true); // rot 90: 2×1
    expect(decorSolidAt(placed, "farm", 21, 20)).toBe(true);
    expect(decorSolidAt(placed, "farm", 20, 21)).toBe(false);
    expect(decorSolidAt(placed, "farm", 30, 30)).toBe(false); // non-solid
    expect(decorSolidAt(placed, "house", 5, 5)).toBe(false); // candle non-solid
    expect(decorSolidAt(placed, "house", 10, 10)).toBe(false); // khác zone
  });
});

describe("farmStore placedDecor + decorOwned (W3 P2)", () => {
  /** Tìm tile farm đặt ĐƯỢC fence (dùng đúng canPlaceDecor như store — tránh
   *  lệch điều kiện giữa test và probe thật). Vùng quét 25..55. */
  function freeTile(): { x: number; y: number } {
    const s = useFarmStore.getState();
    const layout = getZone("farm");
    for (let y = 25; y < 55; y++) {
      for (let x = 25; x < 55; x++) {
        const ok = canPlaceDecor(fence, x, y, 0, {
          zone: "farm",
          cols: layout.cols,
          rows: layout.rows,
          terrainAt: (px, py) => s.getTile(px, py),
          solidAt: (px, py) => isFarmScenerySolid(px, py) || s.isSolid(px, py),
          cropAt: (px, py) => !!s.crops[py * MAP_COLS + px],
          warps: layout.warps.map((w) => ({ x: w.x, y: w.y })),
          decor: s.placedDecor.filter((d) => d.zone === "farm"),
        });
        if (ok.ok) return { x, y };
      }
    }
    throw new Error("no free tile");
  }

  beforeEach(() => {
    useFarmStore.getState().reset();
    useFarmStore.getState().hydrate({
      placedDecor: [],
      decorOwned: { fence_wood: 2 },
    } as never);
  });

  it("placeDecor: trừ kho, thêm placement; hết kho → false", () => {
    const st = useFarmStore.getState();
    const a = freeTile();
    expect(st.placeDecor("fence_wood", a.x, a.y, 0)).toBe(true);
    expect(useFarmStore.getState().placedDecor.length).toBe(1);
    expect(useFarmStore.getState().decorOwned.fence_wood).toBe(1);
    const b = freeTile();
    expect(useFarmStore.getState().placeDecor("fence_wood", b.x, b.y, 0)).toBe(true);
    expect(useFarmStore.getState().placeDecor("fence_wood", 25, 25, 0)).toBe(false); // hết kho
    expect(useFarmStore.getState().placedDecor.length).toBe(2);
  });

  it("placeDecor vị trí không hợp lệ → false, không mất kho", () => {
    const st = useFarmStore.getState();
    expect(st.placeDecor("fence_wood", 0, 59, 0)).toBe(false); // tràn biên
    expect(st.decorOwned.fence_wood).toBe(2);
    expect(st.placedDecor.length).toBe(0);
  });

  it("removeDecor: trả item về kho; uid lạ → false", () => {
    const st = useFarmStore.getState();
    const a = freeTile();
    expect(st.placeDecor("fence_wood", a.x, a.y, 0)).toBe(true);
    const uid = useFarmStore.getState().placedDecor[0].uid;
    expect(useFarmStore.getState().removeDecor(uid)).toBe(true);
    expect(useFarmStore.getState().decorOwned.fence_wood).toBe(2);
    expect(useFarmStore.getState().placedDecor.length).toBe(0);
    expect(useFarmStore.getState().removeDecor("khong_co")).toBe(false);
  });

  it("sanitize hydrate: defId lạ bỏ, tọa độ sai bỏ, rot lệch về 0, dedupe uid", () => {
    const dirty = [
      { uid: "a", defId: "fence_wood", zone: "farm", tx: 5, ty: 5, rot: 90, flip: true },
      { uid: "a", defId: "fence_wood", zone: "farm", tx: 5, ty: 5, rot: 0, flip: false }, // dup uid
      { uid: "b", defId: "ma_zui", zone: "farm", tx: 5, ty: 6, rot: 0, flip: false },   // def lạ
      { uid: "c", defId: "fence_wood", zone: "farm", tx: 999, ty: 5, rot: 0, flip: false }, // out
      { uid: "d", defId: "candle", zone: "house", tx: 5, ty: 5, rot: 0, flip: false },   // house ok
      { uid: "e", defId: "fountain", zone: "farm", tx: 40, ty: 40, rot: 45, flip: false }, // rot lạ → 0
    ] as PlacedDecor[];
    const out = sanitizePlacedDecor(dirty);
    expect(out.length).toBe(3);
    expect(out.find((p) => p.uid === "e")?.rot).toBe(0);
    expect(out.find((p) => p.uid === "d")).toBeTruthy();
  });

  it("save schema 9 — migrate v8 thiếu placedDecor → default; v9 passthrough", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(12); // W9 tutorial
    const v8 = migrate({
      version: 8,
      game: { day: 2, season: "Spring", gold: 100, energy: 90, buffs: {} },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {}, silo: {} },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 9, y: 22 },
    })!;
    expect(v8.version).toBe(12); // W9 tutorial
    expect(v8.farm.placedDecor).toEqual([]);
    expect(v8.farm.decorOwned).toEqual({});
    const v9 = migrate({
      version: 9,
      game: { day: 2, season: "Spring", gold: 1, energy: 1 },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {}, placedDecor: [{ uid: "z", defId: "bench", zone: "farm", tx: 3, ty: 3, rot: 0, flip: false }], decorOwned: { bench: 0 } },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 1, y: 1 },
    })!;
    expect(v9.farm.placedDecor?.length).toBe(1);
  });
});
