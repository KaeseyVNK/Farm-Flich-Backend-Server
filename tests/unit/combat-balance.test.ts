// Wave 5 P4 — balance sanity + cozy-death policy tests.
// Farm-safe (ENEMY_ZONES chỉ deepforest) đã cover ở deepforest-enemy-catalog.test.ts;
// đây khóa bounds TUNE + def quái + phạt ngất để ai chỉnh balance sau phải ý thức.
import { describe, expect, it } from "vitest";
import { COMBAT_TUNE, ENEMIES } from "@/lib/game/combat/enemy-catalog";
import { COZY_DEATH, faintPenalty } from "@/lib/game/combat/cozy-death";
import { useGameStore } from "@/store/gameStore";

describe("COMBAT_TUNE bounds (cozy — đừng làm game thành souls-like)", () => {
  it("swing đạt vừa tay: reach 1–2.5 tile, arc 60–180°, damage ≥ 1", () => {
    expect(COMBAT_TUNE.swingReachTiles).toBeGreaterThanOrEqual(1);
    expect(COMBAT_TUNE.swingReachTiles).toBeLessThanOrEqual(2.5);
    expect(COMBAT_TUNE.swingArcDeg).toBeGreaterThanOrEqual(60);
    expect(COMBAT_TUNE.swingArcDeg).toBeLessThanOrEqual(180);
    expect(COMBAT_TUNE.swordDamage).toBeGreaterThanOrEqual(1);
  });
  it("invuln đủ dài để thoát (≥600ms) nhưng không vô địch vĩnh viễn (≤3s)", () => {
    expect(COMBAT_TUNE.invulnMs).toBeGreaterThanOrEqual(600);
    expect(COMBAT_TUNE.invulnMs).toBeLessThanOrEqual(3000);
  });
  it("leash ≥ 6 tile — quái chịu bỏ cuộc", () => {
    expect(COMBAT_TUNE.leashTiles).toBeGreaterThanOrEqual(6);
  });
  it("wander pause min < max và dương", () => {
    const [min, max] = COMBAT_TUNE.wanderPauseMs;
    expect(min).toBeGreaterThan(0);
    expect(min).toBeLessThan(max);
  });
});

describe("enemy defs trong dải cozy", () => {
  it("hp 1–8, aggro 3–8 tile, speed < 120 px/s (chậm hơn player chạy)", () => {
    for (const e of ENEMIES) {
      expect(e.hp).toBeGreaterThanOrEqual(1);
      expect(e.hp).toBeLessThanOrEqual(8);
      expect(e.aggroTiles).toBeGreaterThanOrEqual(3);
      expect(e.aggroTiles).toBeLessThanOrEqual(8);
      expect(e.speed).toBeLessThan(120);
    }
  });
  it("đánh 1 con không quá 8 nhát kiếm (hp ≤ 8 × damage ≥ 1)", () => {
    for (const e of ENEMIES) {
      expect(Math.ceil(e.hp / COMBAT_TUNE.swordDamage)).toBeLessThanOrEqual(8);
    }
  });
  it("chạm 1 lần không giết player khỏe (damageEnergy ≤ 12)", () => {
    for (const e of ENEMIES) {
      expect(e.damageEnergy).toBeLessThanOrEqual(12);
    }
  });
  it("respawn ≥ 30s — không trâu bò dồn dập", () => {
    for (const e of ENEMIES) {
      expect(e.respawnMs).toBeGreaterThanOrEqual(30_000);
    }
  });
});

describe("cozy-death faintPenalty", () => {
  it("5% vàng tròn xuống, không âm", () => {
    expect(faintPenalty(1000, 100).goldLoss).toBe(50);
    expect(faintPenalty(9, 100).goldLoss).toBe(0); // floor
    expect(faintPenalty(0, 100).goldLoss).toBe(0);
  });
  it("hồi 30% max energy, tối thiểu 1", () => {
    expect(faintPenalty(500, 100).respawnEnergy).toBe(30);
    expect(faintPenalty(500, 2).respawnEnergy).toBe(1); // floor(0.6)=0 → max 1
  });
  it("respawn tile là tile cửa nhà farm", () => {
    expect(COZY_DEATH.respawnTile).toEqual({ x: 12, y: 11 });
  });
});

describe("addEnergy clamp (chạm quái không làm energy âm)", () => {
  it("addEnergy(-999) chốt 0, không âm", () => {
    useGameStore.getState().setEnergy(10);
    useGameStore.getState().addEnergy(-9999);
    expect(useGameStore.getState().energy).toBe(0);
  });
});
