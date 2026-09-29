// Wave 1 P2 — fishing state machine (pure, TDD). Bảng chuyển đầy đủ:
// idle → cast → casting → wait → bite → (tap) caught (common) | reel (m/r)
// → caught/escaped; miss bite window → escaped; cancel bất kỳ → idle.
// now (ms) + rng inject → deterministic.
import { describe, it, expect } from "vitest";
import {
  nextFishing,
  rollFish,
  FISHING_TUNE,
  idleSession,
  type FishingSession,
} from "../../src/lib/game/fishing/fishing-sm";

const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

// rng fake: mọi roll = value đầu; dùng seq riêng cho từng loại roll.
const RNG = () => seq(0.5);

function castAt(now: number, zone: "pond" | "lake" | "sea" = "pond", level = 1): FishingSession {
  return nextFishing(idleSession(), { type: "cast", now, zone, level }, RNG());
}

describe("fishing-sm transitions (P2 pure)", () => {
  it("cast → casting; tick quá castMs → wait (fish đã roll nhưng ẩn)", () => {
    const s1 = castAt(1000);
    expect(s1.phase).toBe("casting");
    expect(s1.fishId).toBeDefined();
    const s2 = nextFishing(s1, { type: "tick", now: 1000 + FISHING_TUNE.castMs + 1 }, RNG());
    expect(s2.phase).toBe("wait");
  });

  it("wait → tick qua waitDeadline → bite (đúng window theo rarity)", () => {
    let s = castAt(0);
    s = nextFishing(s, { type: "tick", now: FISHING_TUNE.castMs + 1 }, RNG());
    const waitMs = (s.biteAt ?? 0) - FISHING_TUNE.castMs;
    expect(waitMs).toBeGreaterThanOrEqual(FISHING_TUNE.waitMinMs);
    expect(waitMs).toBeLessThanOrEqual(FISHING_TUNE.waitMaxMs);
    const s2 = nextFishing(s, { type: "tick", now: (s.biteAt ?? 0) + 1 }, RNG());
    expect(s2.phase).toBe("bite");
    expect(s2.biteDeadline).toBeGreaterThan(s2.biteAt!);
  });

  it("bite + tap đúng lúc: common → caught ngay (tap-only layer)", () => {
    // rng ép roll cá common: pool pond lv1 chỉ có sunfish/perch (common) → OK
    let s = castAt(0);
    s = nextFishing(s, { type: "tick", now: FISHING_TUNE.castMs + 1 }, RNG());
    s = nextFishing(s, { type: "tick", now: s.biteAt! + 1 }, RNG());
    expect(s.phase).toBe("bite");
    const s2 = nextFishing(s, { type: "tap", now: s.biteAt! + 10 }, RNG());
    expect(s2.phase).toBe("caught");
    expect(s2.fishId).toBe(s.fishId);
  });

  it("tap trong wait → no-op (vẫn wait — không phạt giật sớm)", () => {
    let s = castAt(0);
    s = nextFishing(s, { type: "tick", now: FISHING_TUNE.castMs + 1 }, RNG());
    const s2 = nextFishing(s, { type: "tap", now: FISHING_TUNE.castMs + 50 }, RNG());
    expect(s2.phase).toBe("wait");
  });

  it("tick quá biteDeadline không tap → escaped (miss cửa sổ)", () => {
    let s = castAt(0);
    s = nextFishing(s, { type: "tick", now: FISHING_TUNE.castMs + 1 }, RNG());
    s = nextFishing(s, { type: "tick", now: s.biteAt! + 1 }, RNG());
    const s2 = nextFishing(s, { type: "tick", now: s.biteDeadline! + 1 }, RNG());
    expect(s2.phase).toBe("escaped");
  });

  it("cancel từ wait/bite/reel → idle ngay", () => {
    let s = castAt(0);
    s = nextFishing(s, { type: "tick", now: FISHING_TUNE.castMs + 1 }, RNG());
    expect(nextFishing(s, { type: "cancel" }, RNG()).phase).toBe("idle");
  });

  it("medium/rare sau tap → reel (init ReelState); tick dt+holding lái reel → caught", () => {
    // Ép roll rare sturgeon: pool lake lv4 gồm bass(c)+pike(m)+tiger_trout(r)+sturgeon(r)
    // weights c.7/m.25/r.05 → cần rng sequence ép chọn rare. Dùng rollFish trực tiếp
    // cho case này (sm test vẫn dùng qua nextFishing với rng ghim).
    const s0 = nextFishing(
      idleSession(),
      { type: "cast", now: 0, zone: "lake", level: 4 },
      seq(0.99, 0.5, 0.5, 0.5),
    );
    expect(s0.fishId).toMatch(/tiger_trout|sturgeon/);
    let s = nextFishing(s0, { type: "tick", now: FISHING_TUNE.castMs + 1 }, seq(0.5));
    s = nextFishing(s, { type: "tick", now: s.biteAt! + 1 }, seq(0.5));
    expect(s.phase).toBe("bite");
    const reeling = nextFishing(s, { type: "tap", now: s.biteAt! + 5 }, seq(0.5));
    expect(reeling.phase).toBe("reel");
    expect(reeling.reel).toBeDefined();

    // Lái reel: giữ bar bám fish mỗi tick (test điều khiển holding + bar qua update)
    let cur = reeling;
    let guard = 0;
    while (cur.phase === "reel" && guard++ < 500) {
      const reel = cur.reel!;
      const fishNext = reel.fishPos;
      cur = nextFishing(
        cur,
        { type: "tick", now: 1000 + guard * 50, dt: 0.05, holding: true },
        seq(0.5),
      );
      // test ép bar trùng fish bằng cách ghi đè reel state (sm là pure — được phép
      // constructing input): mô phỏng người chơi hoàn hảo
      if (cur.phase === "reel" && cur.reel) {
        cur = { ...cur, reel: { ...cur.reel, barPos: cur.reel.fishPos, barVel: 0 } };
      }
    }
    expect(cur.phase).toBe("caught");
  });

  it("rollFish weighted theo rarity với rng ghim", () => {
    // pool lake lv4: bass c(.7) pike m(.25) tiger_trout r(.025) sturgeon r(.025)
    // (rare weight .05 chia đều trong nhóm). rng<0.7 → common bass.
    expect(rollFish("lake", 4, seq(0.1)).id).toBe("bass");
    expect(rollFish("lake", 4, seq(0.8)).id).toBe("pike");
    const rare = rollFish("lake", 4, seq(0.999));
    expect(["tiger_trout", "sturgeon"]).toContain(rare.id);
  });

  it("phase cuối (caught/escaped) ổn định — event thêm không đổi", () => {
    let s = castAt(0);
    s = nextFishing(s, { type: "tick", now: FISHING_TUNE.castMs + 1 }, RNG());
    s = nextFishing(s, { type: "tick", now: s.biteAt! + 1 }, RNG());
    const done = nextFishing(s, { type: "tap", now: s.biteAt! + 2 }, RNG());
    expect(done.phase).toBe("caught");
    const still = nextFishing(done, { type: "tick", now: 99999 }, RNG());
    expect(still.phase).toBe("caught");
    expect(nextFishing(done, { type: "cast", now: 100000, zone: "sea", level: 1 }, RNG()).phase).toBe(
      "casting",
    );
  });
});
