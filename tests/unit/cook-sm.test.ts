import { describe, it, expect } from "vitest";
import {
  startCook,
  nextCook,
  cookQuality,
  cookOutput,
  COOK_TUNE,
  type CookSession,
} from "../../src/lib/game/cooking/cook-sm";

const rngSeq = (vals: number[]) => {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
};

/** Session tier2 giả lập: marker đặt tay để test đánh giá tap chính xác. */
function mkSession(over: Partial<CookSession>): CookSession {
  return {
    ...startCook({ id: "ck_omelet", rounds: 1, zoneWidth: 0.3 }, rngSeq([0.4])),
    ...over,
  } as CookSession;
}

describe("cook-sm (W2 P2) — minigame canh thời gian", () => {
  it("start: phase cooking, round 0, zone trong khung nhìn (không tràn 0..1)", () => {
    for (const zw of [0.2, 0.3]) {
      const s = startCook({ id: "ck_x", rounds: 2, zoneWidth: zw }, rngSeq([0.99, 0.0]));
      expect(s.phase).toBe("cooking");
      expect(s.round).toBe(0);
      expect(s.zoneStart).toBeGreaterThanOrEqual(COOK_TUNE.zoneMargin);
      expect(s.zoneStart + zw).toBeLessThanOrEqual(1 - COOK_TUNE.zoneMargin);
    }
  });

  it("tick: marker di chuyển theo dir * speed * dt, bật lại ở biên 0/1", () => {
    let s = mkSession({ marker: 0.5, dir: 1, zoneStart: 0.4, zoneWidth: 0.3 });
    s = nextCook(s, { type: "tick", dt: 0.1 }, rngSeq([0.5]));
    expect(s.marker).toBeCloseTo(0.5 + COOK_TUNE.markerSpeed[2] * 0.1, 5);
    // chạm biên 1 → bật đầu
    s = nextCook({ ...s, marker: 0.99, dir: 1 }, { type: "tick", dt: 0.1 }, rngSeq([0.5]));
    expect(s.marker).toBeLessThan(1);
    expect(s.dir).toBe(-1);
    // chạm biên 0 → bật lên
    s = nextCook({ ...s, marker: 0.01, dir: -1 }, { type: "tick", dt: 0.1 }, rngSeq([0.5]));
    expect(s.marker).toBeGreaterThanOrEqual(0);
    expect(s.dir).toBe(1);
  });

  it("tap đánh giá: perfect (lõi giữa) / ok (trong vùng) / miss (ngoài vùng)", () => {
    const zone = { zoneStart: 0.4, zoneWidth: 0.3 }; // center 0.55
    const perfect = nextCook(mkSession({ marker: 0.55, ...zone }), { type: "tap" }, rngSeq([0.5]));
    expect(perfect.results[0]).toBe("perfect");
    const ok = nextCook(mkSession({ marker: 0.45, ...zone }), { type: "tap" }, rngSeq([0.5]));
    expect(ok.results[0]).toBe("ok");
    const miss = nextCook(mkSession({ marker: 0.1, ...zone }), { type: "tap" }, rngSeq([0.5]));
    expect(miss.results[0]).toBe("miss");
  });

  it("tap trúng → vòng kế (zone mới theo rng); hết vòng → done", () => {
    let s = startCook({ id: "ck_x", rounds: 2, zoneWidth: 0.25 }, rngSeq([0.2, 0.7, 0.7]));
    s = { ...s, marker: 0.2 + 0.125 }; // center vòng 0
    s = nextCook(s, { type: "tap" }, rngSeq([0.7]));
    expect(s.round).toBe(1);
    expect(s.results.length).toBe(1);
    expect(s.zoneStart).toBeGreaterThan(0.25); // zone mới khác (rng 0.7)
    s = { ...s, marker: s.zoneStart + s.zoneWidth / 2 };
    s = nextCook(s, { type: "tap" }, rngSeq([0.7]));
    expect(s.phase).toBe("done");
    expect(s.results.length).toBe(2);
  });

  it("miss KHÔNG abort cả nồi — vẫn sang vòng kế (cozy, món vẫn ra)", () => {
    let s = startCook({ id: "ck_x", rounds: 2, zoneWidth: 0.25 }, rngSeq([0.2, 0.5]));
    s = { ...s, marker: 0.9 }; // ngoài zone [0.2..0.45]
    s = nextCook(s, { type: "tap" }, rngSeq([0.5]));
    expect(s.results[0]).toBe("miss");
    expect(s.phase).toBe("cooking");
    expect(s.round).toBe(1);
  });

  it("tap khi idle/done → no-op", () => {
    const s = startCook({ id: "ck_x", rounds: 1, zoneWidth: 0.3 }, rngSeq([0.4]));
    const idle = { ...s, phase: "idle" as const };
    expect(nextCook(idle, { type: "tap" }, rngSeq([0.5]))).toBe(idle);
    const done = { ...s, phase: "done" as const };
    expect(nextCook(done, { type: "tap" }, rngSeq([0.5]))).toBe(done);
  });

  it("abort: phase aborted (action layer không trừ nguyên liệu)", () => {
    const s = startCook({ id: "ck_x", rounds: 1, zoneWidth: 0.3 }, rngSeq([0.4]));
    const out = nextCook(s, { type: "abort" }, rngSeq([0.5]));
    expect(out.phase).toBe("aborted");
  });

  it("quality: all-perfect / all-hit / có-miss; output qty + inputLoss", () => {
    expect(cookQuality(["perfect", "perfect"])).toBe("perfect");
    expect(cookQuality(["perfect", "ok"])).toBe("good");
    expect(cookQuality(["ok", "miss"])).toBe("sloppy");
    const out2 = cookOutput(["perfect", "perfect"]);
    expect(out2).toEqual({ qty: 2, inputLossFrac: 0 });
    expect(cookOutput(["ok"])).toEqual({ qty: 1, inputLossFrac: 0 });
    expect(cookOutput(["miss"])).toEqual({ qty: 1, inputLossFrac: 0.5 });
  });

  it("tier 3 nhanh hơn tier 2 (markerSpeed)", () => {
    expect(COOK_TUNE.markerSpeed[3]).toBeGreaterThan(COOK_TUNE.markerSpeed[2]);
  });

  it("review-fix: marker khởi đầu + vòng kế LUÔN ngoài vùng ngon (chặn perfect frame đầu)", () => {
    for (let i = 0; i < 50; i++) {
      const s = startCook({ id: "ck_x", rounds: 2, zoneWidth: 0.25 }, rngSeq([i / 50, 0.5, 0.5]));
      const center = s.zoneStart + s.zoneWidth / 2;
      expect(Math.abs(s.marker - center)).toBeGreaterThan(s.zoneWidth / 2);
      // vòng 2 cũng vậy
      let s2 = { ...s, marker: s.zoneStart + s.zoneWidth }; // ngoài → tap ok
      s2 = nextCook(s2, { type: "tap" }, rngSeq([0.9, 0.5]));
      const c2 = s2.zoneStart + s2.zoneWidth / 2;
      expect(Math.abs(s2.marker - c2)).toBeGreaterThan(s2.zoneWidth / 2);
    }
  });
});
