import { describe, expect, it, beforeEach } from "vitest";
import { useQuestStore } from "@/store/questStore";
import { useTutorialStore } from "@/store/tutorialStore";
import { useGameStore } from "@/store/gameStore";
import { useProgressionStore } from "@/store/progressionStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useFarmStore } from "@/store/farmStore";
import {
  TUTORIAL_ORDER,
  tutorialStepIndex,
} from "@/lib/game/tutorial/tutorial-catalog";

beforeEach(() => {
  useQuestStore.getState().reset();
  useTutorialStore.getState().reset();
  useGameStore.setState({ gold: 0 });
  useProgressionStore.setState({ level: 1 });
  useInventoryStore.setState({ slots: Array(12).fill(null), selectedSlot: 0 });
});

describe("questStore tutorial tuyến tính", () => {
  it("khởi đầu: step 0 = t_till, chưa có claim", () => {
    const s = useQuestStore.getState();
    expect(s.tutorialStep).toBe(0);
    expect(s.tutorialClaimed).toEqual([]);
    expect(s.tutorialActive()).toBe("t_till");
  });

  it("claimTutorial chặn khi check chưa pass (chưa cuốc đất)", () => {
    expect(useQuestStore.getState().claimTutorial()).toBe(false);
    expect(useQuestStore.getState().tutorialStep).toBe(0);
  });

  it("pass step 0 (cuốc 1 ô) → claim thành công: +gold, +item, step 1", () => {
    useTutorialStore.getState().tickTill();
    expect(useQuestStore.getState().claimTutorial()).toBe(true);
    const s = useQuestStore.getState();
    expect(s.tutorialStep).toBe(1);
    expect(s.tutorialActive()).toBe("t_plant_water");
    expect(s.tutorialClaimed).toEqual(["t_till"]);
    expect(useGameStore.getState().gold).toBe(50); // t_till reward 50
    expect(useInventoryStore.getState().countItem("parsnip_seed")).toBeGreaterThanOrEqual(3);
  });

  it("claim lặp cùng step → false, không double reward", () => {
    useTutorialStore.getState().tickTill();
    expect(useQuestStore.getState().claimTutorial()).toBe(true);
    const goldAfter = useGameStore.getState().gold;
    expect(useQuestStore.getState().claimTutorial()).toBe(false);
    expect(useQuestStore.getState().tutorialStep).toBe(1);
    expect(useGameStore.getState().gold).toBe(goldAfter);
  });

  it("step cuối t_raid_first claim xong → step 14, active null, claim false", () => {
    // Simulate đã claim 13 bước trước + pass bước 14.
    useQuestStore.setState({
      tutorialStep: 13,
      tutorialClaimed: [...TUTORIAL_ORDER.slice(0, 13)],
    });
    useTutorialStore.getState().tickRaidEscape();
    expect(useQuestStore.getState().claimTutorial()).toBe(true);
    const s = useQuestStore.getState();
    expect(s.tutorialStep).toBe(14);
    expect(s.tutorialActive()).toBeNull();
    expect(s.tutorialClaimed).toHaveLength(14);
    expect(useQuestStore.getState().claimTutorial()).toBe(false);
    expect(useGameStore.getState().gold).toBe(400); // t_raid_first reward
  });

  it("reward item tính đủ xuyên 14 claim — mọi item drop vào inventory hoặc silo", () => {
    // Full chain: giả lập làm mọi hành động rồi claim tuần tự.
    const actions = [
      () => useTutorialStore.getState().tickTill(),
      () => {
        useTutorialStore.getState().tickPlant();
        useTutorialStore.getState().tickWater();
      },
      () => useTutorialStore.getState().tickHarvest(),
      () => {
        useTutorialStore.getState().tickHarvest();
        useTutorialStore.getState().tickSell();
      },
      () => useGameStore.setState({ day: 2 }),
      () => useTutorialStore.getState().tickFish(),
      () => useTutorialStore.getState().tickFry(),
      () => useTutorialStore.getState().tickCook(),
      () => useTutorialStore.getState().tickEat(),
      () => useTutorialStore.getState().tickDecor(),
      () => useTutorialStore.getState().tickVisit(),
      () => useTutorialStore.getState().tickMonsterDefeat(),
      () => useTutorialStore.getState().tickMount(),
      () => useTutorialStore.getState().tickRaidEscape(),
    ];
    let claimed = 0;
    for (let i = 0; i < TUTORIAL_ORDER.length; i++) {
      actions[i]();
      if (useQuestStore.getState().claimTutorial()) claimed++;
      else break;
    }
    expect(claimed).toBe(14);
    expect(useQuestStore.getState().tutorialStep).toBe(14);
    // Tổng vàng 14 bước = 1980 (50+60+70+80+90+100+110+120+130+150+170+200+250+400).
    // Chính xác tuyệt đối chứng minh mọi claim đúng 1 lần, không double, không thiếu.
    expect(useGameStore.getState().gold).toBe(1980);
    expect(useQuestStore.getState().tutorialClaimed.length).toBe(14);
    // Quest item ket_ (không thể trộm): thư mở đầu + cúp cuối phải vào inventory.
    expect(useInventoryStore.getState().countItem("ket_letter_sealed")).toBe(1);
    expect(useInventoryStore.getState().countItem("ket_festival_trophy")).toBe(1);
    // Decor t_decor (birdhouse): quyền sở hữu decor, không phải inventory.
    expect(useFarmStore.getState().decorOwned.birdhouse).toBeGreaterThanOrEqual(1);
  });

  it("hydrate floor step theo claimed đã sanitize (id lạ bị lọc — không lệch step)", () => {
    // bogus bị lọc → claimed thật = 1, step phải floor về 1 chứ KHÔNG giữ 3 (length cũ).
    useQuestStore.getState().hydrate({
      tutorialStep: 0,
      tutorialClaimed: ["t_till", "bogus", "XXX", "zzz"] as never,
    } as never);
    const s = useQuestStore.getState();
    expect(s.tutorialClaimed).toEqual(["t_till"]);
    expect(s.tutorialStep).toBe(1);
    // Claim tiếp được bước t_plant_water — không kẹt.
    useTutorialStore.getState().tickPlant();
    useTutorialStore.getState().tickWater();
    expect(useQuestStore.getState().claimTutorial()).toBe(true);
    expect(useQuestStore.getState().tutorialStep).toBe(2);
  });

  it("hydrate sanitize tutorialStep/claimed — lạ/âm → fallback", () => {
    useQuestStore.getState().hydrate({ tutorialStep: 99, tutorialClaimed: ["t_till", "bogus", "x", 42 as never] } as never);
    const s = useQuestStore.getState();
    expect(s.tutorialStep).toBe(1); // claimed.length — không nhảy skip khi step raw = 99
    expect(s.tutorialClaimed).toEqual(["t_till"]); // chỉ giữ id thuộc TUTORIAL_ORDER
  });

  it("tutorialProgressOf trả progress step hiện tại", () => {
    useTutorialStore.getState().tickTill();
    const p = useQuestStore.getState().tutorialProgressOf();
    expect(p).toEqual([1, 1]);
    expect(useQuestStore.getState().tutorialStep).toBe(0);
  });
});

describe("tutorialStepIndex bridge", () => {
  it("index tuần tự khớp TUTORIAL_ORDER", () => {
    TUTORIAL_ORDER.forEach((id, i) => expect(tutorialStepIndex(id)).toBe(i));
  });
});