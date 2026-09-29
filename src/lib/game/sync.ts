import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getItem } from "@/lib/game/data";

/**
 * Migrate local save (IndexedDB) → cloud 1 CHIỀU (red-team #5, audit C1/C2/H7).
 * Chạy lần đầu login (anon user có local save, chưa migratedAt).
 * Sau migrate: server = source of truth, IndexedDB = cache offline.
 *
 * localSave shape khớp `save.ts` SaveData (đã có trong codebase).
 */
export interface LocalSave {
  gold?: number;
  game?: {
    day: number;
    season: string;
    year: number;
    timeMinutes: number;
    energy: number;
  };
  player?: { x: number; y: number };
  farm?: {
    terrain?: number[];
    crops?: Record<string, unknown>;
    objects?: Record<string, unknown>;
    forage?: Record<string, unknown>;
    shippingBoxes?: Record<string, unknown>;
  };
  inventory?: { itemId: string; qty: number }[];
}

const EMPTY_TERRAIN = () => new Array(900).fill(0);

/**
 * Migrate 1 chiều. Idempotent — đã migrate (migratedAt set) thì return ngay.
 * Trả true nếu đã migrate (lần này hoặc trước), false nếu skip.
 */
export async function migrateLocalToCloud(
  userId: string,
  local: LocalSave | null,
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { migratedAt: true },
  });
  if (!user) throw new Error(`user ${userId} không tồn tại — tạo user trước khi migrate`);
  if (user.migratedAt) return true; // idempotent

  const farm = local?.farm ?? {};
  await db.farm.upsert({
    where: { ownerId: userId },
    create: {
      ownerId: userId,
      terrain: farm.terrain ?? EMPTY_TERRAIN(),
      crops: (farm.crops ?? {}) as Prisma.InputJsonValue,
      objects: (farm.objects ?? {}) as Prisma.InputJsonValue,
      forage: (farm.forage ?? {}) as Prisma.InputJsonValue,
      shippingBoxes: (farm.shippingBoxes ?? {}) as Prisma.InputJsonValue,
      gameMeta: {
        day: local?.game?.day ?? 1,
        season: local?.game?.season ?? "Spring",
        year: local?.game?.year ?? 1,
        timeMinutes: local?.game?.timeMinutes ?? 360,
        energy: local?.game?.energy ?? 270,
        player: local?.player ?? { x: 19, y: 20 },
      },
    },
    update: {}, // farm đã tồn tại (race) — không đè
  });

  // Gold từ local (audit L1) hoặc giữ default User.gold.
  // Code-review C5: client-supplied gold bị chặn — local-first economy nghĩa là
  // mọi gold kiếm được nằm ở client; tin payload = self-funding primitive.
  // Giữ default User.gold (500). Ceiling: nếu muốn honor local gold, cần
  // server-side sanity cap (vd ≤ tổng thời gian chơi × rate) + audit trail.
  await db.user.update({
    where: { id: userId },
    data: { migratedAt: new Date() },
  });

  // Inventory từ local. Code-review C5b: chỉ item trong catalog, qty cap hợp lý
  // (999/slot khớp UI stack cap) — chặn phantom itemId + unbounded qty.
  if (local?.inventory?.length) {
    await db.inventory.createMany({
      data: local.inventory
        .filter((i) => i.qty > 0 && Number.isInteger(i.qty))
        .filter((i) => !!getItem(i.itemId))
        .map((i) => ({ userId, itemId: i.itemId, qty: Math.min(i.qty, 999) })),
      skipDuplicates: true,
    });
  }

  // Mask seed default (concept §6 — cần mask để raid). audit L2.
  await db.mask.upsert({
    where: { userId_maskId: { userId, maskId: "rogue" } },
    create: { userId, maskId: "rogue", durability: 10, equipped: true },
    update: {},
  });

  return true;
}
