import { beforeEach, describe, expect, it, vi } from "vitest";
import { cashPriceMilli } from "@/lib/unity/cash-catalog";

const state = vi.hoisted(() => ({
  balance: BigInt(100000),
  previous: null as null | Record<string, unknown>,
  debits: 0,
  farmWrites: 0,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      $queryRaw: async () => [{ id: "farmer" }],
      user: {
        findUnique: async () => ({ cashMilli: state.balance }),
        update: async ({ data }: { data: { cashMilli: { decrement: bigint } } }) => {
          state.balance -= data.cashMilli.decrement;
          state.debits++;
        },
      },
      farm: {
        findUnique: async () => { throw new Error("purchase must not read the Unity farm"); },
        update: async () => { state.farmWrites++; },
      },
      cashPurchase: {
        findUnique: async () => state.previous,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          state.previous = { id: "receipt0001", ...data };
          return state.previous;
        },
      },
    }),
  },
}));

import { CashPurchaseError, purchaseWithCash } from "@/lib/unity/cash-purchase";

beforeEach(() => {
  state.balance = BigInt(100000);
  state.previous = null;
  state.debits = 0;
  state.farmWrites = 0;
});

describe("Unity Cash purchases", () => {
  it("prices every approved item at exactly 10% below 100 Gold per Cash", () => {
    expect(cashPriceMilli("ITEM", "seed_potato", 1)).toBe(288);
    expect(cashPriceMilli("ITEM", "item_chest_iron", 1)).toBe(2250);
    expect(cashPriceMilli("PLOT", "4", 1)).toBe(37800);
    expect(cashPriceMilli("PLOT", "5", 1)).toBe(108000);
    expect(cashPriceMilli("ITEM", "seed_tomato", 1)).toBeNull();
    expect(cashPriceMilli("ITEM", "toString", 1)).toBeNull();
  });

  it("debits once, returns a receipt and replays the same receipt without charging again", async () => {
    const input = { playerId: "farmer", requestId: "a".repeat(20), kind: "ITEM" as const,
      targetId: "seed_potato", quantity: 2 };
    const first = await purchaseWithCash(input);
    const replay = await purchaseWithCash(input);
    expect(first).toMatchObject({ ok: true, receiptId: "receipt0001", playerId: "farmer", kind: "ITEM",
      targetId: "seed_potato", quantity: 2, costMilli: 576, balanceMilliCash: 100000 - 576, replayed: false });
    expect(first).not.toHaveProperty("farm");
    expect(replay).toMatchObject({ receiptId: "receipt0001", replayed: true, costMilli: 576 });
    expect(state.debits).toBe(1);
    expect(state.farmWrites).toBe(0);
    await expect(purchaseWithCash({ ...input, quantity: 3 }))
      .rejects.toMatchObject({ code: "REQUEST_CONFLICT" } satisfies Partial<CashPurchaseError>);
  });

  it("rejects insufficient balance without a debit or receipt", async () => {
    state.balance = BigInt(100);
    await expect(purchaseWithCash({ playerId: "farmer", requestId: "b".repeat(20),
      kind: "ITEM", targetId: "seed_potato", quantity: 1 }))
      .rejects.toMatchObject({ code: "INSUFFICIENT_CASH" });
    expect(state.debits).toBe(0);
    expect(state.previous).toBeNull();
  });
});
