// Shared tile-interaction logic (hoe till, water, plant, harvest, chop, mine,
// scythe, place object, NPC talk, shipping-box deposit). Used by BOTH the legacy
// Canvas2D engine (GameEngine) and the Phaser engine (FarmScene) so gameplay
// stays consistent across render backends. ADR-013 rollback / Phaser default.
//
// The engine supplies its own "facing tile" + player tile + NPC query via the
// `InteractContext` provider — the module is pure store logic, no rendering.

import { T, MAP_COLS, DAY_END_HOUR } from "@/lib/game/constants";
import { useInventoryStore } from "@/store/inventoryStore";
import { useFarmStore } from "@/store/farmStore";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { getItem, CROPS } from "@/lib/game/data";
import { gameActions } from "@/lib/game/actions";
import { playSfx } from "@/lib/game/sfx";
import { energyCostWithPerks } from "@/lib/game/progression/perk-effects";
import { shippingSellPrice } from "@/lib/game/economy";
import { buffForDish } from "@/lib/game/cooking/recipe-catalog";
import { applyBuff, BUFF_TUNE } from "@/lib/game/buff";
import { ANIMAL_FEED, useAnimalStore } from "@/store/animalStore";
import { tryAutoClaim } from "@/lib/game/npc-quests";
import { useWorldStore } from "@/store/worldStore";
import { plotUnlockLevel } from "@/lib/game/farm-catalog";
import { useProgressionStore } from "@/store/progressionStore";
import { useTutorialStore } from "@/store/tutorialStore";
import { findWarp, getZone, isBedTile, isPondTile, isWellTile } from "@/lib/game/zones";
import { canAdd } from "@/lib/game/silo";

export interface InteractContext {
  /** Tile the player is facing (already facing-adjusted by the engine). */
  facingTile: { x: number; y: number };
  /** Player's current tile (for NPC proximity radius). */
  playerTile: { x: number; y: number };
  /** Nearby NPCs with their tile coords. */
  npcs: { id: string; tx: number; ty: number }[];
  /** Visual feedback hook (engine-specific: flash effect). */
  flash: (color: string) => void;
}

/** Kind hành động farm — FarmScene map sang tool anim play-once (task 5). */
export type InteractOutcome = {
  kind: "till" | "water" | "chop" | "mine" | "harvest" | "forage" | "npc" | "none";
};

/** Cross-engine result of an interact attempt. */
export interface InteractResult extends InteractOutcome {
  /** True if any action was performed (used to gate cooldown). */
  didSomething: boolean;
  /** True if an NPC dialogue opened (engine may want to pause). */
  openedDialogue?: boolean;
}

function notify(msg: string, type: "info" | "success" | "warn" | "error") {
  useUiStore.getState().notify(msg, type);
}

/**
 * Execute the interact action on the facing tile. Mirrors the legacy Canvas2D
 * behavior exactly (tool priority: placeable → shipping deposit → seed → food →
 * equipped tool → hand/harvest/forage). Consumes energy + records tool use via
 * store methods. Returns whether anything happened (cooldown gate).
 */
export function tryInteract(ctx: InteractContext): InteractResult {
  const { x, y } = ctx.facingTile;
  const world = useWorldStore.getState();
  const layout = getZone(world.zone);
  if (x < 0 || y < 0 || x >= layout.cols || y >= layout.rows) return { didSomething: false, kind: "none" };
  // Kind hành động farm đã thực hiện (success path) — "none" khi không có.
  // Return-value addition only: KHÔNG đổi behavior của bất kỳ nhánh nào.
  let kind: InteractOutcome["kind"] = "none";

  const inv = useInventoryStore.getState();
  const farm = useFarmStore.getState();
  const game = useGameStore.getState();
  const ui = useUiStore.getState();
  const slot = inv.getSelectedSlot();
  const slotDef = slot ? getItem(slot.itemId) : null;

  const warp =
    findWarp(layout, x, y) ?? findWarp(layout, ctx.playerTile.x, ctx.playerTile.y);
  if (warp) {
    world.enterZone(warp.to, warp.spawn);
    notify(`→ ${warp.label}`, "info");
    playSfx("place");
    return { didSomething: true, kind: "none" };
  }

  if (isBedTile(layout, x, y) || isBedTile(layout, ctx.playerTile.x, ctx.playerTile.y)) {
    gameActions.endDay(false);
    return { didSomething: true, kind: "none" };
  }

  // W2P4: bếp nhà (kitchenpot 12,4) → mở modal nấu ăn.
  if (layout.id === "house" && (x === 12 && y === 4)) {
    ui.setShowCooking(true);
    playSfx("click");
    return { didSomething: true, kind: "none" };
  }

  if (
    isWellTile(layout, x, y) ||
    isPondTile(layout, x, y) ||
    isWellTile(layout, ctx.playerTile.x, ctx.playerTile.y) ||
    isPondTile(layout, ctx.playerTile.x, ctx.playerTile.y)
  ) {
    const atWell = isWellTile(layout, x, y) || isWellTile(layout, ctx.playerTile.x, ctx.playerTile.y);
    if (atWell && !world.wellRepaired) {
      notify("Giếng cạn. Alaric cần quặng để sửa bơm.", "warn");
      playSfx("error");
      return { didSomething: true, kind: "none" };
    }
    world.refillCan();
    notify("Đã đổ đầy bình tưới.", "success");
    playSfx("water");
    return { didSomething: true, kind: "none" };
  }

  const animals = useAnimalStore.getState();
  const animal =
    animals.animalAt(x, y) ?? animals.animalAt(ctx.playerTile.x, ctx.playerTile.y);
  if (animal && world.zone === "farm") {
    if (animal.hasProduct) {
      // Phase 5: sản phẩm chăn nuôi vào silo (không phải túi). Gate TRƯỚC
      // animals.collect — collect đã xóa hasProduct, gọi sau đó khi kho đầy
      // = mất sản phẩm vĩnh viễn.
      if (!canAdd(farm.silo, 1, useProgressionStore.getState().level)) {
        notify("Kho đầy — nâng cấp hoặc bán bớt", "warn");
        playSfx("error");
        return { didSomething: true, kind: "none" };
      }
      const product = animals.collect(animal.id);
      if (product) {
        farm.addToSilo(product, 1);
        notify(`Thu hoạch ${getItem(product)?.name ?? product} vào kho`, "success");
        tryAutoClaim("q_collect_egg");
        ctx.flash("#e7b94e");
        playSfx("harvest");
      }
      return { didSomething: true, kind: "none" };
    }
    const feedId = slot && ANIMAL_FEED.has(slot.itemId) ? slot.itemId : null;
    if (feedId) {
      if (animals.feed(animal.id)) {
        inv.removeItem(feedId, 1);
        notify("Đã cho ăn. Sáng mai sẽ có sản phẩm.", "success");
        playSfx("place");
      } else {
        notify("Con này đã được cho ăn hôm nay.", "info");
      }
      return { didSomething: true, kind: "none" };
    }
    notify("Cho ăn lúa mì hoặc củ cải. Sáng mai lấy trứng/sữa.", "info");
    return { didSomething: true, kind: "none" };
  }

  if (world.zone === "cave") {
    const slime = layout.slimes.find(
      (s) => world.isSlimeAlive(s.id) && ((s.x === x && s.y === y) || (s.x === ctx.playerTile.x && s.y === ctx.playerTile.y)),
    );
    if (slime) {
      if (!canAffordEnergy(energyCostWithPerks(4))) return { didSomething: true, kind: "none" };
      world.defeatSlime(slime.id);
      spendEnergy(energyCostWithPerks(4));
      notify("Slime tan thành bùn.", "success");
      ctx.flash("#7cc36b");
      playSfx("mine");
      return { didSomething: true, kind: "none" };
    }
    if (slotDef?.toolKind === "pickaxe") {
      if (!canAffordEnergy(energyCostWithPerks(4))) return { didSomething: true, kind: "none" };
      if (world.mineRock(x, y)) {
        spendEnergy(energyCostWithPerks(4));
        addLoot("stone", 1, "Đã đập đá! +đá");
        addLoot("copper_ore", 1, "Tìm thấy quặng đồng!");
        ctx.flash("#9a9a9a");
        playSfx("mine");
        kind = "mine"; // cùng tool pickaxe như farm breakRock → tool anim chạy trong cave
      } else {
        notify("Không có đá quặng ở đây", "warn");
        playSfx("error");
      }
      return { didSomething: true, kind };
    }
  }

  // NPC interaction (generous radius: within 1 tile, preferring facing tile).
  const npc = ctx.npcs
    .slice()
    .sort((a, b) => {
      const aFacing = a.tx === x && a.ty === y ? 0 : 1;
      const bFacing = b.tx === x && b.ty === y ? 0 : 1;
      if (aFacing !== bFacing) return aFacing - bFacing;
      const da = Math.hypot(a.tx - ctx.playerTile.x, a.ty - ctx.playerTile.y);
      const db = Math.hypot(b.tx - ctx.playerTile.x, b.ty - ctx.playerTile.y);
      return da - db;
    })[0];
  if (npc) {
    ui.openDialogue(npc.id);
    return { didSomething: true, openedDialogue: true, kind: "npc" };
  }

  // W2P4: ăn món được Ở MỌI ZONE (trước đây gate zone farm chặn trước — nấu
  // ở bếp nhà xong không ăn được ngay). Nhánh đứng TRÊN zone-gate bên dưới.
  // Review-fix Critical: KHÔNG ăn khi đang mặt hướng THÙNG GIAO HÀNG trên farm —
  // deposit (bên dưới, farm-only) phải thắng, nếu không mất khả năng ship món ăn.
  const facingShippingBox =
    world.zone === "farm" && farm.objects[y * MAP_COLS + x]?.type === "shipping_box";
  if (slotDef && slotDef.type === "food" && slotDef.energy && !facingShippingBox) {
    game.addEnergy(slotDef.energy);
    inv.removeItem(slotDef.id, 1);
    // W2P4: món nấu có buff → kích hoạt khi ăn (speed theo phút, xp tới cuối ngày).
    const dishBuff = buffForDish(slotDef.id);
    if (dishBuff) {
      const dur =
        dishBuff === "speed"
          ? BUFF_TUNE.speedMinutes
          : Math.max(1, DAY_END_HOUR * 60 - game.timeMinutes);
      game.setBuffs(applyBuff(game.buffs, dishBuff, game.day, game.timeMinutes, dur));
      notify(
        dishBuff === "speed"
          ? `⚡ Tăng tốc ${BUFF_TUNE.speedMinutes} phút in-game`
          : "★ XP ×1.2 tới hết ngày",
        "success",
      );
    }
    notify(`Đã ăn ${slotDef.name} · +${slotDef.energy} thể lực`, "success");
    ctx.flash("#7cc36b");
    playSfx("eat");
    useTutorialStore.getState().tickEat();
    return { didSomething: true, kind: "none" };
  }

  if (world.zone !== "farm") return { didSomething: false, kind: "none" };

  // If holding a placeable object (fence/sprinkler/shipping_box)
  if (
    slotDef &&
    (slotDef.id === "fence_item" || slotDef.id === "sprinkler" || slotDef.id === "shipping_box")
  ) {
    const t = farm.getTile(x, y);
    if (t === T.FALLOW || t === T.TILLED || t === T.TILLED_WET) {
      const objType =
        slotDef.id === "fence_item"
          ? "fence"
          : slotDef.id === "sprinkler"
            ? "sprinkler"
            : "shipping_box";
      if (farm.placeObject(x, y, objType)) {
        inv.removeItem(slotDef.id, 1);
        ctx.flash(objType === "shipping_box" ? "#e7b94e" : "#5aa9d9");
        notify(`Đã đặt ${slotDef.name}`, "success");
        playSfx("place");
      }
    } else {
      notify("Không đặt được ở đây", "warn");
      playSfx("error");
    }
    return { didSomething: true, kind: "none" };
  }

  // If holding a crop/forage/food AND facing a shipping box -> deposit into the box
  const facingObj = farm.objects[y * MAP_COLS + x];
  if (
    slot &&
    slotDef &&
    (slotDef.type === "crop" || slotDef.type === "forage" || slotDef.type === "food") &&
    facingObj?.type === "shipping_box"
  ) {
    const tileIndex = y * MAP_COLS + x;
    const def = getItem(slot.itemId);
    // shippingSellPrice = vendor price × ECONOMY.shippingRate (single source of
    // truth). Trước đây inline `def.sellPrice * 0.6` — drift risk nếu rate đổi
    // trong economy.json, và bỏ qua category lookup (vendorSellPrice search all).
    const price = def ? shippingSellPrice(slot.itemId, def.type) : 0;
    farm.addToShippingBox(tileIndex, slot.itemId, 1);
    inv.removeItem(slot.itemId, 1);
    ctx.flash("#e7b94e");
    notify(`📦 Đã bỏ ${slotDef.name} vào thùng giao hàng (~${price}g qua đêm)`, "info");
    return { didSomething: true, kind: "none" };
  }

  // If holding a seed -> plant
  if (slotDef && slotDef.type === "seed") {
    if (gameActions.plantSelectedOnTile(x, y)) {
      ctx.flash("#4e7d3a");
      playSfx("plant");
    } else {
      playSfx("error");
    }
    return { didSomething: true, kind: "none" };
  }

  // Tool = tool của SLOT ĐANG CHỌN (slotDef.toolKind), hoặc "hand" khi slot rỗng.
  // KHÔNG dùng `_equippedTool` ở đây: `_equippedTool` lưu ITEM ID (vd
  // "watering_can") trong khi switch so theo toolKind (vd "water") — map nhầm
  // đưa đến default (harvest). Hơn nữa, khi chọn ô trống game phải xử hand
  // (harvest/nhặt), không phải công cụ gần nhất. Q-cycle trong GameLayout đã
  // chọn SLOT có tool → slotDef.toolKind đúng, không cần fallback.
  const tool = slotDef?.type === "tool" ? slotDef.toolKind : "hand";

  switch (tool) {
    case "hoe": {
      // Perk farm-2 (Sturdy Tools): cost năng lượng qua energyCostWithPerks —
      // trước đây tool path dùng raw 2/4/4/1, chỉ plant mới có perk giảm (inconsistent).
      if (!canAffordEnergy(energyCostWithPerks(2))) break;
      if (farm.till(x, y)) {
        spendEnergy(energyCostWithPerks(2));
        ctx.flash("#8a5a2f");
        playSfx("till");
        kind = "till";
      } else {
        // Phase 2: phân biệt ô ruộng khóa level vs ô không phải ruộng.
        const need = plotUnlockLevel(x, y);
        const level = useProgressionStore.getState().level;
        if (need != null && level < need) notify(`Ruộng này mở ở cấp ${need}`, "warn");
        else notify("Trồng trên ô ruộng", "warn");
        playSfx("error");
      }
      break;
    }
    case "water": {
      if (!canAffordEnergy(energyCostWithPerks(2))) break;
      if (useWorldStore.getState().waterCharges <= 0) {
        notify("Bình cạn — lấy nước ở ao hoặc giếng (sau khi sửa).", "warn");
        playSfx("error");
        break;
      }
      if (farm.water(x, y)) {
        useWorldStore.getState().spendWaterCharge();
        spendEnergy(energyCostWithPerks(2));
        ctx.flash("#5aa9d9");
        playSfx("water");
        kind = "water";
      } else {
        notify("Không có gì để tưới ở đây", "warn");
        playSfx("error");
      }
      break;
    }
    case "axe": {
      if (!canAffordEnergy(energyCostWithPerks(4))) break;
      if (farm.chopTree(x, y)) {
        spendEnergy(energyCostWithPerks(4));
        addLoot("wood", 2 + Math.floor(Math.random() * 3), "Đã chặt cây! +gỗ");
        if (Math.random() < 0.5) addLoot("sap", 1, "");
        ctx.flash("#7a5230");
        playSfx("chop");
        kind = "chop";
      } else {
        notify("Không có cây để chặt", "warn");
        playSfx("error");
      }
      break;
    }
    case "pickaxe": {
      if (!canAffordEnergy(energyCostWithPerks(4))) break;
      if (farm.breakRock(x, y)) {
        spendEnergy(energyCostWithPerks(4));
        addLoot("stone", 1 + Math.floor(Math.random() * 2), "Đã đập đá! +đá");
        ctx.flash("#9a9a9a");
        playSfx("mine");
        kind = "mine";
      } else {
        notify("Không có đá để đập", "warn");
        playSfx("error");
      }
      break;
    }
    case "scythe": {
      if (!canAffordEnergy(energyCostWithPerks(1))) break;
      if (farm.cutGrass(x, y)) {
        spendEnergy(energyCostWithPerks(1));
        if (Math.random() < 0.6) addLoot("fiber", 1, "Đã cắt cỏ! +sợi");
        ctx.flash("#7cc36b");
        playSfx("cut");
      } else {
        // try harvest with scythe too
        const h = farm.harvest(x, y);
        if (h) {
          collectHarvest(h);
          ctx.flash("#e7b94e");
          playSfx("harvest");
          kind = "harvest";
        } else if (matureCropAt(x, y)) {
          notify("Kho đầy — nâng cấp hoặc bán bớt", "warn");
          playSfx("error");
        } else {
          notify("Không có gì để cắt ở đây", "warn");
          playSfx("error");
        }
      }
      break;
    }
    case "hand":
    default: {
      // harvest crop
      const h = farm.harvest(x, y);
      if (h) {
        collectHarvest(h);
        ctx.flash("#e7b94e");
        playSfx("harvest");
        kind = "harvest";
      } else if (matureCropAt(x, y)) {
        // Phase 5: harvest bị gate kho đầy chặn (crop còn nguyên trên ô).
        notify("Kho đầy — nâng cấp hoặc bán bớt", "warn");
        playSfx("error");
      } else {
        // pickup forage
        const f = farm.pickupForage(x, y);
        if (f) {
          kind = "forage";
          // pickupForage đã delete khỏi farmStore → addItem drop im lặng khi túi
          // đầy = mất forage vĩnh viễn. Warn leftover thay vì success giả.
          const left = inv.addItem(f, 1);
          if (left === 0) notify(`Nhặt được ${getItem(f)?.name}`, "success");
          else notify(`Túi đầy — không nhặt được ${getItem(f)?.name}!`, "warn");
          ctx.flash("#e7b94e");
          playSfx("harvest");
        } else {
          notify("Không có gì ở đây", "info");
        }
      }
      break;
    }
  }
  return { didSomething: true, kind };
}

/** Thêm loot + notify khi túi đầy (drop im lặng = data loss). Trước đây axe/
 *  pickaxe/scythe addItem bỏ qua leftover → túi đầy mất wood/stone/fiber/sap
 *  im lặng. Gộp chung để mọi resource loot có 1 source warn. */
function addLoot(itemId: string, qty: number, successMsg: string): number {
  const inv = useInventoryStore.getState();
  const left = inv.addItem(itemId, qty);
  if (left > 0) notify(`Túi đầy — mất ${left} ${getItem(itemId)?.name ?? itemId}!`, "warn");
  else notify(successMsg, "success");
  return left;
}

/** Phase 5: crop trưởng thành còn trên ô sau khi harvest trả null → chắc chắn
 * bị gate kho đầy chặn (farmStore.harvest chỉ trả null với mature crop khi
 * kho đầy). Dùng để báo "Kho đầy" thay vì "Không có gì" gây hiểu nhầm. */
function matureCropAt(x: number, y: number) {
  const c = useFarmStore.getState().crops[y * MAP_COLS + x];
  if (!c || c.dead) return null;
  const def = CROPS[c.cropId];
  return def && c.stage >= def.stages - 1 ? c : null;
}

/** Phase 5: crop đã vào silo ngay trong farmStore.harvest (gate kho đầy tại
 * đó). Đây chỉ thêm seed drop vào túi — hạt giống là item, không thuộc kho
 * nông sản. Seed leftover khi túi đầy vẫn được warn (không drop im lặng). */
function collectHarvest(h: { cropId: string; qty: number; seedDrops: number }) {
  const inv = useInventoryStore.getState();
  const name = CROPS[h.cropId]?.name ?? h.cropId;
  const seedLeft = h.seedDrops > 0 ? inv.addItem(`${h.cropId}_seed`, h.seedDrops) : 0;
  if (seedLeft === 0) {
    notify(`Đã thu hoạch ${name} vào kho!${h.seedDrops ? " +hạt" : ""}`, "success");
  } else {
    notify(`Túi đầy — mất ${seedLeft} hạt ${name}!`, "warn");
  }
}

/**
 * Pre-check tool energy BEFORE mutating the tile. Trước đây gọi spendEnergyOrWarn
 * SAU farm.till/water/chopTree → ở 0 energy vẫn till/water/cut được tile (exploit:
 * hành động thành công miễn phí, hoặc axe/pickaxe tiêu resource không có loot).
 * Tách: canAffordEnergy (gate trước) + spendEnergy (khấu trừ sau khi thành công).
 */
export function canAffordEnergy(amount: number): boolean {
  const game = useGameStore.getState();
  const ui = useUiStore.getState();
  if (game.energy < amount) {
    if (game.energy <= 0) {
      ui.notify("Bạn đã kiệt sức! Ăn đồ hoặc ngủ để hồi phục.", "warn");
    } else {
      ui.notify("Quá kiệt sức! Ăn đồ hoặc ngủ.", "warn");
    }
    return false;
  }
  return true;
}

export function spendEnergy(amount: number): boolean {
  const game = useGameStore.getState();
  if (!game.spendEnergy(amount)) return false;
  game.recordToolUse();
  return true;
}

