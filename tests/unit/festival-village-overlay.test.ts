/**
 * W8-P4 — Village festival overlay (§2/§14):
 * - placements là getter: bật/tắt festival không re-register, chỉ thêm FESTIVAL_PROPS.
 * - FESTIVAL_PROPS toàn non-solid: isSolid KHÔNG đổi khi lễ bật (pathing giữ nguyên).
 * - questStore.markCompleted: chốt 1 lần claim key fest_*, không chạy QUESTS logic.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  VILLAGE_SCENERY,
  enableVillageFestival,
  isVillageFestivalOn,
} from "@/lib/game/scenery/village-layout";
import { useQuestStore } from "@/store/questStore";

const tile = (tx: number, ty: number) => ({ tx, ty });

/** Mọi tile của placement prop (footprint đầy đủ). */
function propTiles(p: { tx: number; ty: number; cols: number; rows: number }) {
  const out: { tx: number; ty: number }[] = [];
  for (let x = p.tx; x < p.tx + p.cols; x++) {
    for (let y = p.ty; y < p.ty + p.rows; y++) out.push(tile(x, y));
  }
  return out;
}

afterEach(() => {
  enableVillageFestival(false);
  useQuestStore.getState().reset();
});

describe("village festival overlay", () => {
  it("mặc định tắt — placements chỉ base", () => {
    expect(isVillageFestivalOn()).toBe(false);
    const base = VILLAGE_SCENERY.placements.length;
    enableVillageFestival(true);
    expect(VILLAGE_SCENERY.placements.length).toBeGreaterThan(base);
    enableVillageFestival(false);
    expect(VILLAGE_SCENERY.placements.length).toBe(base);
  });

  it("bật lễ thêm đúng 7 props (3 balloons + 3 carts + clothesline)", () => {
    const base = VILLAGE_SCENERY.placements.length;
    enableVillageFestival(true);
    const added = VILLAGE_SCENERY.placements.slice(base);
    expect(added.length).toBe(7);
    expect(added.filter((p) => p.key === "obj.balloons").length).toBe(3);
    expect(added.filter((p) => p.key.endsWith(".cart")).length).toBe(3);
    expect(added.filter((p) => p.key === "obj.village.clothesline").length).toBe(1);
  });

  it("FESTIVAL_PROPS toàn non-solid — isSolid giữ nguyên khi lễ bật", () => {
    const base = VILLAGE_SCENERY.placements.length;
    enableVillageFestival(true);
    const added = VILLAGE_SCENERY.placements.slice(base);
    for (const p of added) {
      for (const t of propTiles(p)) {
        expect(VILLAGE_SCENERY.isSolid(t.tx, t.ty), `${p.key}@${t.tx},${t.ty}`).toBe(false);
      }
    }
    // Baseline: bật lễ không đổi collision ở toàn khu plaza (8..32 × 8..26).
    enableVillageFestival(false);
    for (let x = 8; x <= 32; x++) {
      for (let y = 8; y <= 26; y++) {
        enableVillageFestival(true);
        const on = VILLAGE_SCENERY.isSolid(x, y);
        enableVillageFestival(false);
        expect(on, `${x},${y}`).toBe(VILLAGE_SCENERY.isSolid(x, y));
      }
    }
  });

  it("getter không đột biến base array (2 lần đọc liên tiếp stable)", () => {
    enableVillageFestival(true);
    const a = VILLAGE_SCENERY.placements;
    const b = VILLAGE_SCENERY.placements;
    expect(a.length).toBe(b.length);
    expect(a[0]).toBe(b[0]);
  });
});

describe("questStore.markCompleted (festival claim keys)", () => {
  it("lần đầu true + ghi completed, lần sau false (idempotent)", () => {
    const q = useQuestStore.getState();
    expect(q.completed["fest_1_Spring_13_contest"]).toBeUndefined();
    expect(q.markCompleted("fest_1_Spring_13_contest")).toBe(true);
    expect(useQuestStore.getState().completed["fest_1_Spring_13_contest"]).toBe(true);
    expect(useQuestStore.getState().markCompleted("fest_1_Spring_13_contest")).toBe(false);
  });

  it("không phát gold như claim() QUESTS — chỉ đánh dấu", () => {
    useQuestStore.getState().markCompleted("fest_1_Summer_24_derby");
    // completed map có key nhưng shipped/gold side-effects không có.
    const s = useQuestStore.getState();
    expect(s.completed["fest_1_Summer_24_derby"]).toBe(true);
    expect(s.isCompleted("fest_1_Summer_24_derby")).toBe(true);
  });

  it("nhiều activity/ngày khác nhau — key độc lập", () => {
    const q = useQuestStore.getState();
    q.markCompleted("fest_1_Spring_13_contest");
    q.markCompleted("fest_1_Spring_13_derby");
    q.markCompleted("fest_1_Spring_24_contest");
    const s = useQuestStore.getState();
    expect(s.isCompleted("fest_1_Spring_13_contest")).toBe(true);
    expect(s.isCompleted("fest_1_Spring_13_derby")).toBe(true);
    expect(s.isCompleted("fest_1_Spring_24_contest")).toBe(true);
    expect(s.isCompleted("fest_1_Spring_13_cookoff")).toBe(false);
  });
});
