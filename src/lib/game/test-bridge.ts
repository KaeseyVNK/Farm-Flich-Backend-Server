// Dev/test-only bridge exposing internal game stores + engine hooks to the
// window. Used by Playwright E2E tests to read state deterministically and
// drive the canvas engine (teleport, interact) without pixel-riding.
//
// SAFETY: only attached when NEXT_PUBLIC_E2E=1 (never in normal prod/dev).

import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useFarmStore } from "@/store/farmStore";
import { useNpcStore } from "@/store/npcStore";
import { useQuestStore } from "@/store/questStore";
import { useUiStore } from "@/store/uiStore";
import { useProgressionStore } from "@/store/progressionStore";
import { useTutorialStore } from "@/store/tutorialStore";
import { TUTORIAL_ORDER } from "@/lib/game/tutorial/tutorial-catalog";
import { getGameBridge } from "@/lib/game/bridge";
import { gameActions } from "@/lib/game/actions";
import { initialiseFreshFarm } from "@/lib/game/new-farm-state";
import { useWorldStore } from "@/store/worldStore";
import { useMountStore } from "@/store/mountStore";
import { useRaidStore } from "@/store/raidStore";
import { setFishingRng, resetFishingRng, seededRng } from "@/lib/game/fishing/fishing-rng";

export interface GameTestApi {
  version: 1;
  state: {
    game: () => ReturnType<typeof useGameStore.getState>;
    inv: () => ReturnType<typeof useInventoryStore.getState>;
    farm: () => ReturnType<typeof useFarmStore.getState>;
    npc: () => ReturnType<typeof useNpcStore.getState>;
    quests: () => ReturnType<typeof useQuestStore.getState>;
    ui: () => ReturnType<typeof useUiStore.getState>;
    progression: () => ReturnType<typeof useProgressionStore.getState>;
    world: () => ReturnType<typeof useWorldStore.getState>;
    /** W6: mount state (owned/active/mounted). */
    mounts: () => ReturnType<typeof useMountStore.getState>;
    /** W9P5: raid state (e2e full-chain — setEnd exit probe t_raid_first). */
    raid: () => ReturnType<typeof useRaidStore.getState>;
    /** W9P5: tutorial counters (e2e debug — fishCaught probe chứng minh tickFish chạy). */
    tutorial: () => ReturnType<typeof useTutorialStore.getState>;
  };
  engine: () => ReturnType<typeof getGameBridge>;
  actions: {
    teleport: (x: number, y: number) => void;
    interact: () => void;
    sleep: () => void;
    endDay: () => void;
    save: () => Promise<boolean>;
    reset: () => void;
    /** Advance in-game clock by N ms (test-only — verifies FarmScene tick wiring). */
    tick: (ms: number) => void;
    /** Award XP (public production path — quest/raid/harvest hooks). */
    addXp: (amount: number) => void;
    /** Allocate perk point (public production path — skill tree). */
    allocatePerk: (tree: "farming" | "combat" | "social") => boolean;
    /** W1P6: cắm seed RNG cho session câu cá — e2e deterministic. */
    fishingRng: (seed: number) => void;
    fishingRngReset: () => void;
    /** W2P5: phát item cho e2e — túi trước, thừa trả về kho (khoá E2E). */
    giveItem: (itemId: string, qty: number) => number;
    /** W5: snapshot quái/pickups deepforest (scene-local; null ngoài zone). */
    combat: () => ReturnType<NonNullable<ReturnType<typeof getGameBridge>["getCombatSnapshot"]>>;
    /** W5: spawn enemy thử nghiệm tại tile (chỉ deepforest). */
    spawnEnemyAt: (defId: string, tx: number, ty: number) => boolean;
    /** W6: phát mount không trừ vàng (e2e — shop thật test qua UI riêng). */
    giveMount: (mountId: string) => boolean;
    /** W6: cộng vàng test (e2e — mua shop thật qua UI). */
    addGold: (amount: number) => void;
    /** W8: set thẳng year/season/day (e2e festival — ngày lễ 13/24 deterministic). */
    setDate: (year: number, season: "Spring" | "Summer" | "Fall" | "Winter", day: number) => void;
    /** W9P5: nhảy tutorialStep (e2e — chain test 2 bắt đầu từ step 6; UI claim
     *  path đã verify ở test 1). KHÔNG cấp reward — chỉ di chuyển con trỏ. */
    jumpTutorial: (step: number) => void;
    /** Bán qua production path (t_first_order — silo/túi). */
    sellItem: (itemId: string, qty: number) => number;
  };
}

export function installGameTestBridge(): void {
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_E2E !== "1") return;

  const api: GameTestApi = {
    version: 1,
    state: {
      game: () => useGameStore.getState(),
      inv: () => useInventoryStore.getState(),
      farm: () => useFarmStore.getState(),
      npc: () => useNpcStore.getState(),
      quests: () => useQuestStore.getState(),
      ui: () => useUiStore.getState(),
      progression: () => useProgressionStore.getState(),
      world: () => useWorldStore.getState(),
      mounts: () => useMountStore.getState(),
      raid: () => useRaidStore.getState(),
      tutorial: () => useTutorialStore.getState(),
    },
    engine: () => getGameBridge(),
    actions: {
      teleport: (x, y) => getGameBridge().teleportToTile?.(x, y),
      interact: () => getGameBridge().triggerInteract?.(),
      sleep: () => gameActions.endDay(false),
      endDay: () => gameActions.endDay(false),
      save: () => gameActions.saveToActiveSlot(),
      tick: (ms) => useGameStore.getState().tick(ms),
      addXp: (amount) => useProgressionStore.getState().addXp(amount),
      allocatePerk: (tree) => useProgressionStore.getState().allocatePerk(tree),
      fishingRng: (seed) => setFishingRng(seededRng(seed)),
      fishingRngReset: () => resetFishingRng(),
      giveItem: (itemId, qty) => {
        const inv = useInventoryStore.getState();
        const farm = useFarmStore.getState();
        const left = inv.addItem(itemId, qty);
        if (left > 0) farm.addToSilo(itemId, left);
        return left;
      },
      combat: () => getGameBridge().getCombatSnapshot?.() ?? null,
      spawnEnemyAt: (defId, tx, ty) => getGameBridge().spawnEnemy?.(defId, tx, ty) ?? false,
      giveMount: (mountId) => useMountStore.getState().acquire(mountId),
      addGold: (amount) => useGameStore.getState().addGold(amount),
      setDate: (year, season, day) => useGameStore.setState({ year, season, day }),
      jumpTutorial: (step) => {
        const n = Math.max(0, Math.min(step, TUTORIAL_ORDER.length));
        useQuestStore.setState({
          tutorialStep: n,
          tutorialClaimed: TUTORIAL_ORDER.slice(0, n),
        });
      },
      sellItem: (itemId, qty) => gameActions.sellItem(itemId, qty),
      reset: () => initialiseFreshFarm({ mode: "reset" }),
    },
  };

  (window as unknown as { __gameTest: GameTestApi }).__gameTest = api;
}
