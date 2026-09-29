import { create } from "zustand";
import {
  MAP_COLS,
  MAP_ROWS,
  T,
  type Season,
} from "@/lib/game/constants";
import { CROPS } from "@/lib/game/data";
import { awardXp, useProgressionStore } from "@/store/progressionStore";
import { isPlotUnlocked, plotUnlockLevel } from "@/lib/game/farm-catalog";
import { doubleHarvestChance, seedSaverChance } from "@/lib/game/progression/perk-effects";
import { buildFarmTerrain } from "@/lib/game/zones/farm";
import { canAdd } from "@/lib/game/silo";
import { FRY, fryGrowDays } from "@/lib/game/fish-catalog";
import { decorById } from "@/lib/game/decor/decor-catalog";
import {
  canPlaceDecor,
  sanitizePlacedDecor,
  type PlacedDecor,
} from "@/lib/game/decor/decor-placement";
import { getZone } from "@/lib/game/zones";
import { isFarmScenerySolid } from "@/lib/game/farm-scenery-layout";
import { isZoneScenerySolid } from "@/lib/game/scenery";
import { useTutorialStore } from "@/store/tutorialStore";

export interface CropState {
  cropId: string;
  stage: number; // 0..stages-1, last stage = harvestable
  daysGrown: number;
  watered: boolean;
  dead: boolean;
}

export interface PlacedObject {
  type: "fence" | "sprinkler" | "shipping_box";
}

export interface ShippingBox {
  tileIndex: number;
  contents: Record<string, number>; // itemId -> qty
}

/** W1P5: cá bột đang nuôi trong ao farm. */
export interface PondFishState {
  fishId: string; // cá TRƯỞNG THÀNH sẽ thu (vd "sunfish")
  daysGrown: number;
}

export interface FarmState {
  terrain: number[]; // length MAP_COLS*MAP_ROWS
  crops: Record<number, CropState>; // keyed by tile index
  objects: Record<number, PlacedObject>;
  // For forage spawned on map
  forage: Record<number, string>; // tileIndex -> itemId
  // Shipping boxes keyed by tile index
  shippingBoxes: Record<number, ShippingBox>;
  // Phase 5: kho nông sản riêng (crop/egg/milk) — cap theo level (silo.ts)
  silo: Record<string, number>;
  // Order id đã giao hôm nay (`d${day}-x`) — mỗi đơn 1 lần/ngày, clear ở newDay.
  filledOrders: string[];
  // W1P5: cá bột nuôi trong ao — cap POND_FISH_CAP.
  pondFish: PondFishState[];
  // W3P2: decor đã đặt (farm + house chung mảng, phân qua zone) + kho decor.
  placedDecor: PlacedDecor[];
  decorOwned: Record<string, number>;
  version: number; // bump to force re-render in Phaser
}

export interface FarmActions {
  getTile: (x: number, y: number) => number;
  setTile: (x: number, y: number, t: number) => void;
  isSolid: (x: number, y: number) => boolean;
  till: (x: number, y: number) => boolean;
  water: (x: number, y: number) => boolean;
  plant: (x: number, y: number, cropId: string) => boolean;
  harvest: (x: number, y: number) => { cropId: string; qty: number; seedDrops: number } | null;
  chopTree: (x: number, y: number) => boolean;
  breakRock: (x: number, y: number) => boolean;
  cutGrass: (x: number, y: number) => boolean;
  placeObject: (x: number, y: number, type: PlacedObject["type"]) => boolean;
  pickupForage: (x: number, y: number) => string | null;
  spawnForage: (season: Season, replace?: boolean) => void;
  newDay: (season: Season) => void; // advance crop growth, dry soil
  regrowResources: (season: Season) => void;
  getShippingBox: (tileIndex: number) => ShippingBox | null;
  addToShippingBox: (tileIndex: number, itemId: string, qty: number) => number; // returns leftover
  clearShippingBoxes: () => void;
  /** Phase 5: cất vào kho — false khi vượt cap (không mutate). */
  addToSilo: (itemId: string, qty: number) => boolean;
  /** Phase 5: rút khỏi kho — trả số thực đã rút (cap theo số có). */
  removeFromSilo: (itemId: string, qty: number) => number;
  /** Ghi đơn đã giao hôm nay (dedupe) — gate "mỗi đơn 1 lần/ngày". */
  markOrderFilled: (orderId: string) => void;
  /** W1P5: thả cá bột vào ao — false khi vượt cap hoặc fry lạ. */
  stockFry: (itemId: string) => boolean;
  /** W1P5: thu TOÀN BỘ cá trưởng thành — trả [{fishId, qty}], cá non ở lại. */
  harvestPond: () => { fishId: string; qty: number }[];
  /** W3P2: đặt decor từ kho (validate placement) — false khi thiếu/không hợp lệ. playerAt chặn đè chân người chơi. */
  placeDecor: (defId: string, tx: number, ty: number, rot?: 0 | 90 | 180 | 270, playerAt?: { x: number; y: number }) => boolean;
  /** W3P2: nhặt decor trả về kho — false khi uid lạ. */
  removeDecor: (uid: string) => boolean;
  /** W3P5: mua decor → tăng sở hữu (chưa đặt, không bump version). */
  ownDecor: (defId: string) => void;
  /** W3P4: xoay decor đã đặt (validate footprint mới bỏ chính nó) — false khi không xoay được. */
  rotateDecor: (uid: string, playerAt?: { x: number; y: number }) => boolean;
  hydrate: (data: Partial<FarmState>) => void;
  reset: () => void;
  bump: () => void;
}

function idx(x: number, y: number): number {
  return y * MAP_COLS + x;
}

/** W3P2: uid decor — counter module (mỗi session đủ duy nhất trong 1 save). */
let decorUidSeq = 0;

/** W1P5: cap cá trong ao nuôi. */
export const POND_FISH_CAP = 6;

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS;
}

function generateMap(): number[] {
  return buildFarmTerrain();
}

const INITIAL_TERRAIN = generateMap();

function spawnForageForSeason(season: Season): Record<number, string> {
  const forage: Record<number, string> = {};
  const pool =
    season === "Spring"
      ? ["dandelion", "leek"]
      : season === "Summer"
        ? ["mushroom", "dandelion"]
        : season === "Fall"
          ? ["mushroom", "leek"]
          : ["dandelion"];
  const count = 5;
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < 200) {
    attempts++;
    const x = Math.floor(Math.random() * MAP_COLS);
    const y = Math.floor(Math.random() * MAP_ROWS);
    const i = idx(x, y);
    const t = INITIAL_TERRAIN[i];
    if ((t === T.GRASS || t === T.GRASS_FLOWER) && !forage[i]) {
      forage[i] = pool[Math.floor(Math.random() * pool.length)];
      placed++;
    }
  }
  return forage;
}

export const useFarmStore = create<FarmState & FarmActions>((set, get) => ({
  terrain: INITIAL_TERRAIN,
  crops: {},
  objects: {},
  forage: spawnForageForSeason("Spring"),
  shippingBoxes: {},
  silo: {},
  filledOrders: [],
  pondFish: [],
  placedDecor: [],
  decorOwned: {},
  version: 0,

  getTile: (x, y) => (inBounds(x, y) ? get().terrain[idx(x, y)] : T.WATER),
  setTile: (x, y, t) => {
    if (!inBounds(x, y)) return;
    const terrain = [...get().terrain];
    terrain[idx(x, y)] = t;
    set({ terrain, version: get().version + 1 });
  },

  isSolid: (x, y) => {
    if (!inBounds(x, y)) return true;
    const i = idx(x, y);
    const t = get().terrain[i];
    const solidTerrain =
      t === T.WATER || t === T.TREE || t === T.ROCK || t === T.FENCE || t === T.FLOWER_BUSH;
    if (solidTerrain) return true;
    // Chỉ fence block movement. Trước đây `if (get().objects[i]) return true`
    // chặn MỌI object (cả sprinkler + shipping_box) → player kẹt không đi qua
    // ô sprinkler giữa ruộng; shipping_box cũng chặn dù Stardew không. Sprinkler
    // ở giữa ruộng (đặt để tưới 8 ô xung quanh) phải đi xuyên được.
    if (get().objects[i]?.type === "fence") return true;
    return false;
  },

  till: (x, y) => {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    const terrain = [...get().terrain];
    if (terrain[i] !== T.FALLOW) return false;
    // Phase 2: ô trong lưới FARM_PLOTS khóa theo level — notify do interact.ts
    // phân biệt (store không import uiStore).
    if (plotUnlockLevel(x, y) != null && !isPlotUnlocked(x, y, useProgressionStore.getState().level))
      return false;
    terrain[i] = T.TILLED;
    set({ terrain, version: get().version + 1 });
    awardXp("till");
    useTutorialStore.getState().tickTill();
    return true;
  },

  water: (x, y) => {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    const terrain = [...get().terrain];
    if (terrain[i] !== T.TILLED && terrain[i] !== T.TILLED_WET) return false;
    terrain[i] = T.TILLED_WET;
    const crops = { ...get().crops };
    if (crops[i] && !crops[i].dead) crops[i] = { ...crops[i], watered: true };
    set({ terrain, crops, version: get().version + 1 });
    awardXp("water");
    useTutorialStore.getState().tickWater();
    return true;
  },

  plant: (x, y, cropId) => {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    const t = get().terrain[i];
    if (t !== T.TILLED && t !== T.TILLED_WET) return false;
    if (get().crops[i]) return false;
    const def = CROPS[cropId];
    if (!def) return false;
    const crops = { ...get().crops };
    crops[i] = { cropId, stage: 0, daysGrown: 0, watered: t === T.TILLED_WET, dead: false };
    set({ crops, version: get().version + 1 });
    useTutorialStore.getState().tickPlant();
    return true;
  },

  harvest: (x, y) => {
    if (!inBounds(x, y)) return null;
    const i = idx(x, y);
    const crops = { ...get().crops };
    const c = crops[i];
    if (!c || c.dead) return null;
    const def = CROPS[c.cropId];
    if (!def) return null;
    if (c.stage < def.stages - 1) return null;
    // Phase 5: roll qty TRƯỚC khi xóa crop — kho đầy → return null, crop ở lại ô.
    // Seed drop: base 20% + perk farm-6 (Seed Saver) bonus. Single source qua
    // seedSaverChance() — trước đây literal `0.2 + (hasPerk ? 0.25 : 0)` drift
    // nếu seedSaverChance đổi (2 nguồn sự thật cho cùng 1 perk magnitude).
    const seedDrops = Math.random() < 0.2 + seedSaverChance() ? 1 : 0;
    // Perk farm-4 (Double Harvest) 20% → qty 2.
    const qty = Math.random() < doubleHarvestChance() ? 2 : 1;
    const level = useProgressionStore.getState().level;
    if (!canAdd(get().silo, qty, level)) return null;
    delete crops[i];
    const terrain = [...get().terrain];
    terrain[i] = T.FALLOW;
    const silo = { ...get().silo };
    silo[c.cropId] = (silo[c.cropId] ?? 0) + qty;
    set({ crops, terrain, silo, version: get().version + 1 });
    awardXp("harvest");
    useTutorialStore.getState().tickHarvest();
    return { cropId: c.cropId, qty, seedDrops };
  },

  chopTree: (x, y) => {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    const terrain = [...get().terrain];
    if (terrain[i] !== T.TREE) return false;
    terrain[i] = T.STUMP;
    set({ terrain, version: get().version + 1 });
    return true;
  },

  breakRock: (x, y) => {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    const terrain = [...get().terrain];
    if (terrain[i] !== T.ROCK) return false;
    terrain[i] = T.STONE_EMPTY;
    set({ terrain, version: get().version + 1 });
    return true;
  },

  cutGrass: (x, y) => {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    const terrain = [...get().terrain];
    if (terrain[i] !== T.GRASS_FLOWER) return false;
    terrain[i] = T.GRASS;
    set({ terrain, version: get().version + 1 });
    return true;
  },

  placeObject: (x, y, type) => {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    const t = get().terrain[i];
    if (t === T.WATER || t === T.TREE || t === T.ROCK || t === T.FENCE || t === T.FLOWER_BUSH)
      return false;
    if (get().objects[i]) return false;
    const objects = { ...get().objects };
    objects[i] = { type };
    // If placing fence, also set terrain to FENCE for solidity check convenience? We'll keep objects layer.
    set({ objects, version: get().version + 1 });
    return true;
  },

  pickupForage: (x, y) => {
    if (!inBounds(x, y)) return null;
    const i = idx(x, y);
    const forage = { ...get().forage };
    const item = forage[i];
    if (!item) return null;
    delete forage[i];
    set({ forage, version: get().version + 1 });
    return item;
  },

  spawnForage: (season, replace) => {
    // replace=true (season rollover): xóa forage mùa cũ người chơi chưa nhặt —
    // merge giữ lại → map tích lũy không giới hạn qua 28 ngày (audit M-5).
    // replace=false (daily respawn 50%): merge để không xóa item chưa nhặt hôm trước.
    const existing = { ...get().forage };
    const fresh = spawnForageForSeason(season);
    const forage = replace ? fresh : { ...existing, ...fresh };
    set({ forage, version: get().version + 1 });
  },

  newDay: (season) => {
    const state = get();
    const terrain = [...state.terrain];
    const crops = { ...state.crops };
    // For each crop, if watered yesterday -> grow; check season
    for (const key of Object.keys(crops)) {
      const i = Number(key);
      const c = crops[i];
      if (!c) continue;
      const def = CROPS[c.cropId];
      if (!def) continue;
      // If season changed and crop can't grow here -> dead
      if (!def.seasons.includes(season)) {
        if (c.stage >= def.stages - 1) {
          // Crop ĐÃ trưởng thành (sẵn sàng thu hoạch): giữ nguyên, KHÔNG chết —
          // player vẫn thu hoạch được thành quả sau rollover mùa (Stardew-style).
          // Trước đây set dead → mature crop hết mùa bị khóa, mất công trồng.
          crops[i] = { ...c, dead: false };
          continue;
        }
        // Crop chưa trưởng thành sai mùa → chết và BỊ XÓA khỏi farm, trả ô đất
        // về TILLED (TILLED_WET sẽ được dry ở đoạn sau). Trước đây chỉ set dead →
        // crop chết chiếm ô vĩnh viễn (plant/harvest chặn khi crops[i] tồn tại),
        // player mất ô đất không thể cuốc/trồng lại.
        delete crops[i];
        if (terrain[i] === T.TILLED_WET) terrain[i] = T.TILLED;
        continue;
      }
      if (c.watered && !c.dead) {
        const daysGrown = c.daysGrown + 1;
        const stage = Math.min(def.stages - 1, Math.floor((daysGrown / def.growthDays) * def.stages));
        crops[i] = { ...c, daysGrown, stage, watered: false };
      } else {
        crops[i] = { ...c, watered: false };
      }
    }
    // Dry out tilled wet soil (unless sprinkler adjacent)
    const objects = state.objects;
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === T.TILLED_WET) {
        // check sprinkler adjacency
        const x = i % MAP_COLS;
        const y = Math.floor(i / MAP_COLS);
        let watered = false;
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]) {
          // inBounds trước idx: array 1D row-major → idx(30, y) = idx(0, y+1),
          // wrap-around mép phải (x=29, dx=1) trỏ sang ô (0, y+1) ở hàng dưới.
          // Sprinkler ở (0, y+1) bị tính adjacent cho (29, y) → tưới nhầm ô mép.
          if (!inBounds(x + dx, y + dy)) continue;
          const ni = idx(x + dx, y + dy);
          if (objects[ni]?.type === "sprinkler") {
            watered = true;
            break;
          }
        }
        if (!watered) terrain[i] = T.TILLED;
        else {
          // keep wet & water the crop
          if (crops[i] && !crops[i].dead) crops[i] = { ...crops[i], watered: true };
        }
      }
    }
    // W1P5: cá bột lớn mỗi ngày — mature giữ nguyên chờ thu.
    const pondFish = state.pondFish.map((p) => {
      const grow = fryGrowDays(`fry_${p.fishId}`);
      return p.daysGrown < grow ? { ...p, daysGrown: p.daysGrown + 1 } : p;
    });
    set({ terrain, crops, filledOrders: [], pondFish, version: get().version + 1 });
  },

  regrowResources: (season) => {
    if (season === "Winter") return; // no regrow in winter
    const terrain = [...get().terrain];
    // Regrow độc lập mỗi loại resource — trước đây dùng chung 1 counter `regrown`
    // cho cả stump→tree lẫn stone→rock: 4 stump regrow trước thì 0 rock regrow dù
    // nhiều stone_empty, và ngược lại. Tách counter mỗi loại để cả 2 tài nguyên
    // đều có cơ hội hồi phục đúng cap mỗi mùa (không bị loại kia lấn slot).
    let treesRegrown = 0;
    let rocksRegrown = 0;
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === T.STUMP && Math.random() < 0.25 && treesRegrown < 4) {
        terrain[i] = T.TREE;
        treesRegrown++;
      }
      if (terrain[i] === T.STONE_EMPTY && Math.random() < 0.2 && rocksRegrown < 4) {
        terrain[i] = T.ROCK;
        rocksRegrown++;
      }
    }
    set({ terrain, version: get().version + 1 });
  },

  getShippingBox: (tileIndex) => get().shippingBoxes[tileIndex] ?? null,

  addToShippingBox: (tileIndex, itemId, qty) => {
    const boxes = { ...get().shippingBoxes };
    const box = boxes[tileIndex] ?? { tileIndex, contents: {} };
    box.contents = { ...box.contents, [itemId]: (box.contents[itemId] ?? 0) + qty };
    boxes[tileIndex] = box;
    set({ shippingBoxes: boxes, version: get().version + 1 });
    return 0; // all added, no leftover
  },

  clearShippingBoxes: () => {
    const boxes = { ...get().shippingBoxes };
    for (const key of Object.keys(boxes)) {
      boxes[Number(key)] = { ...boxes[Number(key)], contents: {} };
    }
    set({ shippingBoxes: boxes, version: get().version + 1 });
  },

  addToSilo: (itemId, qty) => {
    if (qty <= 0) return true;
    const silo = get().silo;
    const level = useProgressionStore.getState().level;
    if (!canAdd(silo, qty, level)) return false;
    const next = { ...silo };
    next[itemId] = (next[itemId] ?? 0) + qty;
    set({ silo: next, version: get().version + 1 });
    return true;
  },

  removeFromSilo: (itemId, qty) => {
    const have = get().silo[itemId] ?? 0;
    const take = Math.min(have, qty);
    if (take <= 0) return 0;
    const next = { ...get().silo };
    next[itemId] = have - take;
    if (next[itemId] <= 0) delete next[itemId];
    set({ silo: next, version: get().version + 1 });
    return take;
  },

  markOrderFilled: (orderId) => {
    if (get().filledOrders.includes(orderId)) return;
    set({ filledOrders: [...get().filledOrders, orderId], version: get().version + 1 });
    // W7d-P1: hoàn đơn → farmer rep +2 (server RPC, fire-and-forget — offline bỏ qua).
    import("@/app/actions/reputation")
      .then((m) => m.bumpFarmerAction(2))
      .catch(() => {});
  },

  stockFry: (itemId) => {
    const fry = FRY.find((f) => f.itemId === itemId);
    if (!fry) return false;
    if (get().pondFish.length >= POND_FISH_CAP) return false;
    set({
      pondFish: [...get().pondFish, { fishId: fry.fishId, daysGrown: 0 }],
      version: get().version + 1,
    });
    return true;
  },

  harvestPond: () => {
    const pond = get().pondFish;
    // Review fix (Critical): lọc theo ĐỘ CHÍN của TỪNG con, không theo fishId —
    // ao [carp mature, carp non] trước đây xóa cả con non khi thu 1 con.
    const counts = new Map<string, number>();
    const mature = pond.filter((p) => p.daysGrown >= fryGrowDays(`fry_${p.fishId}`));
    for (const p of mature) counts.set(p.fishId, (counts.get(p.fishId) ?? 0) + 1);
    if (counts.size === 0) return [];
    const remaining = pond.filter((p) => p.daysGrown < fryGrowDays(`fry_${p.fishId}`));
    set({ pondFish: remaining, version: get().version + 1 });
    return [...counts.entries()].map(([fishId, qty]) => ({ fishId, qty }));
  },

  // ── W3P2: decor — placement validate qua decor-placement (thuần) ──────────
  // playerAt: tile người chơi (nếu biết) — decor solid không được đè lên (tự nhốt).
  placeDecor: (defId, tx, ty, rot = 0, playerAt) => {
    const s = get();
    const def = decorById(defId);
    if (!def || (s.decorOwned[defId] ?? 0) <= 0) return false;
    // Probe theo zone: farm dùng terrain store + scenery solid farm; house dùng
    // layout nhà + generic scenery solid. Crops chỉ có ở farm.
    const zone = def.zone;
    const layout = getZone(zone);
    const result = canPlaceDecor(def, tx, ty, rot, {
      zone,
      cols: layout.cols,
      rows: layout.rows,
      terrainAt: (x, y) =>
        zone === "farm" ? s.getTile(x, y) : (layout.terrain[y * layout.cols + x] ?? 0),
      solidAt: (x, y) =>
        zone === "farm"
          ? isFarmScenerySolid(x, y) || s.isSolid(x, y)
          : isZoneScenerySolid("house", x, y),
      cropAt: (x, y) => zone === "farm" && !!s.crops[y * MAP_COLS + x],
      warps: layout.warps.map((w) => ({ x: w.x, y: w.y })),
      decor: s.placedDecor.filter((d) => d.zone === zone),
      playerAt,
    });
    if (!result.ok) return false;
    // Tránh uid trùng tuyệt đối (reseed hydrate là chính, đây là belt-and-braces
    // cho path gọi hydrate thủ công không qua save).
    let n = ++decorUidSeq;
    while (s.placedDecor.some((d) => d.uid === `dc${n}-${defId}`)) n++;
    const uid = `dc${n}-${defId}`;
    const decorOwned = { ...s.decorOwned };
    decorOwned[defId] = (decorOwned[defId] ?? 0) - 1;
    set({
      placedDecor: [...s.placedDecor, { uid, defId, zone, tx, ty, rot, flip: false }],
      decorOwned,
      version: s.version + 1,
    });
    return true;
  },

  removeDecor: (uid) => {
    const s = get();
    const target = s.placedDecor.find((d) => d.uid === uid);
    if (!target) return false;
    const decorOwned = { ...s.decorOwned };
    decorOwned[target.defId] = (decorOwned[target.defId] ?? 0) + 1;
    set({
      placedDecor: s.placedDecor.filter((d) => d.uid !== uid),
      decorOwned,
      version: s.version + 1,
    });
    return true;
  },

  // W3P5: mua decor → tăng sở hữu (chưa đặt, không bump version — chưa render).
  ownDecor: (defId) => {
    const s = get();
    const decorOwned = { ...s.decorOwned };
    decorOwned[defId] = (decorOwned[defId] ?? 0) + 1;
    set({ decorOwned });
  },

  // W3P4: xoay decor đã đặt — kiểm tra footprint mới hợp lệ (bỏ chính nó khỏi
  // danh sách đè) trước khi set; chỉ item rotatable.
  rotateDecor: (uid, playerAt) => {
    const s = get();
    const target = s.placedDecor.find((d) => d.uid === uid);
    if (!target) return false;
    const def = decorById(target.defId);
    if (!def || !def.rotatable) return false;
    const newRot = (((target.rot + 90) % 360) as 0 | 90 | 180 | 270);
    const zone = target.zone;
    const layout = getZone(zone);
    const others = s.placedDecor.filter((d) => d.uid !== uid && d.zone === zone);
    const ok = canPlaceDecor(def, target.tx, target.ty, newRot, {
      zone,
      cols: layout.cols,
      rows: layout.rows,
      terrainAt: (x, y) =>
        zone === "farm" ? s.getTile(x, y) : (layout.terrain[y * layout.cols + x] ?? 0),
      solidAt: (x, y) =>
        zone === "farm"
          ? isFarmScenerySolid(x, y) || s.isSolid(x, y)
          : isZoneScenerySolid("house", x, y),
      cropAt: (x, y) => zone === "farm" && !!s.crops[y * MAP_COLS + x],
      warps: layout.warps.map((w) => ({ x: w.x, y: w.y })),
      decor: others,
      playerAt,
    });
    if (!ok.ok) return false;
    set({
      placedDecor: s.placedDecor.map((d) => (d.uid === uid ? { ...d, rot: newRot } : d)),
      version: s.version + 1,
    });
    return true;
  },

  hydrate: (data) =>
    set((s) => {
      // Validate terrain length khớp grid hiện tại (MAP_COLS*MAP_ROWS). Save legacy
      // từ build cũ hơn (farm 30×22 = 660) hoặc save corrupt/lệch → array ngắn hơn
      // grid → idx(x,y) đọc undefined cho index ngoài array → tile render/mechanic
      // sai. Rebuild full-size, giữ tile cũ hợp lệ, phần thiếu fill GRASS default.
      let terrain = data.terrain ?? s.terrain;
      const expected = MAP_COLS * MAP_ROWS;
      if (terrain.length !== expected) {
        const fixed = new Array<number>(expected).fill(T.GRASS);
        for (let i = 0; i < Math.min(terrain.length, expected); i++) {
          const t = terrain[i];
          if (typeof t === "number" && t >= 0) fixed[i] = t;
        }
        terrain = fixed;
      }
      // Sanitize shippingBoxes contents — cùng class bug questStore shipped
      // (loop 7): save corrupt `{contents:{parsnip:"abc"}}` → endDay sell path
      // `qty=box.contents[id]`="abc" không chặn (string <= 0 false), shipCount
      // string-concat, shipGold Math.round(price*mult*"abc")=NaN → poison gold.
      // Lọc qty phải là int dương.
      const sanitizeBoxes = (raw: unknown): Record<number, ShippingBox> => {
        if (typeof raw !== "object" || !raw || Array.isArray(raw)) return s.shippingBoxes;
        const out: Record<number, ShippingBox> = {};
        for (const [key, box] of Object.entries(raw as Record<string, unknown>)) {
          if (!box || typeof box !== "object") continue;
          const b = box as { contents?: unknown };
          const contents: Record<string, number> = {};
          if (b.contents && typeof b.contents === "object") {
            for (const [item, q] of Object.entries(b.contents as Record<string, unknown>)) {
              if (typeof q === "number" && Number.isFinite(q) && q > 0)
                contents[item] = Math.floor(q);
            }
          }
          if (Object.keys(contents).length > 0)
            out[Number(key)] = { tileIndex: Number(key), contents };
        }
        return out;
      };
      // Phase 5: silo sanitize — cùng class bug shippingBoxes: qty int ≥ 0,
      // bỏ key rác (string/NaN/âm). {parsnip:5, ok:2.7} → {parsnip:5, ok:2}.
      const sanitizeSilo = (raw: unknown): Record<string, number> => {
        if (typeof raw !== "object" || !raw || Array.isArray(raw)) return {};
        const out: Record<string, number> = {};
        for (const [item, q] of Object.entries(raw as Record<string, unknown>)) {
          if (typeof q === "number" && Number.isFinite(q) && q > 0) out[item] = Math.floor(q);
        }
        return out;
      };
      // Phase 5: filledOrders sanitize — chỉ giữ string, dedupe. Id lệch ngày vô
      // hại vì tryFillOrder chỉ nhận id thuộc ordersForDay(day hiện tại).
      const sanitizeFilledOrders = (raw: unknown): string[] => {
        if (!Array.isArray(raw)) return [];
        return [...new Set(raw.filter((x): x is string => typeof x === "string"))];
      };
      // W1P5: pondFish sanitize — fishId phải thuộc FRY, daysGrown int ≥ 0.
      const validFishIds = new Set(FRY.map((f) => f.fishId));
      const sanitizePondFish = (raw: unknown): PondFishState[] => {
        if (!Array.isArray(raw)) return [];
        const out: PondFishState[] = [];
        for (const p of raw) {
          if (!p || typeof p !== "object") continue;
          const { fishId, daysGrown } = p as { fishId?: unknown; daysGrown?: unknown };
          if (typeof fishId !== "string" || !validFishIds.has(fishId)) continue;
          const d =
            typeof daysGrown === "number" && Number.isFinite(daysGrown) && daysGrown > 0
              ? Math.floor(daysGrown)
              : 0;
          out.push({ fishId, daysGrown: d });
          if (out.length >= POND_FISH_CAP) break;
        }
        return out;
      };
      const next = {
        terrain,
        crops: data.crops ?? s.crops,
        objects: data.objects ?? s.objects,
        forage: data.forage ?? s.forage,
        shippingBoxes: sanitizeBoxes(data.shippingBoxes),
        silo: sanitizeSilo(data.silo ?? s.silo),
        filledOrders: sanitizeFilledOrders(data.filledOrders),
        pondFish: sanitizePondFish(data.pondFish),
        placedDecor: sanitizePlacedDecor(data.placedDecor ?? s.placedDecor),
        decorOwned: sanitizeSilo(data.decorOwned ?? s.decorOwned),
        version: s.version + 1,
      };
      // W3P5-fix: reseed uid counter từ save — nếu không, reload về 0 rồi place
      // sinh uid trùng (`dc1-…`) → removeDecor xóa 2 placement hoàn 1 món,
      // sanitize lần sau drop trùng lặng thinh → mất decor vĩnh viễn.
      for (const p of next.placedDecor) {
        const m = /^dc(\d+)-/.exec(p.uid);
        if (m) decorUidSeq = Math.max(decorUidSeq, Number(m[1]));
      }
      return next;
    }),

  reset: () =>
    set({
      terrain: generateMap(),
      crops: {},
      objects: {},
      forage: spawnForageForSeason("Spring"),
      shippingBoxes: {},
      silo: {},
      filledOrders: [],
      pondFish: [],
      placedDecor: [],
      decorOwned: {},
      version: get().version + 1,
    }),

  bump: () => set((s) => ({ version: s.version + 1 })),
}));
