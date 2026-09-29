// Phase 1 — icon resolution contract.
// The OLD icon-manifest returned a literal "icon.default" string that was NOT present in
// ASSET_MANIFEST, so assetUrl() would throw and a caller could not trust the returned key.
// Contract now: resolveIcon returns a typed IconResolution. An "approved" result ALWAYS
// carries a key that exists + is approved in ASSET_MANIFEST; otherwise it returns a
// documented placeholder descriptor and the caller renders an explicit fallback.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveIcon,
  resolveCategoryIcon,
  iconExists,
  resolveItemSprite,
} from "../../src/lib/game/assets/icon-manifest";
import type { IconCategory, IconResolution } from "../../src/lib/game/assets/icon-manifest";
import { ASSET_MANIFEST, resolveApprovedAsset } from "../../src/lib/game/assets/asset-manifest";
import { SHOP_SEEDS, RECIPES } from "../../src/lib/game/data";
import { DECOR } from "../../src/lib/game/decor/decor-catalog";

const manifestKeys = new Set(ASSET_MANIFEST.map((e) => e.key));

describe("Icon resolution — never leaks a non-existent key", () => {
  it("resolveIcon cho itemId chưa có icon sheet → placeholder descriptor (không fake key)", () => {
    const r = resolveIcon("mystery-stew", "food");
    expect(r.status).toBe("placeholder");
    if (r.status === "placeholder") {
      expect(r.category).toBe("food");
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it("mọi kết quả 'approved' phải là key tồn tại + approved trong manifest", () => {
    // Sweep every category: nếu resolver trả approved, key phải thật.
    const categories: IconCategory[] = [
      "food",
      "fish",
      "bug",
      "tool",
      "weapon",
      "resource",
      "seed",
    ];
    for (const c of categories) {
      const r = resolveIcon(`probe-${c}`, c);
      if (r.status === "approved") {
        expect(manifestKeys.has(r.key), `approved key ${r.key} phải trong manifest`).toBe(true);
        expect(() => resolveApprovedAsset(r.key)).not.toThrow();
      }
    }
  });

  it("không bao giờ trả chuỗi 'icon.default' hay key vắng mặt trong manifest", () => {
    // Guard hồi quy: kết quả approved phải là key thật; placeholder không mang key giả.
    const r1 = resolveIcon("anything", "weapon");
    const r2 = resolveCategoryIcon("tool");
    for (const r of [r1, r2] as IconResolution[]) {
      if (r.status === "approved") {
        expect(r.key).not.toBe("icon.default");
        expect(manifestKeys.has(r.key)).toBe(true);
      } else {
        expect(r.reason).not.toBe("icon.default");
      }
    }
  });

  it("resolveIcon(hoe) → approved key có trong manifest", () => {
    const r = resolveIcon("hoe", "tool");
    expect(r.status).toBe("approved");
    if (r.status === "approved") {
      expect(r.key).toBe("icon.hoe");
      expect(manifestKeys.has(r.key)).toBe(true);
    }
  });

  it("fishing_rod maps to unique wood fishing-rod icon", () => {
    const r = resolveIcon("fishing_rod", "tool");
    expect(r.status).toBe("approved");
    if (r.status === "approved") {
      expect(r.key).toBe("icon.rod");
      expect(manifestKeys.has(r.key)).toBe(true);
    }
    const sprite = resolveItemSprite("fishing_rod");
    expect(sprite?.key).toBe("icon.rod");
    expect(resolveItemSprite("hoe")?.key).not.toBe(sprite?.key);
  });

  it("SHOP_SEEDS map to unique approved crop icons (not category placeholder)", () => {
    const keys = new Set<string>();
    for (const id of SHOP_SEEDS) {
      const r = resolveIcon(id, "seed");
      expect(r.status, id).toBe("approved");
      if (r.status === "approved") {
        expect(manifestKeys.has(r.key)).toBe(true);
        keys.add(r.key);
      }
    }
    expect(keys.size).toBe(SHOP_SEEDS.length);
  });

  it("fry map to the matching adult fish icons", () => {
    expect(resolveIcon("fry_sunfish", "resource")).toEqual({
      status: "approved",
      key: "icon.fish.sunfish",
    });
    expect(resolveIcon("fry_perch", "resource")).toEqual({
      status: "approved",
      key: "icon.fish.perch",
    });
    expect(resolveIcon("fry_carp", "resource")).toEqual({
      status: "approved",
      key: "icon.fish.carp",
    });
  });

  it("resolveCategoryIcon trả placeholder descriptor khi chưa có sheet", () => {
    const r = resolveCategoryIcon("tool");
    expect(r.status).toBe("placeholder");
  });

  it("iconExists: key trong manifest = true; ngoài = false", () => {
    expect(iconExists("tile.grass.spring")).toBe(true);
    expect(iconExists("icon.nonexistent")).toBe(false);
    expect(iconExists("icon.default")).toBe(false); // hồi quy: key giả không tồn tại
  });
});

const ITEM_UI_FILES = [
  "src/components/overlays/CookingModal.tsx",
  "src/components/overlays/ShopModal.tsx",
  "src/components/overlays/GiftPickerModal.tsx",
  "src/components/overlays/DialogueModal.tsx",
  "src/components/panels/BlackMarketPanel.tsx",
  "src/components/panels/SeedsPanel.tsx",
  "src/components/panels/InventoryPanel.tsx",
  "src/components/panels/CraftingPanel.tsx",
  "src/components/panels/RelationshipsPanel.tsx",
  "src/components/panels/FestivalPanel.tsx",
  "src/components/raid/RaidView.tsx",
  "src/components/raid/RaidSummary.tsx",
  "src/app/market/page.tsx",
  "src/app/market/my/page.tsx",
  "src/components/layout/Hotbar.tsx",
];

describe("Item UIs render ItemArt, not emoji identity", () => {
  it("listed React item surfaces do not use getItem/def emoji", () => {
    const root = join(__dirname, "../..");
    for (const rel of ITEM_UI_FILES) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src, rel).toContain("ItemArt");
      expect(src, rel).not.toMatch(/getItem\([^)]*\)\?\.emoji/);
      expect(src, rel).not.toMatch(/\bdef\.emoji\b/);
    }
  });

  it("combat loot pickups do not use item emoji as identity", () => {
    const src = readFileSync(
      join(__dirname, "../../src/components/game/phaser/combat-controller.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/def\?\.emoji/);
    expect(src).toContain("resolveIcon");
  });
});

describe("Craft + decor sheet identity", () => {
  it("craft recipe results have unique sheet crops", () => {
    const keys = new Set<string>();
    for (const r of RECIPES) {
      const sprite = resolveItemSprite(r.result);
      expect(sprite, r.result).not.toBeNull();
      if (!sprite) continue;
      expect(manifestKeys.has(sprite.key), sprite.key).toBe(true);
      keys.add(`${sprite.key}:${sprite.frame.x},${sprite.frame.y},${sprite.frame.w}x${sprite.frame.h}`);
    }
    expect(keys.size).toBe(RECIPES.length);
  });

  it("wood/stone/fiber ingredients crop distinct object sheets", () => {
    const wood = resolveItemSprite("wood");
    const stone = resolveItemSprite("stone");
    const fiber = resolveItemSprite("fiber");
    expect(wood?.key).toBe("obj.farm.barrels");
    expect(stone?.key).toBe("obj.cave.minerals");
    expect(fiber?.key).toBe("obj.farm.haybale");
  });

  it("every DECOR catalog entry has an approved manifestKey", () => {
    for (const d of DECOR) {
      expect(manifestKeys.has(d.manifestKey), d.id).toBe(true);
      expect(() => resolveApprovedAsset(d.manifestKey)).not.toThrow();
    }
  });

  it("DecorPanel/Overlay crop unique decor art, not generic feature-decor", () => {
    const root = join(__dirname, "../..");
    const panel = readFileSync(join(root, "src/components/panels/DecorPanel.tsx"), "utf8");
    const overlay = readFileSync(join(root, "src/components/overlays/DecorOverlay.tsx"), "utf8");
    expect(panel).toContain("DecorArt");
    expect(panel).not.toMatch(/GameIcon id="feature-decor"/);
    expect(overlay).toContain("DecorArt");
  });
});

