import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { type CashKind, cashPriceMilli, isCashKind } from "@/lib/unity/cash-catalog";

export class CashPurchaseError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

type PurchaseInput = {
  playerId: string;
  requestId: string;
  kind: CashKind;
  targetId: string;
  quantity: number;
};

/**
 * Cash receipt (contract §8). UnityServer owns the farm and applies the grant;
 * this service only charges Cash and records an immutable receipt per requestId.
 */
export type CashReceipt = {
  ok: true;
  receiptId: string;
  playerId: string;
  kind: CashKind;
  targetId: string;
  quantity: number;
  costMilli: number;
  balanceMilliCash: number;
  replayed: boolean;
};

export async function purchaseWithCash(input: PurchaseInput): Promise<CashReceipt> {
  if (!input.playerId || !/^[A-Za-z0-9_-]{16,100}$/.test(input.requestId) ||
      !isCashKind(input.kind) || typeof input.targetId !== "string") {
    throw new CashPurchaseError("INVALID_REQUEST", 400);
  }
  const costMilli = cashPriceMilli(input.kind, input.targetId, input.quantity);
  if (costMilli === null) throw new CashPurchaseError("NOT_CASH_ELIGIBLE", 400);

  return db.$transaction(async (tx) => {
    // Serialize purchases and wallet updates for one player.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.playerId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: input.playerId }, select: { cashMilli: true } });
    if (!user) throw new CashPurchaseError("PLAYER_NOT_FOUND", 404);

    const previous = await tx.cashPurchase.findUnique({
      where: { userId_requestId: { userId: input.playerId, requestId: input.requestId } },
    });
    if (previous) {
      if (previous.kind !== input.kind || previous.targetId !== input.targetId ||
          previous.quantity !== input.quantity) throw new CashPurchaseError("REQUEST_CONFLICT", 409);
      return { ok: true, receiptId: previous.id, playerId: input.playerId, kind: input.kind,
        targetId: input.targetId, quantity: input.quantity, costMilli: Number(previous.costMilli),
        balanceMilliCash: Number(user.cashMilli), replayed: true };
    }

    if (user.cashMilli < BigInt(costMilli)) throw new CashPurchaseError("INSUFFICIENT_CASH", 409);

    await tx.user.update({ where: { id: input.playerId }, data: { cashMilli: { decrement: BigInt(costMilli) } } });
    const receipt = await tx.cashPurchase.create({ data: {
      userId: input.playerId, requestId: input.requestId, kind: input.kind,
      targetId: input.targetId, quantity: input.quantity, costMilli: BigInt(costMilli),
    } });
    return { ok: true, receiptId: receipt.id, playerId: input.playerId, kind: input.kind,
      targetId: input.targetId, quantity: input.quantity, costMilli,
      balanceMilliCash: Number(user.cashMilli - BigInt(costMilli)), replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
