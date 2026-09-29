// Wave 6 P2 — mountStore flows + hydrate sanitize + save migrate v10.
import { describe, expect, it, beforeEach } from "vitest";
import { useMountStore } from "@/store/mountStore";
import { mountKinetics, DEFAULT_KINETICS } from "@/lib/game/phaser/movement-kinetics";
import { mountById } from "@/lib/game/mounts/mount-catalog";
import { migrate, SAVE_SCHEMA_VERSION } from "@/lib/game/save";

const OK = { level: 9, zone: "farm", holdingTool: false, fishing: false };

describe("mountStore", () => {
  beforeEach(() => useMountStore.getState().reset());

  it("acquire thêm owned + active, chặn dup/id lạ", () => {
    expect(useMountStore.getState().acquire("bicycle")).toBe(true);
    expect(useMountStore.getState().acquire("bicycle")).toBe(false);
    expect(useMountStore.getState().acquire("moto")).toBe(false);
    expect(useMountStore.getState().owned).toEqual(["bicycle"]);
    expect(useMountStore.getState().active).toBe("bicycle");
  });

  it("mount gate full pass → mounted; dismount/toggle", () => {
    useMountStore.getState().acquire("bicycle");
    expect(useMountStore.getState().mount(OK)).toEqual({ ok: true });
    expect(useMountStore.getState().mounted).toBe(true);
    // toggle khi mounted → xuống
    useMountStore.getState().toggle(OK);
    expect(useMountStore.getState().mounted).toBe(false);
    // toggle khi xuống + cầm tool → từ chối, không lên
    expect(useMountStore.getState().toggle({ ...OK, holdingTool: true })).toEqual({ ok: false, reason: "tool" });
    expect(useMountStore.getState().mounted).toBe(false);
  });

  it("mount khi chưa sở hữu → unknown", () => {
    expect(useMountStore.getState().mount(OK)).toEqual({ ok: false, reason: "unknown" });
  });

  it("hydrate sanitize: owned lọc catalog, active ∈ owned, mounted reset", () => {
    useMountStore.getState().hydrate({
      owned: ["horse", "moto", "bicycle"],
      active: "moto",
      mounted: true, // không tin — luôn reset
    });
    expect(useMountStore.getState().owned).toEqual(["horse", "bicycle"]);
    expect(useMountStore.getState().active).toBeNull();
    expect(useMountStore.getState().mounted).toBe(false);
  });
});

describe("mountKinetics", () => {
  it("ngựa 1.5×/1.47×, xe 1.25×/1.24× — tròn số, accel giữ nguyên", () => {
    const horse = mountById("horse")!;
    const bike = mountById("bicycle")!;
    const hk = mountKinetics(horse.walkMult, horse.runMult);
    expect(hk.walkSpeed).toBe(180); // 120×1.5
    expect(hk.runSpeed).toBe(279); // 190×1.47 — Math.round
    expect(hk.accel).toBe(DEFAULT_KINETICS.accel);
    expect(hk.braking).toBe(DEFAULT_KINETICS.braking);
    const bk = mountKinetics(bike.walkMult, bike.runMult);
    expect(bk.walkSpeed).toBe(150);
    expect(bk.runSpeed).toBe(236); // 190×1.24
  });

  it("tốc mount không vượt ngưỡng render (farm full-zone render — <300px/s an toàn)", () => {
    for (const m of [mountById("horse")!, mountById("bicycle")!]) {
      const k = mountKinetics(m.walkMult, m.runMult);
      expect(k.runSpeed).toBeLessThan(300);
    }
  });
});

describe("save migrate v10 (mounts)", () => {
  const base = {
    version: 9, // save W5 cũ — không có mounts
    game: { day: 2, season: "Spring", seasonIndex: 0, year: 1, timeMinutes: 400, gold: 500, energy: 80 },
    inventory: { slots: [null], selectedSlot: 0 },
    farm: { terrain: [0, 0, 0, 0], crops: {}, objects: {} },
    npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
  };

  it("save v9 → v10: mounts default rỗng", () => {
    const out = migrate(base)!;
    expect(out.version).toBe(SAVE_SCHEMA_VERSION);
    expect(out.mounts).toEqual({ owned: [], active: null });
  });

  it("save v10 giữ mounts hợp lệ, lọc id lạ", () => {
    const out = migrate({ ...base, version: 10, mounts: { owned: ["horse", "ufo"], active: "ufo" } })!;
    expect(out.mounts).toEqual({ owned: ["horse"], active: null });
  });
});
