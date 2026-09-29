import { describe, it, expect } from "vitest";
import { DEEPFOREST_ZONE, DEEPFOREST_SPAWNS } from "../../src/lib/game/zones/deepforest";
import { FARM_ZONE, getZone, ZONE_IDS } from "../../src/lib/game/zones";
import { T, SOLID_TILES } from "../../src/lib/game/constants";
import { ENEMIES, enemyById, ENEMY_ZONES, COMBAT_TUNE } from "../../src/lib/game/combat/enemy-catalog";
import { getItem } from "../../src/lib/game/data";
import { KITCHEN_RECIPES } from "../../src/lib/game/cooking/recipe-catalog";
import { ASSET_MANIFEST } from "../../src/lib/game/assets/asset-manifest";

const walkable = (t: number) => !SOLID_TILES.has(t);

describe("deepforest zone (W5 P1)", () => {
  it("36×28, id đúng, có trong ZONE_IDS + getZone", () => {
    expect(DEEPFOREST_ZONE.cols).toBe(36);
    expect(DEEPFOREST_ZONE.rows).toBe(28);
    expect(DEEPFOREST_ZONE.terrain).toHaveLength(36 * 28);
    expect(ZONE_IDS).toContain("deepforest");
    expect(getZone("deepforest")).toBe(DEEPFOREST_ZONE);
  });

  it("viền 2 tile TREE kín — không thoát map", () => {
    for (let x = 0; x < 36; x++) {
      expect(DEEPFOREST_ZONE.terrain[0 * 36 + x]).toBe(T.TREE);
      expect(DEEPFOREST_ZONE.terrain[1 * 36 + x]).toBe(T.TREE);
      expect(DEEPFOREST_ZONE.terrain[26 * 36 + x]).toBe(T.TREE);
      expect(DEEPFOREST_ZONE.terrain[27 * 36 + x]).toBe(T.TREE);
    }
    for (let y = 0; y < 28; y++) {
      expect(DEEPFOREST_ZONE.terrain[y * 36 + 0]).toBe(T.TREE);
      expect(DEEPFOREST_ZONE.terrain[y * 36 + 1]).toBe(T.TREE);
      expect(DEEPFOREST_ZONE.terrain[y * 36 + 34]).toBe(T.TREE);
      expect(DEEPFOREST_ZONE.terrain[y * 36 + 35]).toBe(T.TREE);
    }
  });

  it("warp two-way farm ↔ deepforest, warp + spawn tile walkable", () => {
    const w = DEEPFOREST_ZONE.warps[0];
    expect(w?.to).toBe("farm");
    expect(w?.spawn).toEqual({ x: 56, y: 10 });
    // warp tile deepforest (2,14) walkable
    expect(walkable(DEEPFOREST_ZONE.terrain[14 * 36 + 2])).toBe(true);
    // spawn deepforest (3,14) walkable
    expect(walkable(DEEPFOREST_ZONE.terrain[14 * 36 + 3])).toBe(true);
    // farm side: warp (57,10) + spawn quanh đó walkable (terrain + không scenery solid)
    expect(walkable(FARM_ZONE.terrain[10 * 60 + 57])).toBe(true);
    expect(walkable(FARM_ZONE.terrain[10 * 60 + 56])).toBe(true);
    const fw = FARM_ZONE.warps.find((x) => x.to === "deepforest");
    expect(fw).toMatchObject({ x: 57, y: 10, to: "deepforest" });
    expect(fw?.spawn).toEqual({ x: 3, y: 14 });
  });

  it("8 spawn quái — defId hợp lệ, tile spawn + 4 láng giềng walkable (không kẹt)", () => {
    expect(DEEPFOREST_SPAWNS).toHaveLength(8);
    for (const s of DEEPFOREST_SPAWNS) {
      expect(enemyById(s.defId), s.id).toBeDefined();
      expect(walkable(DEEPFOREST_ZONE.terrain[s.y * 36 + s.x]), `${s.id}@${s.x},${s.y}`).toBe(true);
      const neighbors = [
        [s.x + 1, s.y],
        [s.x - 1, s.y],
        [s.x, s.y + 1],
        [s.x, s.y - 1],
      ];
      const open = neighbors.filter(([nx, ny]) => walkable(DEEPFOREST_ZONE.terrain[ny * 36 + nx]));
      expect(open.length, `${s.id} cần ≥1 lối thoát`).toBeGreaterThan(0);
    }
  });

  it("các zone cozy KHÔNG có spawn quái (farm/house/village/beach/cave)", () => {
    for (const id of ["farm", "house", "village", "beach", "cave"] as const) {
      expect(ENEMY_ZONES).not.toContain(id);
    }
  });
});

describe("enemy-catalog (W5 P1)", () => {
  it("4 loại, stat tăng dần theo độ khó (hp/xp)", () => {
    expect(ENEMIES).toHaveLength(4);
    const byId = ["sprout_slime", "slime_green", "slime_blue", "myconid_purple"];
    let prevHp = 0;
    let prevXp = 0;
    for (const id of byId) {
      const e = enemyById(id)!;
      expect(e.hp).toBeGreaterThan(prevHp);
      expect(e.xp).toBeGreaterThan(prevXp);
      prevHp = e.hp;
      prevXp = e.xp;
    }
  });

  it("sheetKey tồn tại trong asset-manifest (sync — không quên copy)", () => {
    const keys = new Set(ASSET_MANIFEST.map((a) => a.key));
    for (const e of ENEMIES) {
      expect(keys.has(e.sheetKey), e.sheetKey).toBe(true);
    }
  });

  it("loot itemId đều là ITEMS hợp lệ", () => {
    for (const e of ENEMIES) {
      for (const l of e.loot) {
        expect(getItem(l.itemId), `${e.id} loot ${l.itemId}`).toBeDefined();
        expect(l.chance).toBeGreaterThan(0);
        expect(l.chance).toBeLessThanOrEqual(1);
        if (l.qty) {
          expect(l.qty[0]).toBeLessThanOrEqual(l.qty[1]);
          expect(l.qty[0]).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("quái chậm hơn player đi bộ (120) — không thể đuổi kịp khi chạy", () => {
    for (const e of ENEMIES) {
      expect(e.speed).toBeLessThan(120);
    }
  });

  it("COMBAT_TUNE hợp lý: arc < 180°, reach ngắn, invuln dương", () => {
    expect(COMBAT_TUNE.swingArcDeg).toBeLessThan(180);
    expect(COMBAT_TUNE.swingReachTiles).toBeGreaterThan(1);
    expect(COMBAT_TUNE.invulnMs).toBeGreaterThan(0);
  });
});

describe("W5 loot → recipes (§7)", () => {
  it("4 recipe mới dùng nguyên liệu rừng; nguyên liệu không tự bán đắt hơn món (kinh tế)", () => {
    const ids = ["ck_jelly_salad", "ck_mushroom_risotto", "ck_forest_herb_tea", "ck_sprout_wrap"];
    for (const id of ids) {
      const r = KITCHEN_RECIPES.find((x) => x.id === id);
      expect(r, id).toBeDefined();
      const out = getItem(r!.outputItemId)!;
      // món phải bán được nhiều hơn tổng giá nguyên liệu (lợi nhuận nấu)
      const inputCost = r!.inputs.reduce((s, i) => s + (getItem(i.itemId)?.sellPrice ?? 0) * i.qty, 0);
      expect((out.sellPrice ?? 0), `${id} sell ${out.sellPrice} vs cost ${inputCost}`).toBeGreaterThan(inputCost);
    }
  });

  it("mỗi nguyên liệu rừng có ≥1 recipe tiêu thụ", () => {
    for (const m of ["slime_jelly", "glow_mushroom", "forest_herb", "sprout_leaf"]) {
      const used = KITCHEN_RECIPES.some((r) => r.inputs.some((i) => i.itemId === m));
      expect(used, m).toBe(true);
    }
  });

  it("sword là item tool mua được (SHOP gate lvl 3, 450g)", () => {
    const sword = getItem("sword")!;
    expect(sword.toolKind).toBe("sword");
    expect(sword.toolEnergy).toBe(1);
  });
});
