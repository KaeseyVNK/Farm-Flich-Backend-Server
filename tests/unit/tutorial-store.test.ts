import { describe, expect, it, beforeEach } from "vitest";
import { useTutorialStore } from "@/store/tutorialStore";
import { useGameStore } from "@/store/gameStore";
import { useProgressionStore } from "@/store/progressionStore";
import { TUTORIAL_STEPS } from "@/lib/game/tutorial/tutorial-catalog";

beforeEach(() => {
  useTutorialStore.getState().reset();
});

describe("tutorialStore — counters probe", () => {
  it("probe() phản chiếu counters + level/day live từ gameStore", () => {
    useProgressionStore.setState({ level: 5 }); useGameStore.setState({ day: 3 });
    const p = useTutorialStore.getState().probe();
    expect(p.level).toBe(5);
    expect(p.day).toBe(3);
    expect(p.plotsHoed).toBe(0);
    useProgressionStore.setState({ level: 1 }); useGameStore.setState({ day: 1 });
  });

  it("mỗi tick tăng đúng counter", () => {
    const s = useTutorialStore.getState();
    s.tickTill();
    s.tickPlant();
    s.tickWater();
    s.tickHarvest();
    s.tickSell();
    s.tickFish();
    s.tickFry();
    s.tickCook();
    s.tickEat();
    s.tickDecor();
    s.tickVisit();
    s.tickMount();
    s.tickMonsterDefeat();
    s.tickRaidEscape();
    s.tickFestival();
    const p = useTutorialStore.getState().probe();
    expect(p.plotsHoed).toBe(1);
    expect(p.cropsPlanted).toBe(1);
    expect(p.cropsWatered).toBe(1);
    expect(p.harvested).toBe(1);
    expect(p.itemsSold).toBe(1);
    expect(p.fishCaught).toBe(1);
    expect(p.fryStocked).toBe(1);
    expect(p.dishCooked).toBe(1);
    expect(p.dishEaten).toBe(1);
    expect(p.decorPlaced).toBe(1);
    expect(p.visitorsOpened).toBe(1);
    expect(p.mountRidden).toBe(1);
    expect(p.monstersDefeated).toBe(1);
    expect(p.raidEscaped).toBe(1);
    expect(p.festivalClaimed).toBe(1);
  });

  it("tickSell tăng itemsSold", () => {
    useTutorialStore.getState().tickSell();
    const p = useTutorialStore.getState().probe();
    expect(p.itemsSold).toBe(1);
    expect(p.harvested).toBe(0);
  });

  it("tick lặp tăng dần (đếm tuyệt đối — nhiều lần hành động vẫn hợp lệ)", () => {
    useTutorialStore.getState().tickHarvest();
    useTutorialStore.getState().tickHarvest();
    expect(useTutorialStore.getState().probe().harvested).toBe(2);
  });

  it("reset về zero nhưng level/day vẫn live", () => {
    useProgressionStore.setState({ level: 4 }); useGameStore.setState({ day: 10 });
    useTutorialStore.getState().tickHarvest();
    useTutorialStore.getState().reset();
    const p = useTutorialStore.getState().probe();
    expect(p.harvested).toBe(0);
    expect(p.plotsHoed).toBe(0);
    expect(p.level).toBe(4);
    expect(p.day).toBe(10);
    useProgressionStore.setState({ level: 1 }); useGameStore.setState({ day: 1 });
  });

  it("mọi step trong catalog check được bằng probe từ store (integration)", () => {
    // Chơi chuỗi qua store: sau khi làm đủ mọi hành động, step cuối check pass.
    const s = useTutorialStore.getState();
    s.tickTill();
    s.tickPlant();
    s.tickWater();
    s.tickHarvest();
    s.tickSell();
    s.tickFish();
    s.tickFry();
    s.tickCook();
    s.tickEat();
    s.tickDecor();
    s.tickVisit();
    s.tickMount();
    s.tickMonsterDefeat();
    s.tickRaidEscape();
    useProgressionStore.setState({ level: 5 }); useGameStore.setState({ day: 3 });
    const p = useTutorialStore.getState().probe();
    expect(TUTORIAL_STEPS.every((t) => t.check(p))).toBe(true);
    useProgressionStore.setState({ level: 1 }); useGameStore.setState({ day: 1 });
  });

  it("probe cap 999 — chống phình", () => {
    for (let i = 0; i < 1200; i++) useTutorialStore.getState().tickHarvest();
    expect(useTutorialStore.getState().probe().harvested).toBe(999);
  });
});