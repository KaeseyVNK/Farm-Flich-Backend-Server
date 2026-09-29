import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { DECOR } from "@/lib/game/decor/decor-catalog";

/**
 * Farm service — save/load farm JSONB (terrain/crops/objects/forage/shippingBoxes/gameMeta phi-gold).
 * Lock-check: reject save khi RaidSession active (red-team #11 — owner save không đè raid state).
 *
 * Server Action `src/app/actions/farm.ts` wrap: auth + gọi service.
 */

export interface FarmSaveData {
  terrain: number[];
  crops: Record<string, unknown>;
  objects: Record<string, unknown>;
  forage: Record<string, unknown>;
  shippingBoxes: Record<string, unknown>;
  gameMeta: Record<string, unknown>; // PHI-GOLD (audit C1)
  /** W4: decor đã đặt (đã sanitize hydrate client) — visit render + KHÔNG raid loot. */
  placedDecor?: unknown[];
  /** Ao cá (fishId/daysGrown) — visit render; không ghi createdAt từ client. */
  pondFish?: unknown[];
}

export async function saveFarm(userId: string, data: FarmSaveData): Promise<number> {
  const farm = await db.farm.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (!farm) throw new Error(`farm not found for user ${userId}`);

  // Review M: lock-check + update trong 1 interactive transaction — trước đây
  // SELECT rồi UPDATE riêng (TOCTOU): raid start giữa 2 statement → owner save
  // đè state farm giữa raid. $transaction + FOR UPDATE serialize với join gate.
  const updated = await db.$transaction(async (tx) => {
    const active = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "RaidSession" WHERE "farmId" = ${farm.id} AND status = 'active' FOR UPDATE`;
    if (active.length > 0) throw new Error("farm locked: raid active");
    return tx.farm.update({
      where: { id: farm.id },
      data: {
        terrain: data.terrain,
        crops: data.crops as Prisma.InputJsonValue,
        objects: data.objects as Prisma.InputJsonValue,
        forage: data.forage as Prisma.InputJsonValue,
        shippingBoxes: data.shippingBoxes as Prisma.InputJsonValue,
        gameMeta: data.gameMeta as Prisma.InputJsonValue,
        // Review H9: placedDecor server-side cap + defId whitelist — payload client
        // wholesale trước đây cho phép 100k entry → festival score inflation +
        // visitor render DoS. Cap 200 (far hơn max đặt thực tế); id lạ → drop.
        ...(data.placedDecor !== undefined
          ? {
              placedDecor: (Array.isArray(data.placedDecor) ? data.placedDecor : [])
                .slice(0, 200)
                .filter(
                  (d): d is { defId: string } =>
                    !!d && typeof d === "object" &&
                    typeof (d as { defId?: unknown }).defId === "string" &&
                    DECOR.some((def) => def.id === (d as { defId: string }).defId),
                ) as Prisma.InputJsonValue,
            }
          : {}),
        ...(data.pondFish !== undefined ? { pondFish: data.pondFish as Prisma.InputJsonValue } : {}),
        version: { increment: 1 },
      },
      select: { version: true },
    });
  });
  return updated.version;
}

export async function loadFarm(userId: string) {
  return db.farm.findUnique({ where: { ownerId: userId } });
}
