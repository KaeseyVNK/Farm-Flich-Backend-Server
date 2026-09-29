import { describe, it, expect } from "vitest";
import { CROPS, ITEMS, RECIPES, NPCS, SHOP_SEEDS, getItem, getCrop } from "../../src/lib/game/data";
import { ECONOMY, seedBuyPrice, vendorSellPrice } from "../../src/lib/game/economy";

// Audit: data.ts (item/crop/recipe/npc/shop catalog) chưa có test integrity.
// Một item id typo trong recipe/shop/npc gift → runtime error mà test không bắt.
// Test này đảm bảo mọi tham chiếu trỏ tới định nghĩa hợp lệ.

const ITEM_IDS = new Set(Object.keys(ITEMS));
const CROP_IDS = new Set(Object.keys(CROPS));

describe("data integrity — item/crop catalog", () => {
  it("mọi crop id đều có item tương ứng (crop có thể bán)", () => {
    for (const cid of CROP_IDS) {
      const item = getItem(cid);
      expect(item, `crop ${cid} thiếu ITEMS entry`).toBeDefined();
      expect(item?.type).toBe("crop");
    }
  });

  it("mọi seed growsInto trỏ tới crop hợp lệ + seasons không rỗng", () => {
    for (const [id, def] of Object.entries(ITEMS)) {
      if (def.type !== "seed") continue;
      expect(def.growsInto, `seed ${id} thiếu growsInto`).toBeTruthy();
      expect(CROPS[def.growsInto!], `seed ${id} growsInto ${def.growsInto} không tồn tại`).toBeDefined();
      expect(def.seasons?.length, `seed ${id} seasons rỗng`).toBeGreaterThan(0);
      // seed bán được (player có thể plant → harvest → sell chain)
      expect(def.sellPrice, `seed ${id} thiếu sellPrice`).toBeGreaterThanOrEqual(0);
    }
  });

  it("crop có seed tương ứng (growsInto đảo ngược)", () => {
    const seededCrops = new Set(
      Object.values(ITEMS).filter((d) => d.type === "seed").map((d) => d.growsInto),
    );
    for (const cid of CROP_IDS) {
      expect(seededCrops.has(cid), `crop ${cid} không có seed để trồng`).toBe(true);
    }
  });

  it("recipe result + ingredients đều là item hợp lệ", () => {
    for (const r of RECIPES) {
      expect(ITEM_IDS.has(r.result), `recipe ${r.id} result ${r.result} không tồn tại`).toBe(true);
      expect(r.resultQty).toBeGreaterThan(0);
      expect(r.ingredients.length).toBeGreaterThan(0);
      for (const ing of r.ingredients) {
        expect(ITEM_IDS.has(ing.item), `recipe ${r.id} ingredient ${ing.item} không tồn tại`).toBe(true);
        expect(ing.qty).toBeGreaterThan(0);
      }
    }
  });

  it("shop seeds đều là seed item tồn tại", () => {
    for (const sid of SHOP_SEEDS) {
      const def = getItem(sid);
      expect(def, `shop seed ${sid} không tồn tại`).toBeDefined();
      expect(def?.type, `shop seed ${sid} không phải seed`).toBe("seed");
    }
  });

  it("NPC gift loves/likes/hates đều là item hợp lệ", () => {
    for (const [npcId, npc] of Object.entries(NPCS)) {
      for (const g of [...(npc.loves ?? []), ...(npc.likes ?? []), ...(npc.hates ?? [])]) {
        expect(ITEM_IDS.has(g), `NPC ${npcId} gift ${g} không tồn tại`).toBe(true);
      }
    }
  });

  it("NPC dialogueChoices setFlag phải là flag nhánh hợp lệ (mercy/corruption/selfless)", () => {
    // Phase 7 story wire: choice setFlag accumulate → ending resolve. Flag lạ
    // (typo) → resolveEnding không match ending nào → ending dead im lặng.
    const VALID_FLAGS = new Set(["mercy", "corruption", "selfless"]);
    for (const [npcId, npc] of Object.entries(NPCS)) {
      for (const c of npc.dialogueChoices ?? []) {
        expect(VALID_FLAGS.has(c.setFlag), `NPC ${npcId} choice flag "${c.setFlag}" lạ`).toBe(true);
        expect(c.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("mọi crop trong quest CROP_IDS có thể bán (sellPrice > 0)", () => {
    for (const cid of CROP_IDS) {
      const crop = getCrop(cid);
      expect(crop?.sellPrice, `crop ${cid} thiếu sellPrice`).toBeGreaterThan(0);
    }
  });

  it("crop cũng có ITEMS entry (bán được qua sellItem)", () => {
    // Crop định nghĩa ở cả CROPS (growth) và ITEMS (item bán) — 2 bảng bổ trợ.
    for (const cid of CROP_IDS) {
      expect(ITEM_IDS.has(cid), `crop ${cid} thiếu ITEMS entry`).toBe(true);
    }
  });

  it("food items có energy > 0 (có thể ăn)", () => {
    for (const [id, def] of Object.entries(ITEMS)) {
      if (def.type !== "food") continue;
      expect(def.energy, `food ${id} thiếu energy`).toBeGreaterThan(0);
      expect(def.sellPrice, `food ${id} thiếu sellPrice`).toBeDefined();
    }
  });

  it("CROPS.sellPrice khớp economy.json base (chặn drift dual-source)", () => {
    // Bug đã fix: shop UI đọc crop.seedPrice từ data.ts nhưng buySeed tính
    // seedBuyPrice() từ economy.json → giá hiển thị (80g) khác giá thực trừ (40g)
    // cho blueberry/corn. Seed price nay chỉ tồn tại ở economy.json.
    // Còn sellPrice: CROPS phải khớp economy.crops.base để bán đúng giá hiển thị.
    for (const [cid, crop] of Object.entries(CROPS)) {
      const ecoBase = ECONOMY.crops[cid]?.base;
      expect(ecoBase, `economy.crops.${cid} thiếu base`).toBeDefined();
      expect(crop.sellPrice, `CROPS.${cid}.sellPrice vs economy base`).toBe(ecoBase);
      // seed price không còn được nhân đôi ở CROPS — chỉ economy là nguồn
      const seedId = `${cid}_seed`;
      expect(seedBuyPrice(seedId), `seed ${seedId} phải có giá mua`).toBeGreaterThan(0);
    }
  });

  it("emoji duy nhất giữa crop items + forage/food (chặn nhầm lẫn item identity)", () => {
    // Bug đã fix: CROPS.parsnip đổi 🌰 nhưng ITEMS.parsnip vẫn 🥕 — thu hoạch cho
    // 2 item khác nhau (parsnip/carrot) hiển thị cùng emoji → nhầm lẫn trong
    // inventory/hotbar/toast. Guard: emoji của mọi crop ITEMS phải duy nhất và
    // khớp CROPS tương ứng; emoji harvest-able (crop/forage/food) không trùng nhau.
    const seen = new Map<string, string>();
    for (const [id, def] of Object.entries(ITEMS)) {
      if (!["crop", "forage", "food"].includes(def.type)) continue;
      const prev = seen.get(def.emoji);
      expect(prev, `emoji ${def.emoji} trùng giữa ${prev} và ${id}`).toBeUndefined();
      seen.set(def.emoji, id);
    }
    // crop ITEMS emoji phải khớp CROPS emoji (2 bảng phụ).
    for (const cid of CROP_IDS) {
      const item = getItem(cid);
      const crop = getCrop(cid);
      expect(item?.emoji, `ITEMS.${cid} emoji khác CROPS.${cid}`).toBe(crop?.emoji);
    }
  });

  it("mọi ITEMS sellable phải có entry trong economy (chặn drift vendorSellPrice=0)", () => {
    // Bug đã fix: shipping_box có ITEMS.sellPrice=15 nhưng economy.json crafts thiếu
    // entry → vendorSellPrice trả 0. Sell tab hiển thị/bán 15g (ITEMS) nhưng shipping
    // box qua đêm tính 0g. Giờ economy.crafts.shipping_box = 15 khớp ITEMS.
    // Guard hệ thống: ITEMS.sellPrice > 0 ⇒ vendorSellPrice cùng type > 0 và khớp.
    for (const [id, def] of Object.entries(ITEMS)) {
      if (def.sellPrice == null || def.sellPrice <= 0) continue;
      const eco = vendorSellPrice(id, def.type);
      expect(eco, `ITEMS.${id} sellPrice ${def.sellPrice} nhưng economy vendor = ${eco}`)
        .toBe(def.sellPrice);
    }
  });
});
