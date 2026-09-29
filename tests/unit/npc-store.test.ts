import { describe, it, expect, beforeEach } from "vitest";
import { useNpcStore, FRIENDSHIP_MAX, HEARTS_MAX } from "../../src/store/npcStore";

// npcStore friendship/gift/reset. Trước đây SettingsPanel doReset dùng hydrate({})
// — hydrate fallback `data.friendship ?? s.friendship` giữ friendship cũ khi
// undefined → reset farm không reset quan hệ NPC (inconsistent). Test reset() mới.

describe("npcStore", () => {
  beforeEach(() => {
    useNpcStore.getState().reset();
  });

  it("reset() → friendship về 0 cho mọi NPC, met/talked/gifted rỗng", () => {
    // Tạo state dirty
    useNpcStore.getState().hydrate({
      friendship: { alaric: 500, gaston: 100 },
      talkedToday: { alaric: true },
      giftedToday: { alaric: true },
      metNpcs: { alaric: true, gaston: true },
    });
    useNpcStore.getState().reset();
    const s = useNpcStore.getState();
    expect(s.friendship["alaric"]).toBe(0);
    expect(s.friendship["gaston"]).toBe(0);
    expect(s.metNpcs).toEqual({});
    expect(s.talkedToday).toEqual({});
    expect(s.giftedToday).toEqual({});
    expect(s.metCount()).toBe(0);
  });

  it("hydrate({}) KHÔNG reset friendship (fallback giữ state cũ) — đúng intent trust-boundary", () => {
    useNpcStore.getState().hydrate({ friendship: { alaric: 500 } });
    useNpcStore.getState().hydrate({});
    expect(useNpcStore.getState().friendship["alaric"]).toBe(500);
  });

  it("gift loved → +80, clamp FRIENDSHIP_MAX, met sau talk", () => {
    useNpcStore.getState().talk("alaric");
    useNpcStore.getState().gift("alaric", "loved");
    expect(useNpcStore.getState().friendship["alaric"]).toBeGreaterThanOrEqual(80);
    expect(useNpcStore.getState().isMet("alaric")).toBe(true);
  });

  it("gift hated → -40 nhưng floor 0", () => {
    useNpcStore.getState().gift("gaston", "hated");
    expect(useNpcStore.getState().friendship["gaston"]).toBe(0); // clamp floor
  });

  it("hearts clamp: friendship max → 10 hearts", () => {
    useNpcStore.getState().hydrate({ friendship: { alaric: FRIENDSHIP_MAX } });
    expect(useNpcStore.getState().hearts("alaric")).toBe(HEARTS_MAX);
    expect(useNpcStore.getState().hearts("alaric")).toBe(10);
  });
});
