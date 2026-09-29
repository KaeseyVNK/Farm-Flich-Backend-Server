// Cross-store orchestration helpers used by UI panels & the game engine.
import { useInventoryStore } from "@/store/inventoryStore";
import { useGameStore, type GameState } from "@/store/gameStore";
import { useFarmStore, type FarmState } from "@/store/farmStore";
import { useNpcStore, type GiftReaction, type NpcState } from "@/store/npcStore";
import { useUiStore } from "@/store/uiStore";
import { useQuestStore } from "@/store/questStore";
import { useDecorModeStore } from "@/store/decorModeStore";
import { CROPS, RECIPES, NPCS, SHOP_SEEDS, SHOP_GOODS, getItem } from "@/lib/game/data";
import { SEASONS } from "@/lib/game/constants";
import { vendorSellPrice, shippingSellPrice, seedBuyPrice, ECONOMY } from "@/lib/game/economy";
import { getGameBridge, teleportToTileSafe } from "@/lib/game/bridge";
import { playSfx } from "@/lib/game/sfx";
import { awardXp, useProgressionStore } from "@/store/progressionStore";
import { seedUnlockLevel } from "@/lib/game/farm-catalog";
import { FRY, fryGrowDays, isFryItemId } from "@/lib/game/fish-catalog";
import { KITCHEN_RECIPES, missingInputs, buffForDish } from "@/lib/game/cooking/recipe-catalog";
import { cookOutput, type CookQuality } from "@/lib/game/cooking/cook-sm";
import { xpMultiplier } from "@/lib/game/buff";
import { decorById } from "@/lib/game/decor/decor-catalog";
import { canAdd } from "@/lib/game/silo";
import { ordersForDay } from "@/lib/game/farm-orders";
import { cookoffScore, COOKOFF_MAX_DISHES } from "@/lib/game/festival/festival-scoring";
import { useRaidStore } from "@/store/raidStore";
import { useWorldStore, type WorldState } from "@/store/worldStore";
import { useAnimalStore } from "@/store/animalStore";
import { useMountStore, type MountState } from "@/store/mountStore";
import { useTutorialStore } from "@/store/tutorialStore";
import type { FarmSaveData } from "@/lib/game/farm-service";
import { mountById } from "@/lib/game/mounts/mount-catalog";
import { canAffordEnergy } from "@/lib/game/interact";
import {
  energyCostWithPerks,
  doubleHarvestChance,
  seedSaverChance,
  sellPriceMultiplier,
} from "@/lib/game/progression/perk-effects";

// Module-level guard: mốc thời gian (ms) lần endDay gần nhất. Dùng timestamp
// window ngắn thay vì so sánh day — vì sleep() advance day NGAY trong lần gọi,
// guard theo `day === lastProcessedDay` không bao giờ chặn được double-invoke
// (lần 2 luôn thấy day mới). Window 100ms: dưới ngưỡng người bấm B 2 lần hợp lệ
// (ngủ → đọc toast → ngủ tiếp thường ≥ 1s), trên ngưỡng 1 frame (16ms) → chặn
// spam B / macro / B + 2am auto-collapse cùng frame, mà không chặn E2E loop
// (interval 150ms) hay người chơi thực.
let lastEndDayAt = -Infinity;
const END_DAY_MIN_INTERVAL_MS = 100;

/** Reset guard re-entrancy endDay — dùng cho test isolation (vitest chạy các
 *  it() liên tiếp trong <100ms, guard timestamp sẽ chặn nhầm test sau). */
export function resetEndDayGuard() {
  lastEndDayAt = -Infinity;
}

/**
 * Collect a full save snapshot from all stores. Used by manual save, autosave,
 * and the start-screen "continue" flow so the schema stays consistent.
 */
export function collectSaveData() {
  const game = useGameStore.getState();
  const inv = useInventoryStore.getState();
  const farm = useFarmStore.getState();
  const npc = useNpcStore.getState();
  const quests = useQuestStore.getState();
  const bridge = getGameBridge();
  const playerTile = bridge.getPlayerTile?.() ?? { x: 9, y: 22 };
  return {
    game: {
      day: game.day,
      season: game.season,
      seasonIndex: game.seasonIndex,
      year: game.year,
      timeMinutes: game.timeMinutes,
      gold: game.gold,
      energy: game.energy,
      maxEnergy: game.maxEnergy,
      collapsed: game.collapsed,
      totalEarned: game.totalEarned,
      toolsUsed: game.toolsUsed,
      buffs: game.buffs,
      catchLog: game.catchLog,
    },
    player: {
      x: playerTile.x,
      y: playerTile.y,
    },
    inventory: { slots: inv.slots, selectedSlot: inv.selectedSlot },
    farm: {
      terrain: farm.terrain,
      crops: farm.crops,
      objects: farm.objects,
      forage: farm.forage,
      shippingBoxes: farm.shippingBoxes,
      silo: farm.silo,
      filledOrders: farm.filledOrders,
      pondFish: farm.pondFish,
      placedDecor: farm.placedDecor,
      decorOwned: farm.decorOwned,
    },
    npc: {
      friendship: npc.friendship,
      talkedToday: npc.talkedToday,
      giftedToday: npc.giftedToday,
      metNpcs: npc.metNpcs,
    },
    quests: {
      completed: quests.completed,
      shipped: quests.shipped,
      shippedGold: quests.shippedGold,
      daysPlayed: quests.daysPlayed,
      tutorialStep: quests.tutorialStep,
      tutorialClaimed: quests.tutorialClaimed,
    },
    progression: {
      level: useProgressionStore.getState().level,
      xp: useProgressionStore.getState().xp,
      totalXp: useProgressionStore.getState().totalXp,
      skillPoints: useProgressionStore.getState().skillPoints,
      perkAllocations: useProgressionStore.getState().perkAllocations,
    },
    world: {
      zone: useWorldStore.getState().zone,
      wellRepaired: useWorldStore.getState().wellRepaired,
      waterCharges: useWorldStore.getState().waterCharges,
      minedRocks: useWorldStore.getState().minedRocks,
      defeatedSlimes: useWorldStore.getState().defeatedSlimes,
    },
    animals: { animals: useAnimalStore.getState().animals },
    mounts: {
      owned: useMountStore.getState().owned,
      active: useMountStore.getState().active,
    },
  };
}

/**
 * Map full save snapshot → LocalSave subset (sync.ts contract) cho migrate 1 chiều.
 * LocalSave = gold/game/player/farm/inventory — KHÔNG progression/npc/story (migrate
 * only cloud-farm state; progression/story cloud sync post-MVP). Inventory slots →
 * aggregate theo itemId (LocalSave.inventory là {itemId, qty}[] không slot).
 */
export function collectLocalSave(): import("./sync").LocalSave {
  const full = collectSaveData();
  const agg: Record<string, number> = {};
  for (const slot of full.inventory.slots) {
    if (slot && slot.qty > 0) agg[slot.itemId] = (agg[slot.itemId] ?? 0) + slot.qty;
  }
  return {
    gold: full.game.gold,
    game: {
      day: full.game.day,
      season: full.game.season,
      year: full.game.year,
      timeMinutes: full.game.timeMinutes,
      energy: full.game.energy,
    },
    player: full.player,
    farm: {
      terrain: full.farm.terrain,
      crops: full.farm.crops,
      objects: full.farm.objects,
      forage: full.farm.forage,
      shippingBoxes: full.farm.shippingBoxes,
    },
    inventory: Object.entries(agg).map(([itemId, qty]) => ({ itemId, qty })),
  };
}

// ── W7a-P3: cloud farm sync (mở blood-moon — Farm.gameMeta.day server-read) ──

/** Payload cloud sync từ store hiện tại (pure — test được). */
export function collectFarmCloudPayload(): FarmSaveData {
  const game = useGameStore.getState();
  const farm = useFarmStore.getState();
  const bridge = getGameBridge();
  return {
    terrain: farm.terrain,
    crops: farm.crops as unknown as Record<string, unknown>,
    objects: farm.objects as unknown as Record<string, unknown>,
    forage: farm.forage as unknown as Record<string, unknown>,
    shippingBoxes: farm.shippingBoxes as unknown as Record<string, unknown>,
    placedDecor: farm.placedDecor as unknown as unknown[],
    pondFish: farm.pondFish as unknown as unknown[],
    gameMeta: {
      day: game.day,
      season: game.season,
      year: game.year,
      timeMinutes: game.timeMinutes,
      energy: game.energy,
      player: bridge.getPlayerTile?.() ?? { x: 19, y: 20 },
    },
  };
}

let lastCloudSyncAt = 0;
const CLOUD_SYNC_THROTTLE_MS = 60_000;

/** Reset throttle cho test isolation. */
export function resetCloudSyncThrottleForTest(): void {
  lastCloudSyncAt = 0;
}

/**
 * Push farm lên cloud (throttle 1/phút, LWW version ở server; lock-check khi
 * RaidSession active đã có trong farm-service). Local-first: fail im lặng —
 * offline không chặn gameplay. Dynamic import server action để vitest không
 * kéo next/server lúc parse module.
 */
export function syncFarmCloud(): boolean {
  const now = Date.now();
  if (now - lastCloudSyncAt < CLOUD_SYNC_THROTTLE_MS) return false;
  lastCloudSyncAt = now;
  const payload = collectFarmCloudPayload();
  void import("@/app/actions/farm")
    .then((m) => m.saveFarmAction(payload))
    .catch(() => {
      // offline / unauthorized / raid active — local-first, thử lần throttle sau.
    });
  return true;
}

export const gameActions = {
  /** Sell a stackable item to a vendor (100% price). Phase 5: trừ SILO trước,
   * túi bù phần thiếu — nông sản sống trong kho, túi 12 slot chỉ giữ tool/seed.
   * Returns gold gained. */
  sellItem(itemId: string, qty: number): number {
    if (!Number.isInteger(qty) || qty <= 0) return 0;
    const farm = useFarmStore.getState();
    const inv = useInventoryStore.getState();
    const game = useGameStore.getState();
    const ui = useUiStore.getState();
    const def = getItem(itemId);
    if (!def || !def.sellPrice) {
      ui.notify("Không đủ để bán", "warn");
      return 0;
    }
    const fromSilo = Math.min(farm.silo[itemId] ?? 0, qty);
    const bagTake = Math.min(inv.countItem(itemId), qty - fromSilo);
    const sold = fromSilo + bagTake;
    if (sold <= 0) {
      ui.notify("Không đủ để bán", "warn");
      return 0;
    }
    if (fromSilo > 0) farm.removeFromSilo(itemId, fromSilo);
    // inv.sellItem cap theo have (Math.min(have, qty)) → bagTake đã min sẵn,
    // nhưng vẫn đo sold bằng số THỰC trừ để trackShipped ghi đúng progress quest.
    let base = fromSilo * def.sellPrice;
    if (bagTake > 0) base += inv.sellItem(itemId, bagTake);
    const mult = sellPriceMultiplier();
    const gained = mult > 1 ? Math.round(base * mult) : base;
    if (gained > 0 && sold > 0) {
      game.addGold(gained);
      ui.notify(
        `Đã bán ${sold} × ${def.name} với giá ${gained}g`,
        "success",
      );
      useQuestStore.getState().trackShipped(itemId, sold, gained);
      playSfx("coin");
      awardXp("sell");
      useTutorialStore.getState().tickSell();
    } else {
      ui.notify("Không đủ để bán", "warn");
    }
    return gained;
  },

  /** Phase 5: giao đơn hàng hôm nay — trừ silo trước, bag bù phần thiếu.
   * Đủ TẤT CẢ item mới trừ (no partial). +gold, +XP sell 1 lần. */
  tryFillOrder(orderId: string): boolean {
    const game = useGameStore.getState();
    const farm = useFarmStore.getState();
    const inv = useInventoryStore.getState();
    const ui = useUiStore.getState();
    const order = ordersForDay(game.day, useProgressionStore.getState().level).find(
      (o) => o.id === orderId,
    );
    if (!order) return false;
    // Mỗi đơn 1 lần/ngày — trước đây giao lại được vô hạn trong ngày (gold/XP
    // exploit: 100 parsnip → fill d1-a 50 lần = 4000g + 50 lần XP sell).
    if (farm.filledOrders.includes(orderId)) {
      ui.notify("Đơn này đã giao hôm nay rồi", "warn");
      return false;
    }
    for (const [item, want] of Object.entries(order.wants)) {
      const have = (farm.silo[item] ?? 0) + inv.countItem(item);
      if (have < want) {
        ui.notify("Không đủ hàng cho đơn này", "warn");
        return false;
      }
    }
    for (const [item, want] of Object.entries(order.wants)) {
      const fromSilo = farm.removeFromSilo(item, want);
      if (fromSilo < want) inv.removeItem(item, want - fromSilo);
    }
    game.addGold(order.gold);
    farm.markOrderFilled(order.id);
    ui.notify(`Đã giao đơn hàng · +${order.gold}g`, "success");
    playSfx("coin");
    awardXp("sell");
    useTutorialStore.getState().tickSell();
    return true;
  },

  /** W1P4: kết quả câu cá — silo trước, túi bù (pre-check V4 đảm bảo có chỗ). */
  catchFish(fishId: string): boolean {
    const farm = useFarmStore.getState();
    const inv = useInventoryStore.getState();
    const ui = useUiStore.getState();
    const def = getItem(fishId);
    if (!def) return false;
    if (farm.addToSilo(fishId, 1)) {
      ui.notify(`Đã câu được ${def.name}!`, "success");
    } else if (inv.addItem(fishId, 1) === 0) {
      // addItem trả LEFTOVER (0 = thêm hết) — không phải boolean.
      ui.notify(`Đã câu được ${def.name}! (vào túi)`, "success");
    } else {
      // Defense-in-depth: pre-check P3 phải chặn trước — tới đây là regression.
      ui.notify("Kho và túi đều đầy — cá bơi mất", "warn");
      return false;
    }
    playSfx("fishcatch");
    awardXp("fish");
    useTutorialStore.getState().tickFish();
    // W8 derby: ghi nhận cá trong ngày (chỉ khi award thành công).
    useGameStore.getState().logCatch(fishId);
    return true;
  },

  /** W2P4: nấu món ở bếp (kitchenpot). quality từ minigame (tier1 gọi "good").
   * Input = silo ∪ túi (nấu ở nhà dùng được cả kho) — consume SILO TRƯỚC.
   * sloppy (có miss) chỉ mất NỬA nguyên liệu (cozy — món vẫn ra); perfect ×2. */
  cook(recipeId: string, quality: CookQuality = "good"): boolean {
    const farm = useFarmStore.getState();
    const inv = useInventoryStore.getState();
    const ui = useUiStore.getState();
    const prog = useProgressionStore.getState();
    const recipe = KITCHEN_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return false;
    if (prog.level < recipe.unlockLevel) {
      ui.notify(`Công thức mở ở cấp ${recipe.unlockLevel}`, "warn");
      return false;
    }
    // avail = silo ∪ túi (missingInputs thuần nhận map gộp)
    const avail: Record<string, number> = { ...farm.silo };
    for (const s of inv.slots) if (s) avail[s.itemId] = (avail[s.itemId] ?? 0) + s.qty;
    const miss = missingInputs(recipe, avail);
    if (miss.length > 0) {
      const m = miss[0];
      ui.notify(`Thiếu ${getItem(m.itemId)?.name ?? m.itemId} (${m.need - m.have})`, "warn");
      return false;
    }
    const resultDef = getItem(recipe.outputItemId);
    if (!resultDef) return false;
    // Pre-check chỗ cho món TRƯỚC khi consume (pattern craft — tránh mất nguyên liệu
    // khi túi đầy). partialAdd mô phỏng addItem leftover.
    const resultStack = resultDef.stack ?? 1;
    const partialAdd = (qty: number): number => {
      let remaining = qty;
      for (const s of inv.slots) {
        if (remaining <= 0) break;
        if (s && s.itemId === recipe.outputItemId && s.qty < resultStack) {
          remaining -= resultStack - s.qty;
        } else if (s === null) {
          remaining -= resultStack;
        }
      }
      return Math.max(0, remaining);
    };
    const out = cookOutput([quality === "perfect" ? "perfect" : quality === "good" ? "ok" : "miss"]);
    if (partialAdd(out.qty) > 0) {
      ui.notify("Túi đầy — không chỗ cho món mới", "warn");
      return false;
    }
    // Consume mỗi nguyên liệu — SILO TRƯỚC, túi bù.
    // good/perfect: tiêu đủ; sloppy: chỉ mất nửa (ceil, tối thiểu 1 — món vẫn ra).
    for (const ing of recipe.inputs) {
      const remaining = out.inputLossFrac > 0 ? Math.max(1, Math.ceil(ing.qty / 2)) : ing.qty;
      const fromSilo = farm.removeFromSilo(ing.itemId, remaining);
      if (fromSilo < remaining) inv.removeItem(ing.itemId, remaining - fromSilo);
    }
    inv.addItem(recipe.outputItemId, out.qty);
    const game = useGameStore.getState();
    useProgressionStore
      .getState()
      .addXp(Math.round(recipe.cookXp * xpMultiplier(game.buffs, game.day, game.timeMinutes)));
    playSfx("cook");
    ui.notify(
      out.qty > 1 ? `Hoàn hảo! ${resultDef.name} ×2` : `Nấu xong ${resultDef.name}!`,
      "success",
    );
    useTutorialStore.getState().tickCook();
    return true;
  },

  /** W3P5: mua decor vào kho (chưa đặt) — gate level + vàng như buyFry. */
  buyDecor(defId: string): boolean {
    const game = useGameStore.getState();
    const ui = useUiStore.getState();
    const def = decorById(defId);
    if (!def) return false;
    // W8: event/trophy decor chỉ thưởng festival (§17) — không mua bằng gold.
    if (def.tier === "event") {
      useUiStore.getState().notify("Đồ lễ hội chỉ nhận qua phần thưởng festival!", "warn");
      return false;
    }
    const level = useProgressionStore.getState().level;
    if (level < def.unlockLevel) {
      ui.notify(`Trang trí mở ở cấp ${def.unlockLevel}`, "warn");
      return false;
    }
    if (game.gold < def.price) {
      ui.notify("Không đủ vàng", "warn");
      return false;
    }
    game.addGold(-def.price);
    useFarmStore.getState().ownDecor(defId);
    ui.notify(`Đã mua ${def.name}`, "success");
    playSfx("coin");
    return true;
  },

  /** W8 cook-off: nộp tối đa 3 món — consume khỏi túi, trả điểm (null nếu thiếu món). */
  submitCookoffDishes(dishIds: string[]): number | null {
    const inv = useInventoryStore.getState();
    const ui = useUiStore.getState();
    if (dishIds.length === 0 || dishIds.length > COOKOFF_MAX_DISHES) return null;
    // Verify đủ trước khi consume (không nộp dở).
    for (const id of dishIds) {
      if (inv.countItem(id) < dishIds.filter((x) => x === id).length) {
        ui.notify("Không đủ món để nộp", "warn");
        return null;
      }
    }
    for (const id of dishIds) {
      if (!inv.removeItem(id, 1)) return null; // race — defensive
    }
    const score = cookoffScore(dishIds);
    ui.notify(`🍳 Đã nộp ${dishIds.length} món — ${score} điểm cook-off!`, "success");
    return score;
  },

  /** W1P5: mua cá bột về túi (thả ao sau đó khi đứng cạnh ao farm). */
  buyFry(itemId: string): boolean {
    const game = useGameStore.getState();
    const ui = useUiStore.getState();
    const fry = FRY.find((f) => f.itemId === itemId);
    if (!fry) return false;
    if (game.gold < fry.price) {
      ui.notify("Không đủ vàng", "warn");
      return false;
    }
    const inv = useInventoryStore.getState();
    if (inv.addItem(itemId, 1) !== 0) {
      ui.notify("Túi đầy — không mua được cá bột", "warn");
      return false;
    }
    game.addGold(-fry.price);
    ui.notify(`Đã mua ${fry.name}`, "success");
    playSfx("coin");
    return true;
  },

  /** W1P5: thả cá bột đang cầm vào ao (scene kiểm tra đứng gần ao). */
  releaseFry(itemId: string): boolean {
    const inv = useInventoryStore.getState();
    const ui = useUiStore.getState();
    if (!isFryItemId(itemId)) return false;
    if (!useFarmStore.getState().stockFry(itemId)) {
      ui.notify("Ao đã đầy (tối đa 6 con)", "warn");
      return false;
    }
    inv.removeItem(itemId, 1);
    const fry = FRY.find((f) => f.itemId === itemId)!;
    ui.notify(`Đã thả ${fry.name} vào ao`, "success");
    playSfx("water");
    useTutorialStore.getState().tickFry();
    return true;
  },

  /** W1P5: thu toàn bộ cá trưởng thành trong ao → silo + XP mỗi con. */
  harvestPond(): number {
    const farm = useFarmStore.getState();
    const ui = useUiStore.getState();
    const level = useProgressionStore.getState().level;
    const mature = farm.pondFish.filter(
      (p) => p.daysGrown >= fryGrowDays(`fry_${p.fishId}`),
    );
    if (mature.length === 0) {
      ui.notify("Chưa có cá trưởng thành để thu", "info");
      return 0;
    }
    if (!canAdd(farm.silo, mature.length, level)) {
      ui.notify("Kho đầy — bán bớt rồi thu ao", "warn");
      return 0;
    }
    const got = farm.harvestPond();
    let count = 0;
    for (const g of got) {
      if (!farm.addToSilo(g.fishId, g.qty)) continue;
      count += g.qty;
      for (let i = 0; i < g.qty; i++) awardXp("fish"); // XP mỗi CON (review fix)
    }
    if (count > 0) {
      ui.notify(`Thu ao: ${count} cá vào kho!`, "success");
      playSfx("fishcatch");
    }
    return count;
  },

  /** Buy a seed from the shop (uses economy.json buy price). */
  buySeed(seedId: string, qty: number): boolean {
    if (!Number.isInteger(qty) || qty <= 0) return false;
    const game = useGameStore.getState();
    const inv = useInventoryStore.getState();
    const ui = useUiStore.getState();
    const def = getItem(seedId);
    if (!def) return false;
    // Phase 2 hayday: seed khóa theo level catalog — chặn TRƯỚC khi trừ vàng.
    const need = seedUnlockLevel(seedId);
    if (useProgressionStore.getState().level < need) {
      ui.notify(`Mở ở cấp ${need}`, "warn");
      return false;
    }
    const cost = seedBuyPrice(seedId) * qty;
    if (cost <= 0) {
      ui.notify("Mặt hàng này không bán", "warn");
      return false;
    }
    // Pre-check còn chỗ TRƯỚC khi spendGold — trước đây spend xong addItem bỏ qua
    // leftover → túi đầy mua hạt mất vàng KHÔNG nhận hạt (data loss im lặng).
    // Mô phỏng addItem (giống craft partialAdd): leftover giảm khi có stack cùng
    // seed chưa đầy hoặc slot trống. Không mutate trước khi trừ tiền.
    const def2 = getItem(seedId);
    const stack = def2?.stack ?? 1;
    const canFit = (qtyToFit: number): number => {
      let remaining = qtyToFit;
      for (const s of inv.slots) {
        if (remaining <= 0) break;
        if (s && s.itemId === seedId && s.qty < stack) remaining -= stack - s.qty;
        else if (s === null) remaining -= stack;
      }
      return Math.max(0, remaining);
    };
    if (canFit(qty) > 0) {
      ui.notify("Túi đầy — không mua được hạt giống", "warn");
      return false;
    }
    if (!game.spendGold(cost)) {
      ui.notify("Không đủ vàng", "error");
      return false;
    }
    const left = inv.addItem(seedId, qty);
    if (left > 0) {
      // Defensive — canFit đã chặn, nhưng addItem thực tế có thể khác (race).
      // Refund số hạt không nhận được để không mất vàng im lặng.
      game.addGold(Math.round((cost * left) / qty));
      ui.notify(`Túi đầy — hoàn ${Math.round((cost * left) / qty)}g`, "warn");
      return true;
    }
    ui.notify(`Đã mua ${qty} × ${def.name} với giá ${cost}g`, "success");
    return true;
  },

  /** W6: mua thú cưỡi — level gate + trừ vàng + acquire (không phải item — túi không đụng). */
  buyMount(mountId: string): boolean {
    const def = mountById(mountId);
    if (!def) return false;
    const ui = useUiStore.getState();
    const mounts = useMountStore.getState();
    if (mounts.owned.includes(mountId)) return false;
    if (useProgressionStore.getState().level < def.unlockLevel) {
      ui.notify(`${def.name} mở ở cấp ${def.unlockLevel}`, "warn");
      return false;
    }
    if (!useGameStore.getState().spendGold(def.price)) {
      ui.notify("Không đủ vàng", "warn");
      return false;
    }
    if (!mounts.acquire(mountId)) {
      useGameStore.getState().addGold(def.price); // hoàn nếu race fail
      return false;
    }
    playSfx("coin");
    ui.notify(`Đã mua ${def.icon} ${def.name}! Nhấn N để cưỡi`, "success");
    return true;
  },

  buyGood(itemId: string, qty: number): boolean {
    if (!SHOP_GOODS.includes(itemId)) return false;
    if (!Number.isInteger(qty) || qty <= 0) return false;
    const def = getItem(itemId);
    const game = useGameStore.getState();
    const inv = useInventoryStore.getState();
    const ui = useUiStore.getState();
    if (!def) return false;
    // Phase 2: wheat (feed) là Lv3 — cùng bảng seedUnlockLevel.
    const need = seedUnlockLevel(itemId);
    if (useProgressionStore.getState().level < need) {
      ui.notify(`Mở ở cấp ${need}`, "warn");
      return false;
    }
    const unit = ECONOMY.resources[itemId]?.buy ?? ECONOMY.resources[itemId]?.base ?? 0;
    const cost = unit * qty;
    if (cost <= 0 || !game.spendGold(cost)) {
      ui.notify("Không đủ vàng", "warn");
      return false;
    }
    const left = inv.addItem(itemId, qty);
    if (left > 0) {
      game.addGold(Math.round((cost * left) / qty));
      ui.notify("Túi đầy", "warn");
      return false;
    }
    ui.notify(`Đã mua ${qty} × ${def.name} với giá ${cost}g`, "success");
    return true;
  },

  /** Plant the currently selected seed on a tile (called by the game engine). */
  plantSelectedOnTile(x: number, y: number): boolean {
    const inv = useInventoryStore.getState();
    const farm = useFarmStore.getState();
    const ui = useUiStore.getState();
    const game = useGameStore.getState();
    const slot = inv.getSelectedSlot();
    if (!slot) {
      ui.notify("Hãy chọn hạt giống trước", "warn");
      return false;
    }
    const def = getItem(slot.itemId);
    if (!def || def.type !== "seed") {
      ui.notify("Hãy chọn hạt giống để trồng", "warn");
      return false;
    }
    const crop = def.growsInto ? CROPS[def.growsInto] : undefined;
    if (crop && !crop.seasons.includes(game.season)) {
      ui.notify(`${crop.name} không mọc được trong ${game.season}`, "error");
      return false;
    }
    // Spend năng lượng TRƯỚC khi mutate farm/inventory — atomic. Trước đây
    // pre-check canAfford → farm.plant (mutate crop) → removeItem → spendEnergy
    // sau: nếu spendEnergy fail ở cuối, crop đã plant + seed đã remove (caller
    // thấy return false nhưng state đã mutate). Spend-first + refund khi plant
    // fail chặn free-plant race (comment cũ thừa nhận historic bug class này).
    const cost = energyCostWithPerks(1);
    if (!canAffordEnergy(cost)) {
      ui.notify("Không đủ thể lực để trồng", "error");
      return false;
    }
    if (!game.spendEnergy(cost)) {
      ui.notify("Hết thể lực", "warn");
      return false;
    }
    if (!farm.plant(x, y, def.growsInto!)) {
      game.addEnergy(cost); // refund — plant fail (đất chưa cuốc) không tốn energy
      ui.notify("Không trồng được — hãy cuốc đất trước", "warn");
      return false;
    }
    inv.removeItem(slot.itemId, 1);
    // Perk farm-6 (Seed Saver): 25% giữ hạt (trả lại 1 seed).
    if (Math.random() < seedSaverChance()) {
      inv.addItem(slot.itemId, 1);
      ui.notify(`${crop?.name ?? "hạt"} trồng xong 🌱 (giữ lại hạt!)`, "success");
    } else {
      ui.notify(`Đã trồng ${crop?.name ?? "hạt"} 🌱`, "success");
    }
    // Không recordToolUse — plant không phải công cụ; q_mining_level_2 "Dùng công
    // cụ 15 lần" đếm till/water/axe/etc, trồng lén đếm là sai quest semantics.
    awardXp("plant");
    return true;
  },

  /** Craft an item from a recipe. */
  craft(recipeId: string): boolean {
    const inv = useInventoryStore.getState();
    const ui = useUiStore.getState();
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe || !recipe.unlocked) {
      ui.notify("Công thức chưa mở khóa", "warn");
      return false;
    }
    for (const ing of recipe.ingredients) {
      if (inv.countItem(ing.item) < ing.qty) {
        ui.notify(`Cần thêm ${getItem(ing.item)?.name ?? ing.item}`, "warn");
        return false;
      }
    }
    // Guard result tồn tại — recipe có typo result id → addItem silent no-op
    // (getItem undefined → return qty), player mất nguyên liệu không nhận gì.
    if (!getItem(recipe.result)) {
      ui.notify("Công thức lỗi — báo admin", "error");
      return false;
    }
    // Pre-check còn chỗ cho result TRƯỚC khi removeItem ingredients. Trước đây
    // remove xong addItem bỏ qua leftover → túi đầy craft mất nguyên liệu không
    // nhận kết quả (data loss im lặng). Mô phỏng addItem: leftover giảm khi có
    // stack cùng item chưa đầy hoặc slot trống.
    const resultDef = getItem(recipe.result);
    const resultStack = resultDef?.stack ?? 1;
    const partialAdd = (qty: number): number => {
      let remaining = qty;
      for (const s of inv.slots) {
        if (remaining <= 0) break;
        if (s && s.itemId === recipe.result && s.qty < resultStack) {
          remaining -= resultStack - s.qty;
        } else if (s === null) {
          remaining -= resultStack;
        }
      }
      return Math.max(0, remaining);
    };
    if (partialAdd(recipe.resultQty) > 0) {
      ui.notify("Túi đầy — không chế tạo được", "warn");
      return false;
    }
    for (const ing of recipe.ingredients) {
      inv.removeItem(ing.item, ing.qty);
    }
    const left = inv.addItem(recipe.result, recipe.resultQty);
    if (left > 0) {
      ui.notify(`Túi đầy — chỉ nhận được ${recipe.resultQty - left}/${recipe.resultQty} ${resultDef?.name ?? recipe.result}`, "warn");
      return true;
    }
    ui.notify(`Đã chế tạo ${resultDef?.name ?? recipe.result}`, "success");
    return true;
  },

  /** Give a gift to an NPC (uses reaction tiers: loved/liked/neutral/hated). */
  giveGift(npcId: string, itemId: string): boolean {
    const inv = useInventoryStore.getState();
    const npc = useNpcStore.getState();
    const ui = useUiStore.getState();
    const def = getItem(itemId);
    const npcDef = NPCS[npcId];
    if (!def || !npcDef) return false;
    // Pre-check daily cap TRƯỚC khi removeItem — trước đây remove trước, refund
    // sau bằng addItem. Nếu inventory đầy (12 slot) lúc refund, addItem trả
    // leftover 1 → gift item bị destroy (data loss).
    if (npc.giftedToday[npcId]) {
      ui.notify(`Hôm nay bạn đã tặng ${npcDef.name} rồi`, "warn");
      return false;
    }
    if (!inv.removeItem(itemId, 1)) {
      ui.notify("Bạn không có vật phẩm đó", "warn");
      return false;
    }
    const reaction: GiftReaction = npc.reactionFor(npcId, itemId);
    const ok = npc.gift(npcId, reaction);
    if (!ok) {
      // refund (giftedToday vừa set trong gift() — race hiếm, vẫn refund an toàn
      // vì removeItem đã thành công, addItem lại không đầy do vừa rút 1 slot).
      inv.addItem(itemId, 1);
      ui.notify(`Hôm nay bạn đã tặng ${npcDef.name} rồi`, "warn");
      return false;
    }
    if (reaction === "loved")
      ui.notify(`${npcDef.name} rất thích ${def.name}! 💖`, "success");
    else if (reaction === "liked")
      ui.notify(`${npcDef.name} thích ${def.name}.`, "success");
    else if (reaction === "hated")
      ui.notify(`${npcDef.name} ghét ${def.name}. 😞`, "warn");
    else ui.notify(`${npcDef.name} nhận ${def.name}.`, "info");
    // XP chỉ cho reaction tích cực — trước đây hated cũng +XP → exploit level up
    // bằng cách tặng item ghét lặp lại (friendship floor 0, XP climb vô hạn).
    if (reaction !== "hated") awardXp("socialGift");
    return true;
  },

  /** Advance to next day. If collapsed (2am), apply penalty. Processes shipping boxes. */
  endDay(collapsed = false): void {
    // Guard: không ngủ khi có modal overlay mở (shop/gift/dialogue/cooking) — tránh
    // NewDayToast z-55 đè lên modal z-50 gây nhầm "game đứng" (audit H6).
    const uiState = useUiStore.getState();
    if (uiState.showShop || uiState.giftTarget || uiState.dialogueNpc || uiState.showCooking) {
      uiState.notify("Đóng cửa sổ đang mở trước khi đi ngủ.", "warn");
      return;
    }
    // W3P5-fix: decor mode đang bật (cursor có thể lệch zone sau collapse) —
    // thoát sạch trước khi sang ngày mới.
    useDecorModeStore.getState().dispatch({ type: "exit" });
    // Guard re-entrancy: chặn endDay gọi 2 lần trong cửa sổ cực ngắn (double B
    // press, hoặc farm-scene Phaser dynamic-import race với GameEngine canvas2d
    // nếu cả 2 path mount) → day +2, shipping double-pay, crops grow 2 ngày/đêm.
    // Guard áp dụng CHO CẢ collapse — trước đây carve-out !collapsed giả định
    // collapse chỉ 1 nguồn gọi, nhưng farm-scene (async import) + GameEngine
    // (sync) đều gọi endDay(true) → race window. Window 100ms đủ chặn spam B/macro
    // + dynamic-import microtask gap, không chặn endDay hợp lệ cách >100ms.
    const now = Date.now();
    if (now - lastEndDayAt < END_DAY_MIN_INTERVAL_MS) {
      return;
    }
    lastEndDayAt = now;
    const game = useGameStore.getState();
    const farm = useFarmStore.getState();
    const npc = useNpcStore.getState();
    const ui = uiState;
    const quests = useQuestStore.getState();
    const prevSeason = game.season;
    const prevTimeMinutes = game.timeMinutes;

    // Process shipping boxes: sell all shippable items at 60% rate.
    let shipGold = 0;
    let shipCount = 0;
    const shipEntries = Object.entries(farm.shippingBoxes);
    if (shipEntries.length > 0) {
      for (const [, box] of shipEntries) {
        for (const itemId of Object.keys(box.contents)) {
          const qty = box.contents[itemId];
          // Defense-in-depth (audit M-3): hydrate đã sanitize nhưng endDay là trust
          // boundary — qty string ("abc") làm `qty <= 0` false (string compare),
          // shipCount += "abc" (concat) + Math.round(NaN) → poison gold NaN.
          if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) continue;
          const price = shippingSellPrice(itemId, getItem(itemId)?.type);
          // Perk sell-price (Golden Yield / Silver Tongue) cũng áp cho shipping box,
          // giống vendor — đảm bảo 2 kênh bán không lệch nhau.
          // Round TRÊN tổng (price × mult × qty), không round từng đơn vị rồi × qty
          // — tránh mất 0.49g/đơn vị khi perk multiplier không nguyên.
          const gained = Math.round(price * sellPriceMultiplier() * qty);
          shipGold += gained;
          shipCount += qty;
          quests.trackShipped(itemId, qty, gained);
        }
      }
      // clear box contents
      farm.clearShippingBoxes();
    }

    game.sleep(collapsed);
    // sleep() thay state bằng object MỚI (set({...})) → snapshot `game` ở trên
    // giờ STALE (season cũ). Phải đọc lại state sau sleep để farm.newDay và
    // season rollover dùng season MỚI — nếu không crop không chết đúng mùa,
    // regrow/forage không chạy, toast "Mùa mới" không hiện (bug season rollover).
    const freshGame = useGameStore.getState();
    farm.newDay(freshGame.season); // crop growth + dry soil
    npc.resetDaily();
    quests.newDay();
    useAnimalStore.getState().newDay();
    useWorldStore.getState().enterZone("house", { x: 8, y: 9 });

    if (shipGold > 0) {
      freshGame.addGold(shipGold);
      ui.notify(`📦 Giao hàng: đã bán ${shipCount} món được ${shipGold}g`, "success");
      // W7d-P1: giao hàng có doanh thu → farmer rep +1 (fire-and-forget, offline bỏ qua).
      import("@/app/actions/reputation")
        .then((m) => m.bumpFarmerAction(1))
        .catch(() => {});
    }

    if (prevSeason !== freshGame.season) {
      farm.regrowResources(freshGame.season);
      // Season rollover: replace forage — không giữ item mùa cũ (audit M-5).
      farm.spawnForage(freshGame.season, true);
      ui.notify(`Mùa mới đã bắt đầu: ${freshGame.season}!`, "info");
    } else {
      if (Math.random() < 0.5) farm.spawnForage(freshGame.season);
    }
    // Day-start rooster (morning has come) + night-end crickets if it was late
    const sleptHour = Math.floor(prevTimeMinutes / 60);
    if (sleptHour >= 22 || sleptHour <= 2) {
      playSfx("crickets"); // collapsed late at night
    } else {
      playSfx("rooster"); // normal morning wake-up
    }
    // W8: ngày mới — catchLog cũ hết hiệu lực derby.
    freshGame.clearCatchLog();
    // W7a-P3: ngày mới — push cloud (throttle 1/phút) cho blood-moon day-freshness.
    syncFarmCloud();
  },

  /** Save current game state to the active slot (async, IndexedDB). */
  async saveToActiveSlot(): Promise<boolean> {
    const ui = useUiStore.getState();
    const data = collectSaveData();
    const { saveGame } = await import("@/lib/game/save");
    const ok = await saveGame(ui.activeSlot, data);
    if (ok) {
      const now = Date.now();
      ui.setLastSavedAt(now);
    }
    return ok;
  },

  /**
   * Push the player's progression (level/xp/skillPoints/perks) to the cloud.
   * Fire-and-forget, non-fatal: uses the local store version (LWW server-side).
   * Called after saves so levels persist to the API DB.
   */
  async syncProgressionCloud(): Promise<void> {
    try {
      const prog = useProgressionStore.getState();
      const { ProgressionCloudSync } = await import("@/lib/game/cloud/cloud-sync-base");
      const sync = new ProgressionCloudSync();
      await sync.push(
        {
          level: prog.level,
          xp: prog.xp,
          totalXp: prog.totalXp,
          skillPoints: prog.skillPoints,
        },
        prog.level, // client-known version — server LWW decides conflicts
      );
    } catch (err) {
      console.warn("[actions] progression cloud sync failed:", err);
    }
  },

  /** Apply a loaded SaveData payload to all stores (used by Continue/Load). */
  applySaveData(data: {
    game: Record<string, unknown>;
    player?: { x: number; y: number };
    inventory: { slots: ({ itemId: string; qty: number } | null)[]; selectedSlot: number };
    farm: Record<string, unknown>;
    npc: Record<string, unknown>;
    quests?: Record<string, unknown>;
    progression?: {
      level: number;
      xp: number;
      totalXp: number;
      skillPoints: number;
      perkAllocations?: { farming: number; combat: number; social: number };
    };
    world?: {
      zone?: string;
      wellRepaired?: boolean;
      waterCharges?: number;
      minedRocks?: Record<string, boolean>;
      defeatedSlimes?: Record<string, boolean>;
    };
    animals?: { animals?: unknown[] };
    mounts?: { owned?: string[]; active?: string | null };
  }): void {
    // Audit #13: typed Partial casts thay `as never` — keep compile-time shape check.
    // Reset raid store (defensive) — load save trong lúc raid active/lobby để lại
    // phase overlay đè farm mới (audit CR-4 minor). Raid không thể active qua UI
    // này (isGameplayBlocked gate) nhưng applySaveData cũng reachable từ test.
    useRaidStore.getState().reset();
    useGameStore.getState().hydrate(data.game as Partial<GameState>);
    // Invariant: season === SEASONS[seasonIndex]. Nếu hydrate mang seasonIndex lệch
    // (save cũ/thiếu field), derive lại từ season để next sleep không nhảy season.
    const gameS = useGameStore.getState();
    const idx = SEASONS.indexOf(gameS.season as never);
    if (idx >= 0 && gameS.seasonIndex !== idx) {
      useGameStore.getState().hydrate({ seasonIndex: idx } as Partial<GameState>);
    }
    useInventoryStore.getState().hydrate(data.inventory.slots, data.inventory.selectedSlot);
    useFarmStore.getState().hydrate(data.farm as Partial<FarmState>);
    useNpcStore.getState().hydrate(data.npc as Partial<NpcState>);
    if (data.quests)
      useQuestStore.getState().hydrate(
        data.quests as Partial<ReturnType<typeof useQuestStore.getState>>,
      );
    if (data.progression) useProgressionStore.getState().hydrate(data.progression);
    // Save world.zone là untrusted string — worldStore.hydrate tự validate zone
    // (whitelist ZoneId) nên cast shape này giữ compile-time check còn lại.
    if (data.world)
      useWorldStore.getState().hydrate(data.world as Partial<WorldState>);
    if (data.animals) useAnimalStore.getState().hydrate(data.animals as { animals: never });
    // W6: mounts luôn hydrate (migrate đã default rỗng) — store tự sanitize.
    useMountStore.getState().hydrate(
      (data.mounts ?? { owned: [], active: null }) as Partial<MountState>,
    );
    // Teleport player về saved position qua validator (clamp bounds + walkable).
    // Save coords là untrusted (OOB/solid do map changed) — trước đây gọi
    // bridge.teleportToTile trực tiếp → save {x:100} → player rơi OOB stuck.
    if (data.player) {
      const tx = data.player.x;
      const ty = data.player.y;
      let attempts = 0;
      const attempt = () => {
        if (teleportToTileSafe(tx, ty)) return;
        // Cold start (mobile, preload chậm) > 550ms budget cũ → bridge chưa
        // register → position reset spawn. Mở rộng 15 attempts (1.5s) chặn miss.
        if (++attempts < 15) setTimeout(attempt, 100);
      };
      setTimeout(attempt, 50);
    }
  },
};

export function nextSeason(current: string): string {
  const i = SEASONS.indexOf(current as never);
  return SEASONS[(i + 1) % 4];
}

export { SHOP_SEEDS, SHOP_GOODS, NPCS, vendorSellPrice, shippingSellPrice, seedBuyPrice };
