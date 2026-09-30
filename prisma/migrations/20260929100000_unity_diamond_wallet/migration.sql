ALTER TABLE "User" ADD COLUMN "cashMilli" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD CONSTRAINT "User_cashMilli_nonnegative" CHECK ("cashMilli" >= 0);

-- The bridge uses the Prisma server role. A player must never PATCH this balance.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE UPDATE ("cashMilli") ON TABLE "User" FROM authenticated;
  END IF;
END $$;

CREATE TABLE "CashPurchase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "requestId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "costMilli" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashPurchase_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "CashPurchase_cost_positive" CHECK ("costMilli" > 0)
);
CREATE UNIQUE INDEX "CashPurchase_userId_requestId_key" ON "CashPurchase"("userId", "requestId");
CREATE INDEX "CashPurchase_userId_idx" ON "CashPurchase"("userId");
