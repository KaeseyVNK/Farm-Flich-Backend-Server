import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { UnityFarmSaveDTO } from "@/lib/game/unity-adapter";
import { cashPriceMilli } from "@/lib/unity/cash-catalog";

export class CashPurchaseError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

type PurchaseInput = {
  playerId: string;
  requestId: string;
  kind: "ITEM" | "PLOT";
  targetId: string;
  quantity: number;
  farm: UnityFarmSaveDTO;
};

function timestamp(farm: UnityFarmSaveDTO): number {
  const value = farm.Profile?.LastSaveTimestamp;
  return typeof value === "number" && Number.isSafeInteger(value) ? value : 0;
}

function grant(farm: UnityFarmSaveDTO, input: PurchaseInput): UnityFarmSaveDTO {
  const result = JSON.parse(JSON.stringify(farm)) as UnityFarmSaveDTO;
  if (result.Profile?.PlayerId?.trim().toLowerCase() !== input.playerId ||
      !Array.isArray(result.Inventory)) throw new CashPurchaseError("INVALID_FARM", 400);

  if (input.kind === "PLOT") {
    const plotId = Number(input.targetId);
    const plots = result.Profile.UnlockedPlotIds;
    if (!Array.isArray(plots)) throw new CashPurchaseError("INVALID_FARM", 400);
    if (plots.includes(plotId)) throw new CashPurchaseError("ALREADY_OWNED", 409);
    plots.push(plotId);
    plots.sort((a, b) => a - b);
  } else {
    const slots = result.Inventory;
    const rowCount = result.Profile.UnlockedRowCount;
    if (!Number.isInteger(rowCount) || rowCount! < 2 || rowCount! > 4) {
      throw new CashPurchaseError("INVALID_FARM", 400);
    }
    const limit = rowCount! * 9;
    const maxStack = input.targetId.startsWith("seed_") ? 99 : 1;
    let remaining = input.quantity;
    for (const slot of slots) {
      if (slot.ItemId !== input.targetId || !Number.isInteger(slot.Quantity) ||
          slot.Quantity! < 1 || slot.Quantity! >= maxStack) continue;
      const added = Math.min(maxStack - slot.Quantity!, remaining);
      slot.Quantity! += added;
      remaining -= added;
      if (remaining === 0) break;
    }
    const used = new Set(slots.map((slot) => slot.SlotIndex));
    for (let index = 0; index < limit && remaining > 0; index++) {
      if (used.has(index)) continue;
      const added = Math.min(maxStack, remaining);
      slots.push({ SlotIndex: index, ItemId: input.targetId, Quantity: added });
      remaining -= added;
    }
    if (remaining > 0) throw new CashPurchaseError("BAG_FULL", 409);
    slots.sort((a, b) => (a.SlotIndex ?? 0) - (b.SlotIndex ?? 0));
  }
  result.Profile.LastSaveTimestamp = Math.max(timestamp(farm), Math.floor(Date.now() / 1000)) + 1;
  return result;
}

export async function purchaseWithCash(input: PurchaseInput) {
  if (!input.playerId || !/^[A-Za-z0-9_-]{16,100}$/.test(input.requestId) ||
      (input.kind !== "ITEM" && input.kind !== "PLOT") ||
      typeof input.targetId !== "string" || !input.farm || typeof input.farm !== "object") {
    throw new CashPurchaseError("INVALID_REQUEST", 400);
  }
  const costMilli = cashPriceMilli(input.kind, input.targetId, input.quantity);
  if (costMilli === null) throw new CashPurchaseError("NOT_CASH_ELIGIBLE", 400);

  return db.$transaction(async (tx) => {
    // Serialize purchases and wallet updates for one player.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.playerId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: input.playerId }, select: { cashMilli: true } });
    const farm = await tx.farm.findUnique({ where: { ownerId: input.playerId }, select: { unitySnapshot: true } });
    if (!user || !farm) throw new CashPurchaseError("PLAYER_NOT_FOUND", 404);

    const previous = await tx.cashPurchase.findUnique({
      where: { userId_requestId: { userId: input.playerId, requestId: input.requestId } },
    });
    if (previous) {
      if (previous.kind !== input.kind || previous.targetId !== input.targetId ||
          previous.quantity !== input.quantity) throw new CashPurchaseError("REQUEST_CONFLICT", 409);
      return { ok: true, playerId: input.playerId, balanceMilliCash: Number(user.cashMilli),
        costMilli: Number(previous.costMilli), farm: farm.unitySnapshot, replayed: true };
    }

    const cloud = farm.unitySnapshot as UnityFarmSaveDTO;
    const source = cloud?.Profile && timestamp(cloud) > timestamp(input.farm) ? cloud : input.farm;
    const next = grant(source, input);
    if (user.cashMilli < BigInt(costMilli)) throw new CashPurchaseError("INSUFFICIENT_CASH", 409);

    await tx.user.update({ where: { id: input.playerId }, data: { cashMilli: { decrement: BigInt(costMilli) } } });
    await tx.farm.update({ where: { ownerId: input.playerId },
      data: { unitySnapshot: next as Prisma.InputJsonValue, version: { increment: 1 } } });
    await tx.cashPurchase.create({ data: {
      userId: input.playerId, requestId: input.requestId, kind: input.kind,
      targetId: input.targetId, quantity: input.quantity, costMilli: BigInt(costMilli),
    } });
    return { ok: true, playerId: input.playerId, balanceMilliCash: Number(user.cashMilli - BigInt(costMilli)),
      costMilli, farm: next, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
