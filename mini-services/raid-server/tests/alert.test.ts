import { describe, it, expect } from "bun:test";
import { levelFromScore, bumpScore, decayScore, AlertState } from "../src/alert";

describe("levelFromScore (3 cấp — design §Raid HUD)", () => {
  it("score 0 → stealth", () => expect(levelFromScore(0)).toBe("stealth"));
  it("score 24 → stealth", () => expect(levelFromScore(24)).toBe("stealth"));
  it("score 25 → caution", () => expect(levelFromScore(25)).toBe("caution"));
  it("score 60 → caution", () => expect(levelFromScore(60)).toBe("caution"));
  it("score 79 → caution", () => expect(levelFromScore(79)).toBe("caution"));
  it("score 80 → alarm", () => expect(levelFromScore(80)).toBe("alarm"));
  it("score 100 → alarm", () => expect(levelFromScore(100)).toBe("alarm"));
});

describe("bumpScore (clamp [0,100])", () => {
  it("cộng thường", () => expect(bumpScore(50, 15)).toBe(65));
  it("clamp trên 100", () => expect(bumpScore(95, 20)).toBe(100));
  it("clamp dưới 0", () => expect(bumpScore(5, -20)).toBe(0));
});

describe("decayScore (grace 4s rồi -5/s)", () => {
  it("KHÔNG decay trong grace (3s)", () => {
    expect(decayScore(60, 3000, 3000)).toBe(60);
  });
  it("decay sau grace", () => {
    // 5s sau trigger, dt 1s → -5
    expect(decayScore(60, 1000, 5000)).toBe(55);
  });
  it("decay không xuống dưới 0", () => {
    expect(decayScore(2, 1000, 5000)).toBe(0);
  });
  it("decayMult phantom 1.5 → decay nhanh hơn (phase 4)", () => {
    // 5s sau trigger, dt 1s → -5 × 1.5 = -7.5
    expect(decayScore(60, 1000, 5000, 1.5)).toBe(52.5);
  });
  it("decayMult biome forest 1.2 (phase 7)", () => {
    expect(decayScore(60, 1000, 5000, 1.2)).toBe(54);
  });
});

describe("AlertState (class)", () => {
  it("bump tăng level + reset trigger", () => {
    let now = 1000;
    const a = new AlertState(() => now);
    expect(a.level).toBe("stealth");
    expect(a.bump(30)).toBe("caution"); // 0→30
    // grace trong 4s
    now = 4000;
    a.tick(3000);
    expect(a.score).toBe(30); // chưa decay
    // qua grace → decay
    now = 6000;
    a.tick(2000);
    expect(a.score).toBeLessThan(30);
  });
  it("bump tới alarm", () => {
    const a = new AlertState(() => 0);
    a.bump(85);
    expect(a.level).toBe("alarm");
  });
});
