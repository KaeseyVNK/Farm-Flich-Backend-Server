import { loadGame, type SaveSlot } from "@/lib/game/save";
import type { LocalSave } from "./sync";

/**
 * LocalSave mapping cho migrate local→cloud 1 chiều (cloud-save wire, ADR-005).
 * Tách khỏi actions.ts để /login page (và các nơi chỉ cần migrate) không kéo toàn
 * bộ game graph (stores/data/economy) vào bundle — chỉ cần save.ts (IndexedDB).
 *
 * LocalSave = gold/game/player/farm/inventory — KHÔNG progression/npc/story (migrate
 * only cloud-farm state; progression/story cloud sync post-MVP). Inventory slots →
 * aggregate theo itemId (LocalSave.inventory là {itemId, qty}[] không slot).
 */

/** Aggregate inventory slots theo itemId (bỏ null/zero slots). */
function aggregateInventory(slots: ({ itemId: string; qty: number } | null)[]): { itemId: string; qty: number }[] {
  const agg: Record<string, number> = {};
  for (const s of slots) {
    if (s && s.qty > 0) agg[s.itemId] = (agg[s.itemId] ?? 0) + s.qty;
  }
  return Object.entries(agg).map(([itemId, qty]) => ({ itemId, qty }));
}

/**
 * Đọc IndexedDB trực tiếp (không hydrate stores) → LocalSave cho migrate.
 * KHÔNG dùng collectSaveData() — login page chưa hydrate stores (farm/inventory
 * rỗng) → collectSaveData trả default, migrate sẽ đè cloud với state rỗng (mất save).
 * loadGame(slot) tự migrate schema version + corrupt detection.
 * Slots không tồn tại → null (skip migrate, không đè cloud với empty farm mới).
 */
export async function readLocalSaveForMigrate(slot: SaveSlot): Promise<LocalSave | null> {
  const data = await loadGame(slot);
  if (!data) return null;
  return {
    gold: data.game.gold,
    game: {
      day: data.game.day,
      season: data.game.season,
      year: data.game.year,
      timeMinutes: data.game.timeMinutes,
      energy: data.game.energy,
    },
    player: { x: data.player.x, y: data.player.y },
    farm: {
      terrain: data.farm.terrain,
      crops: data.farm.crops,
      objects: data.farm.objects,
      forage: data.farm.forage,
      shippingBoxes: data.farm.shippingBoxes,
    },
    inventory: aggregateInventory(data.inventory.slots),
  };
}
