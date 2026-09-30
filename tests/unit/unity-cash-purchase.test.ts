import { beforeEach, describe, expect, it, vi } from "vitest";
import { cashPriceMilli } from "@/lib/unity/cash-catalog";

const state = vi.hoisted(() => ({
  balance: BigInt(100000),
  snapshot: null as unknown,
  previous: null as unknown,
  debits: 0,
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
        findUnique: async () => ({ unitySnapshot: state.snapshot }),
        update: async ({ data }: { data: { unitySnapshot: unknown } }) => { state.snapshot = data.unitySnapshot; },
      },
      cashPurchase: {
        findUnique: async () => state.previous,
        create: async ({ data }: { data: unknown }) => { state.previous = data; },
      },
    }),
  },
}));

import { CashPurchaseError, purchaseWithCash } from "@/lib/unity/cash-purchase";

const farm = {
  Profile: { PlayerId: "farmer", UnlockedRowCount: 2, UnlockedPlotIds: [1], LastSaveTimestamp: 1 },
  Inventory: [],
} as Parameters<typeof purchaseWithCash>[0]["farm"];

beforeEach(() => {
  state.balance = BigInt(100000);
  state.snapshot = null;
  state.previous = null;
  state.debits = 0;
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

  it("debits once and replays a repeated request without granting twice", async () => {
    const input = { playerId: "farmer", requestId: "a".repeat(20), kind: "ITEM" as const,
      targetId: "seed_potato", quantity: 2, farm };
    const first = await purchaseWithCash(input);
    const replay = await purchaseWithCash(input);
    expect(first.balanceMilliCash).toBe(100000 - 576);
    expect(first.farm).toMatchObject({ Inventory: [{ SlotIndex: 0, ItemId: "seed_potato", Quantity: 2 }] });
    expect(replay.replayed).toBe(true);
    expect(state.debits).toBe(1);
    await expect(purchaseWithCash({ ...input, quantity: 3 }))
      .rejects.toMatchObject({ code: "REQUEST_CONFLICT" } satisfies Partial<CashPurchaseError>);
  });

  it("rejects insufficient balance before changing a farm", async () => {
    state.balance = BigInt(100);
    await expect(purchaseWithCash({ playerId: "farmer", requestId: "b".repeat(20),
      kind: "ITEM", targetId: "seed_potato", quantity: 1, farm }))
      .rejects.toMatchObject({ code: "INSUFFICIENT_CASH" });
    expect(state.debits).toBe(0);
    expect(state.snapshot).toBeNull();
  });
});
