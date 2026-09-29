import { describe, it, expect } from "vitest";
import { SAVE_SCHEMA_VERSION, migrate, type SaveData } from "../../src/lib/game/save";

// Save player coords = TILE (dimensionless). collectSaveData lưu getPlayerTile,
// applySaveData teleportToTile. Tile coords không đổi khi TILE_SIZE đổi → KHÔNG rescale.
// Trước đây migrate rescale ×1.5 corrupt: teleport tile(936,1008) → pixel 44928 ra map.
describe("Save player coords (tile, dimensionless — no rescale)", () => {
  it("SAVE_SCHEMA_VERSION integer (schema 12 = tutorial; ADR-004 integer-only)", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(12);
    expect(Number.isInteger(SAVE_SCHEMA_VERSION)).toBe(true);
  });

  it("migrate KHÔNG rescale player coords (tile = dimensionless)", () => {
    const raw: Partial<SaveData> = {
      version: 4,
      coordVersion: 1, // legacy marker — giờ no-op, không rescale
      game: { day: 5, season: "Spring", seasonIndex: 0, year: 1, timeMinutes: 600, gold: 100, energy: 50 },
      player: { x: 19, y: 20 },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {} },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
    };
    const out = migrate(raw);
    expect(out).not.toBeNull();
    // Player tile coords GIỮ NGUYÊN — không ×1.5 như trước.
    expect(out!.player.x).toBe(19);
    expect(out!.player.y).toBe(20);
    expect(out!.coordVersion).toBe(2);
  });

  it("default player fallback là tile coords hợp lệ (trong map 60×60), KHÔNG pixel", () => {
    // Trước đây default {624,672} = pixel → làm tile → teleport ra map (624×48=29952).
    const raw: Partial<SaveData> = {
      version: 4,
      game: { day: 1, season: "Spring", seasonIndex: 0, year: 1, timeMinutes: 360, gold: 0, energy: 100 },
      // Không có player → migrate dùng default.
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {} },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
    };
    const out = migrate(raw);
    expect(out).not.toBeNull();
    // Default (19,20) tile = trong map, hợp lệ.
    expect(out!.player.x).toBeLessThan(60);
    expect(out!.player.y).toBeLessThan(60);
  });
});
