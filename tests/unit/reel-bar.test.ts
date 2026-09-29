// Wave 1 P2 — reel bar physics (pure, TDD). Hybrid 2 lớp: cá medium/rare mới
// vào reel. Hold = bar tăng tốc lên, release = rơi; bar chồng fishTarget thì
// progress tăng, lệch thì giảm; >=1 caught, <=0 escaped. rng injectable.
import { describe, it, expect } from "vitest";
import {
  initReel,
  updateReel,
  type ReelState,
  REEL_TUNE,
} from "../../src/lib/game/fishing/reel-bar";

const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe("reel-bar (P2 pure)", () => {
  it("init: bar giữa, progress start, fishPos trong 0..1", () => {
    const r = initReel("medium", seq(0.5));
    expect(r.barPos).toBe(0.5);
    expect(r.progress).toBe(REEL_TUNE.progressStart);
    expect(r.fishPos).toBeGreaterThanOrEqual(0);
    expect(r.fishPos).toBeLessThanOrEqual(1);
  });

  it("dt=0 → state không đổi, outcome null", () => {
    const r = initReel("medium", seq(0.5));
    const out = updateReel(r, 0, false, seq(0.5));
    expect(out.state).toEqual(r);
    expect(out.outcome).toBeNull();
  });

  it("hold đủ lâu → bar lên chạm 1, clamp + vel 0 (không vọt)", () => {
    let r = initReel("medium", seq(0.5));
    for (let i = 0; i < 200; i++) r = updateReel(r, 0.05, true, seq(0.5)).state;
    expect(r.barPos).toBe(1);
    expect(r.barVel).toBeGreaterThanOrEqual(0);
  });

  it("thả liên tục → bar rơi về 0, clamp 0 (không âm)", () => {
    let r = initReel("medium", seq(0.5));
    // đưa bar lên trước
    for (let i = 0; i < 50; i++) r = updateReel(r, 0.05, true, seq(0.5)).state;
    const top = r.barPos;
    expect(top).toBeGreaterThan(0.5);
    for (let i = 0; i < 200; i++) r = updateReel(r, 0.05, false, seq(0.5)).state;
    expect(r.barPos).toBe(0);
  });

  it("bar TRÙNG fish (state tự tạo) → progress tăng → đạt 1 → caught", () => {
    let r: ReelState = {
      barPos: 0.5,
      barVel: 0,
      fishPos: 0.5,
      progress: REEL_TUNE.progressStart,
      t: 0,
      kind: "medium",
    };
    let outcome: string | null = null;
    for (let i = 0; i < 300 && !outcome; i++) {
      // người chơi hoàn hảo: đặt bar trùng fish + vel 0 mỗi frame (state surgery)
      const out = updateReel({ ...r, barPos: r.fishPos, barVel: 0 }, 0.05, false, seq(0.5));
      r = out.state;
      outcome = out.outcome;
    }
    expect(outcome).toBe("caught");
  });

  it("bar LỆCH fish hoàn toàn → progress giảm → 0 → escaped", () => {
    let r: ReelState = {
      barPos: 0,
      barVel: 0,
      fishPos: 1,
      progress: REEL_TUNE.progressStart,
      t: 0,
      kind: "medium",
    };
    let outcome: string | null = null;
    for (let i = 0; i < 300 && !outcome; i++) {
      const out = updateReel({ ...r, barPos: 0, fishPos: 1 }, 0.05, false, seq(0.5));
      r = out.state;
      outcome = out.outcome;
    }
    expect(outcome).toBe("escaped");
  });

  it("medium fish di chuyển sin (deterministic không rng); rare random-walk theo rng", () => {
    const a = initReel("medium", seq(0.5));
    const b = initReel("medium", seq(0.5));
    const ra1 = updateReel(a, 0.1, false, seq(0.5)).state;
    const rb1 = updateReel(b, 0.1, false, seq(0.5)).state;
    expect(ra1.fishPos).toBe(rb1.fishPos); // cùng seed → cùng vị trí
    const rare1 = updateReel(initReel("rare", seq(0.1)), 0.1, false, seq(0.9)).state;
    const rare2 = updateReel(initReel("rare", seq(0.1)), 0.1, false, seq(0.1)).state;
    expect(rare1.fishPos).not.toBe(rare2.fishPos); // rng khác → khác
  });
});
