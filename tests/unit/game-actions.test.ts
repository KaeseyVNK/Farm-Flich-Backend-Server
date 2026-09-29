import { describe, it, expect, beforeEach } from "vitest";
import { useInventoryStore } from "../../src/store/inventoryStore";
import { useGameStore } from "../../src/store/gameStore";
import { useFarmStore } from "../../src/store/farmStore";
import { useNpcStore } from "../../src/store/npcStore";
import { useQuestStore } from "../../src/store/questStore";
import { useUiStore } from "../../src/store/uiStore";
import { useProgressionStore, XP_REWARDS } from "../../src/store/progressionStore";
import { gameActions, resetEndDayGuard, collectLocalSave } from "../../src/lib/game/actions";
import { T, DAYS_PER_SEASON } from "../../src/lib/game/constants";
import { setFallow } from "./helpers/fallow-tile";

// Audit: gameActions (sell/buy/plant/craft/gift/endDay) — core cross-store
// orchestration chưa có unit test trực tiếp (chỉ E2E). Viết test đầy đủ.
describe("gameActions unit (cross-store orchestration)", () => {
  beforeEach(() => {
    useInventoryStore.getState().hydrate([], 0);
    useGameStore.getState().hydrate({
      day: 1,
      season: "Spring",
      seasonIndex: 0,
      year: 1,
      timeMinutes: 6 * 60,
      gold: 500,
      energy: useGameStore.getState().maxEnergy,
      collapsed: false,
      isSleeping: false,
      totalEarned: 0,
      toolsUsed: 0,
    });
    useFarmStore.getState().hydrate({
      terrain: new Array(30 * 22).fill(T.GRASS),
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
      silo: {},
      filledOrders: [],
    } as never);
    useNpcStore.getState().hydrate({ friendship: {}, talkedToday: {}, giftedToday: {}, metNpcs: {} });
    useQuestStore.getState().reset();
    useProgressionStore.getState().reset();
    useUiStore.getState().setShowShop(false);
    useUiStore.getState().closeDialogue();
    useUiStore.getState().closeGiftPicker();
    // Guard endDay là timestamp module-level → reset giữa các test để test sau
    // (chạy trong <100ms) không bị chặn nhầm bởi endDay của test trước.
    resetEndDayGuard();
  });

  describe("sellItem", () => {
    it("bán parsnip → gold +35, inventory giảm, trackShipped", () => {
      useInventoryStore.getState().addItem("parsnip", 2);
      const gold = useGameStore.getState().gold;
      const gained = gameActions.sellItem("parsnip", 1);
      expect(gained).toBe(35);
      expect(useGameStore.getState().gold).toBe(gold + 35);
      expect(useInventoryStore.getState().countItem("parsnip")).toBe(1);
      // Quest shipped tracking
      expect(useQuestStore.getState().shippedQty("parsnip")).toBe(1);
      expect(useQuestStore.getState().shippedGold).toBe(35);
    });

    it("bán nhiều hơn có trong túi → chỉ bán số có (no overflow)", () => {
      useInventoryStore.getState().addItem("parsnip", 2);
      const gained = gameActions.sellItem("parsnip", 5);
      expect(gained).toBe(35 * 2);
      expect(useInventoryStore.getState().countItem("parsnip")).toBe(0);
    });

    it("bán nhiều hơn có → trackShipped ghi số THỰC bán (không over-credit quest)", () => {
      // C1 fix: trước đây trackShipped(itemId, qty=yêu cầu) → over-credit.
      // Inventory có 2, yêu cầu bán 5 → chỉ bán 2 → shippedQty phải = 2.
      useInventoryStore.getState().addItem("parsnip", 2);
      gameActions.sellItem("parsnip", 5);
      expect(useQuestStore.getState().shippedQty("parsnip")).toBe(2);
      expect(useQuestStore.getState().shippedGold).toBe(35 * 2);
    });

    it("bán vật phẩm không tồn tại → 0, không crash", () => {
      const gained = gameActions.sellItem("non_existent_item", 1);
      expect(gained).toBe(0);
      expect(useGameStore.getState().gold).toBe(500);
    });

    it("sell → awardXp('sell')", () => {
      useInventoryStore.getState().addItem("parsnip", 1);
      const before = useProgressionStore.getState().totalXp;
      gameActions.sellItem("parsnip", 1);
      expect(useProgressionStore.getState().totalXp).toBe(before + XP_REWARDS.sell);
    });

    it("Phase 5: sellItem trừ SILO trước, túi sau", () => {
      useFarmStore.getState().hydrate({ silo: { parsnip: 5 } } as never);
      useInventoryStore.getState().addItem("parsnip", 2);
      const gained = gameActions.sellItem("parsnip", 4);
      expect(gained).toBe(4 * 35);
      expect(useFarmStore.getState().silo.parsnip).toBe(1); // silo còn 1
      expect(useInventoryStore.getState().countItem("parsnip")).toBe(2); // túi chưa đụng
    });
  });

  describe("catchFish (W1P4)", () => {
    it("silo còn chỗ → cá vào silo + XP fish + notify", () => {
      useFarmStore.getState().hydrate({ silo: {} } as never);
      const xp = useProgressionStore.getState().totalXp;
      expect(gameActions.catchFish("sunfish")).toBe(true);
      expect(useFarmStore.getState().silo.sunfish).toBe(1);
      expect(useProgressionStore.getState().totalXp).toBe(xp + XP_REWARDS.fish);
    });

    it("silo đầy → cá vào túi (bù)", () => {
      useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
      useFarmStore.getState().hydrate({ silo: { parsnip: 20 } } as never); // cap 20 lv1
      expect(gameActions.catchFish("perch")).toBe(true);
      expect(useInventoryStore.getState().countItem("perch")).toBe(1);
      expect(useFarmStore.getState().silo.perch).toBeUndefined();
    });

    it("cá lạ → false không crash", () => {
      expect(gameActions.catchFish("not_a_fish")).toBe(false);
    });
  });

  describe("tryFillOrder (phase 5)", () => {
    it("đủ hàng trong silo → +gold, trừ silo, +XP sell 1 lần", () => {
      useFarmStore.getState().hydrate({ silo: { parsnip: 3 } } as never);
      const gold = useGameStore.getState().gold;
      const xp = useProgressionStore.getState().totalXp;
      const ok = gameActions.tryFillOrder("d1-b"); // day 1 lv1: parsnip 3, 120g
      expect(ok).toBe(true);
      expect(useGameStore.getState().gold).toBe(gold + 120);
      expect(useFarmStore.getState().silo.parsnip ?? 0).toBe(0);
      expect(useProgressionStore.getState().totalXp).toBe(xp + XP_REWARDS.sell);
    });

    it("trừ silo trước, túi bù phần thiếu", () => {
      useFarmStore.getState().hydrate({ silo: { parsnip: 1 } } as never);
      useInventoryStore.getState().addItem("parsnip", 2);
      const ok = gameActions.tryFillOrder("d1-a"); // parsnip 2
      expect(ok).toBe(true);
      expect(useFarmStore.getState().silo.parsnip ?? 0).toBe(0);
      expect(useInventoryStore.getState().countItem("parsnip")).toBe(1);
    });

    it("không đủ → false, không trừ gì, không +gold", () => {
      useFarmStore.getState().hydrate({ silo: { parsnip: 1 } } as never);
      const gold = useGameStore.getState().gold;
      expect(gameActions.tryFillOrder("d1-b")).toBe(false); // cần 3
      expect(useGameStore.getState().gold).toBe(gold);
      expect(useFarmStore.getState().silo.parsnip).toBe(1);
    });

    it("order id không thuộc ngày → false", () => {
      expect(gameActions.tryFillOrder("d9-z")).toBe(false);
    });

    it("giao xong → KHÔNG giao lại cùng đơn trong ngày (no in-day refill)", () => {
      useFarmStore.getState().hydrate({ silo: { parsnip: 10 } } as never);
      const gold = useGameStore.getState().gold;
      expect(gameActions.tryFillOrder("d1-a")).toBe(true);
      expect(gameActions.tryFillOrder("d1-a")).toBe(false); // đơn đã giao hôm nay
      expect(useGameStore.getState().gold).toBe(gold + 80); // gold chỉ 1 lần
      expect(useFarmStore.getState().silo.parsnip).toBe(8); // chỉ trừ 2 parsnip
    });

    it("đơn khác cùng ngày vẫn giao được — mỗi đơn 1 lần", () => {
      useFarmStore.getState().hydrate({ silo: { parsnip: 9 } } as never);
      expect(gameActions.tryFillOrder("d1-a")).toBe(true);
      expect(gameActions.tryFillOrder("d1-b")).toBe(true);
      expect(gameActions.tryFillOrder("d1-c")).toBe(true);
      expect(useFarmStore.getState().silo.parsnip ?? 0).toBe(0); // 2+3+4
    });

    it("hydrate filledOrders từ save → đơn đã giao hôm qua/today bị chặn", () => {
      useFarmStore
        .getState()
        .hydrate({ silo: { parsnip: 5 }, filledOrders: ["d1-a"] } as never);
      expect(gameActions.tryFillOrder("d1-a")).toBe(false);
    });
  });

  describe("buySeed", () => {
    it("mua hạt parsnip → gold giảm 20, inventory tăng 1", () => {
      const ok = gameActions.buySeed("parsnip_seed", 1);
      expect(ok).toBe(true);
      expect(useGameStore.getState().gold).toBe(480);
      expect(useInventoryStore.getState().countItem("parsnip_seed")).toBe(1);
    });

    it("lv1 mua potato_seed (Lv2) → false, gold không đổi (phase 2 catalog lock)", () => {
      useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
      const ok = gameActions.buySeed("potato_seed", 1);
      expect(ok).toBe(false);
      expect(useGameStore.getState().gold).toBe(500);
      expect(useInventoryStore.getState().countItem("potato_seed")).toBe(0);
    });

    it("đủ level mua potato_seed → true", () => {
      useProgressionStore.getState().hydrate({ level: 2, xp: 0, totalXp: 0, skillPoints: 0 });
      const ok = gameActions.buySeed("potato_seed", 1);
      expect(ok).toBe(true);
      expect(useInventoryStore.getState().countItem("potato_seed")).toBe(1);
    });

    it("không đủ vàng → false, không trừ, không thêm", () => {
      useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
      useGameStore.getState().hydrate({ gold: 10 } as never);
      const ok = gameActions.buySeed("parsnip_seed", 1); // giá 20, lv1 mở
      expect(ok).toBe(false);
      expect(useGameStore.getState().gold).toBe(10);
      expect(useInventoryStore.getState().countItem("parsnip_seed")).toBe(0);
    });

    it("seed không tồn tại → false", () => {
      expect(gameActions.buySeed("not_a_seed", 1)).toBe(false);
    });

    it("túi đầy → KHÔNG trừ vàng, trả false (pre-check chỗ trống trước khi spend)", () => {
      // Audit gold-loss fix: trước đây spendGold full cost rồi addItem → túi đầy
      // mất vàng không nhận hạt. Pre-check mô phỏng chỗ trống (như craft) chặn
      // mua khi không fit — không spend, không mất tiền.
      useInventoryStore.getState().hydrate(
        Array.from({ length: 12 }, () => ({ itemId: "stone", qty: 1 })),
        0,
      );
      const goldBefore = useGameStore.getState().gold;
      const ok = gameActions.buySeed("parsnip_seed", 1);
      expect(ok).toBe(false); // không fit → chặn, không trừ tiền
      expect(useGameStore.getState().gold).toBe(goldBefore);
    });
  });

  describe("plantSelectedOnTile", () => {
    it("trồng hạt mùa phù hợp → farm có crop, seed giảm, XP plant", () => {
      setFallow(5, 5);
      useFarmStore.getState().till(5, 5);
      useInventoryStore.getState().addItem("parsnip_seed", 3);
      // Selected slot: chọn slot chứa seed (index 0)
      useInventoryStore.getState().selectSlot(0);
      const xpBefore = useProgressionStore.getState().totalXp;
      const ok = gameActions.plantSelectedOnTile(5, 5);
      expect(ok).toBe(true);
      expect(useFarmStore.getState().crops[5 * 60 + 5]).toBeDefined();
      expect(useInventoryStore.getState().countItem("parsnip_seed")).toBe(2);
      expect(useProgressionStore.getState().totalXp).toBe(xpBefore + XP_REWARDS.plant);
    });

    it("seed trái mùa → false, không trồng", () => {
      useInventoryStore.getState().hydrate([{ itemId: "parsnip_seed", qty: 1 }], 0);
      useGameStore.getState().hydrate({ season: "Winter" } as never);
      const ok = gameActions.plantSelectedOnTile(5, 5);
      expect(ok).toBe(false);
      expect(useFarmStore.getState().crops[5 * 60 + 5]).toBeUndefined();
    });

    it("không chọn seed → false", () => {
      useInventoryStore.getState().hydrate([{ itemId: "hoe", qty: 1 }], 0);
      expect(gameActions.plantSelectedOnTile(5, 5)).toBe(false);
    });

    it("trồng lên tile chưa cuốc → false (farm.plant chặn)", () => {
      useInventoryStore.getState().hydrate([{ itemId: "parsnip_seed", qty: 1 }], 0);
      // Tile 5,5 default GRASS (chưa cuốc) — plant yêu cầu TILLED
      const ok = gameActions.plantSelectedOnTile(5, 5);
      expect(ok).toBe(false);
    });

    it("0 energy → chặn trồng, không mutate crop, không mất seed", () => {
      // Audit fix: plant pre-check năng lượng (giống tool path). Trước đây farm.plant
      // mutate crop TRƯỚC, spendEnergy sau cùng → 0 energy vẫn trồng miễn phí (exploit).
      setFallow(5, 5);
      useFarmStore.getState().till(5, 5);
      useInventoryStore.getState().hydrate([{ itemId: "parsnip_seed", qty: 1 }], 0);
      useGameStore.getState().hydrate({ energy: 0 } as never);
      const ok = gameActions.plantSelectedOnTile(5, 5);
      expect(ok).toBe(false);
      expect(useFarmStore.getState().crops[5 * 60 + 5]).toBeUndefined();
      expect(useInventoryStore.getState().countItem("parsnip_seed")).toBe(1);
    });
  });

  describe("craft", () => {
    it("đủ nguyên liệu → craft thành công, ingredient giảm, product tăng", () => {
      // fence_item recipe: 2 wood → 1 fence
      useInventoryStore.getState().addItem("wood", 2);
      const ok = gameActions.craft("r_fence");
      expect(ok).toBe(true);
      expect(useInventoryStore.getState().countItem("wood")).toBe(0);
      expect(useInventoryStore.getState().countItem("fence_item")).toBe(1);
    });

    it("thiếu nguyên liệu → false, không craft", () => {
      useInventoryStore.getState().addItem("wood", 1);
      const ok = gameActions.craft("r_fence");
      expect(ok).toBe(false);
      expect(useInventoryStore.getState().countItem("fence_item")).toBe(0);
    });

    it("recipe không tồn tại → false", () => {
      expect(gameActions.craft("not_a_recipe")).toBe(false);
    });

    it("túi đầy → KHÔNG remove ingredients, không mất nguyên liệu", () => {
      // Đổ đầy 12 slot khác nhau → không còn chỗ cho result.
      useInventoryStore.getState().hydrate(
        Array.from({ length: 12 }, (_, i) => ({
          itemId: i === 0 ? "wood" : `stone`,
          qty: 1,
        })),
        0,
      );
      // 2 wood ở slot 0 + 11 stone — đủ nguyên liệu nhưng không chỗ result.
      useInventoryStore.getState().hydrate(
        [{ itemId: "wood", qty: 2 }, ...Array.from({ length: 11 }, () => ({ itemId: "stone", qty: 1 }))],
        0,
      );
      const ok = gameActions.craft("r_fence");
      expect(ok).toBe(false); // pre-check chặn
      expect(useInventoryStore.getState().countItem("wood")).toBe(2); // KHÔNG remove
      expect(useInventoryStore.getState().countItem("fence_item")).toBe(0);
    });
  });

  describe("giveGift", () => {
    it("tặng loved item → friendship tăng, item giảm, XP socialGift", () => {
      useInventoryStore.getState().addItem("copper_ore", 1); // Alaric loves ore
      const before = useNpcStore.getState().friendship["alaric"] ?? 0;
      const xpBefore = useProgressionStore.getState().totalXp;
      const ok = gameActions.giveGift("alaric", "copper_ore");
      expect(ok).toBe(true);
      expect(useNpcStore.getState().friendship["alaric"]).toBeGreaterThan(before);
      expect(useInventoryStore.getState().countItem("copper_ore")).toBe(0);
      expect(useProgressionStore.getState().totalXp).toBe(xpBefore + XP_REWARDS.socialGift);
    });

    it("không có item → false", () => {
      expect(gameActions.giveGift("alaric", "copper_ore")).toBe(false);
    });

    it("đã tặng hôm nay → refund item, false", () => {
      useInventoryStore.getState().addItem("copper_ore", 1);
      useNpcStore.getState().hydrate({ giftedToday: { alaric: true } } as never);
      const ok = gameActions.giveGift("alaric", "copper_ore");
      expect(ok).toBe(false);
      expect(useInventoryStore.getState().countItem("copper_ore")).toBe(1); // refund
    });

    it("hated item → KHÔNG awardXp (chặn XP exploit)", () => {
      // mayor_lewis hates sap (data.ts). Tặng hated item → friendship giảm, XP
      // KHÔNG tăng. Trước đây awardXp blind → level up bằng hated-gift spam.
      useInventoryStore.getState().addItem("sap", 1);
      const xpBefore = useProgressionStore.getState().totalXp;
      const reaction = useNpcStore.getState().reactionFor("alaric", "sap");
      expect(reaction).toBe("hated");
      gameActions.giveGift("alaric", "sap");
      expect(useProgressionStore.getState().totalXp).toBe(xpBefore);
    });
  });

  describe("endDay", () => {
    it("có shipping box → gold tăng theo shipping price, box clear, day +1", () => {
      // 2 parsnip trong shipping box (vendor 35, shipping 60% = 21)
      useFarmStore.getState().hydrate({
        shippingBoxes: {
          0: { tileIndex: 0, contents: { parsnip: 2 } },
        },
      } as never);
      const gold = useGameStore.getState().gold;
      const day = useGameStore.getState().day;
      gameActions.endDay();
      expect(useGameStore.getState().gold).toBe(gold + 21 * 2);
      expect(useGameStore.getState().day).toBe(day + 1);
      // clearShippingBoxes giữ footprint box nhưng xóa contents
      const boxes = useFarmStore.getState().shippingBoxes;
      expect(boxes[0]?.contents).toEqual({});
      expect(useQuestStore.getState().shippedQty("parsnip")).toBe(2);
    });

    it("modal mở (shop) → chặn endDay", () => {
      useUiStore.getState().setShowShop(true);
      const day = useGameStore.getState().day;
      gameActions.endDay();
      expect(useGameStore.getState().day).toBe(day); // không advance
      useUiStore.getState().setShowShop(false);
    });

    it("collapse → mất 10% vàng", () => {
      useGameStore.getState().hydrate({ gold: 1000 } as never);
      gameActions.endDay(true);
      expect(useGameStore.getState().gold).toBe(900);
    });

    it("collapse (2am) trong 100ms window sau endDay(false) → bị guard chặn (anti double-advance)", () => {
      // Race: B press (sleep sớm) + farm-scene Phaser dynamic-import async race
      // với GameEngine canvas2d sync — cả 2 fire endDay(true) trong 100ms →
      // crops grow 2 ngày/đêm + shipping double-pay. Guard áp dụng CHO CẢ
      // collapse (trước đây carve-out !collapsed giả định 1 nguồn gọi — sai).
      const day = useGameStore.getState().day;
      gameActions.endDay(false); // B press → day advance 1
      expect(useGameStore.getState().day).toBe(day + 1);
      // Collapse ngay sau đó trong 100ms window → bị chặn, day KHÔNG tăng tiếp
      gameActions.endDay(true);
      expect(useGameStore.getState().day).toBe(day + 1);
    });

    it("collapse (2am) ngoài 100ms window → advance bình thường", () => {
      // Sau window, collapse hợp lệ → day advance. Chặn soft-lock.
      const day = useGameStore.getState().day;
      gameActions.endDay(false);
      resetEndDayGuard(); // simulate >100ms pass
      gameActions.endDay(true);
      expect(useGameStore.getState().day).toBe(day + 2);
    });

    it("re-entrancy: endDay 2 lần khi isSleeping → day chỉ +1 (chặn exploit)", () => {
      // sleep() set isSleeping trong 1200ms. Nếu nhấn B 2 lần (hoặc B + auto-collapse)
      // trong cửa sổ đó, endDay chạy 2 lần → day +2 + energy reset 2 lần (exploit).
      // Guard: bỏ qua lần thứ 2 khi isSleeping đang true.
      const day = useGameStore.getState().day;
      gameActions.endDay(false);
      expect(useGameStore.getState().day).toBe(day + 1);
      expect(useGameStore.getState().isSleeping).toBe(true); // sleep set isSleeping
      // Lần 2 trong cửa sổ ngủ → bị chặn, day không tăng tiếp
      gameActions.endDay(false);
      expect(useGameStore.getState().day).toBe(day + 1);
    });

    it("season rollover → crop non-mature sai mùa bị xóa, trả ô đất TILLED", () => {
      // Audit fix: sleep() thay state bằng object MỚI → snapshot `game` local stale.
      // Nếu farm.newDay dùng game.season cũ thì parsnip (Spring) không chết khi sang
      // Summer → crop mọc mãi qua mùa (bug). Giờ phải đọc lại state sau sleep.
      // Fix dead-crop: crop non-mature sai mùa → XÓA + trả ô TILLED (không khóa ô).
      useFarmStore.getState().hydrate({
        terrain: new Array(30 * 22).fill(T.GRASS),
        crops: { [5 * 60 + 5]: { cropId: "parsnip", stage: 1, daysGrown: 1, watered: true, dead: false } },
        objects: {},
        forage: {},
        shippingBoxes: {},
      } as never);
      // Till trước để sau rollover kiểm tra đất trả về TILLED
      setFallow(5, 5);
      useFarmStore.getState().till(5, 5);
      useFarmStore.getState().water(5, 5);
      useFarmStore.getState().hydrate({
        crops: { [5 * 60 + 5]: { cropId: "parsnip", stage: 1, daysGrown: 1, watered: true, dead: false } },
      } as never);
      // Ngày cuối Spring (28) → sleep rollover sang Summer
      useGameStore.getState().hydrate({ day: DAYS_PER_SEASON, season: "Spring", seasonIndex: 0 } as never);
      gameActions.endDay(false);
      expect(useGameStore.getState().season).toBe("Summer");
      expect(useGameStore.getState().day).toBe(1);
      // Crop non-mature sai mùa bị xóa hẳn, ô đất trả về TILLED (không khóa ô)
      expect(useFarmStore.getState().crops[5 * 60 + 5]).toBeUndefined();
      expect(useFarmStore.getState().terrain[5 * 60 + 5]).toBe(T.TILLED);
    });

    it("season rollover → crop mature sai mùa giữ nguyên để thu hoạch", () => {
      // Crop đã trưởng thành (stage cuối) khi hết mùa → KHÔNG chết, giữ để harvest
      // (trước đây set dead → mature crop bị khóa, mất công trồng).
      useFarmStore.getState().hydrate({
        crops: { [5 * 60 + 5]: { cropId: "parsnip", stage: 4, daysGrown: 4, watered: false, dead: false } },
      } as never);
      useGameStore.getState().hydrate({ day: DAYS_PER_SEASON, season: "Spring", seasonIndex: 0 } as never);
      gameActions.endDay(false);
      const crop = useFarmStore.getState().crops[5 * 60 + 5];
      expect(crop).toBeDefined();
      expect(crop?.dead).toBe(false);
      expect(crop?.stage).toBe(4); // vẫn sẵn sàng harvest
    });
  });
});

// collectLocalSave: wire cloud-save false-promise fix. Map stores → LocalSave subset
// (sync.ts contract cho migrate 1 chiều). Verify inventory slot → itemId aggregation
// + gold/game/player/farm passthrough + bỏ progression/npc/story.
describe("collectLocalSave (migrate cloud-save mapping)", () => {
  beforeEach(() => {
    useInventoryStore.getState().hydrate(
      [
        { itemId: "parsnip", qty: 3 },
        { itemId: "parsnip", qty: 2 }, // dup itemId → aggregate thành 5
        { itemId: "hoe", qty: 1 },
        null,
      ],
      0,
    );
    useGameStore.getState().hydrate({
      day: 17,
      season: "Summer",
      seasonIndex: 1,
      year: 2,
      timeMinutes: 720,
      gold: 1234,
      energy: 150,
    } as never);
    useFarmStore.getState().hydrate({
      terrain: new Array(30 * 22).fill(T.GRASS),
      crops: { [5 * 60 + 5]: { cropId: "parsnip" } },
      objects: { [10]: { type: "fence" } },
      forage: { [20]: "berry" },
      shippingBoxes: { [30]: { itemId: "parsnip", qty: 2 } },
    } as never);
  });

  it("maps gold/game/player + farm fields sang LocalSave", () => {
    const local = collectLocalSave();
    expect(local.gold).toBe(1234);
    expect(local.game).toMatchObject({ day: 17, season: "Summer", year: 2, timeMinutes: 720, energy: 150 });
    expect(local.player).toBeDefined();
    expect(local.farm?.terrain).toHaveLength(60 * 60);
    expect(local.farm?.crops).toBeDefined();
    expect(local.farm?.objects).toBeDefined();
    expect(local.farm?.forage).toBeDefined();
    expect(local.farm?.shippingBoxes).toBeDefined();
  });

  it("aggregates inventory slots theo itemId (dup → cộng dồn), skip null slot", () => {
    const local = collectLocalSave();
    const parsnip = local.inventory?.find((i) => i.itemId === "parsnip");
    const hoe = local.inventory?.find((i) => i.itemId === "hoe");
    expect(parsnip?.qty).toBe(5); // 3 + 2
    expect(hoe?.qty).toBe(1);
    expect(local.inventory).toHaveLength(2); // chỉ 2 unique itemId
  });

  it("KHÔNG mang progression/npc/story (migrate chỉ cloud-farm state)", () => {
    const local = collectLocalSave();
    expect(local).not.toHaveProperty("progression");
    expect(local).not.toHaveProperty("npc");
    expect(local).not.toHaveProperty("story");
  });
});
