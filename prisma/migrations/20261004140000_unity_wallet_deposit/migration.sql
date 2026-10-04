CREATE TABLE "UnityWallet" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "address" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "UnityWallet_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "UnityWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UnityWallet_userId_key" ON "UnityWallet"("userId");
CREATE UNIQUE INDEX "UnityWallet_address_key" ON "UnityWallet"("address");
CREATE TABLE "CashDeposit" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "network" TEXT NOT NULL,
 "signature" TEXT NOT NULL, "walletAddress" TEXT NOT NULL,
 "amountRaw" BIGINT NOT NULL, "creditedMilli" BIGINT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CashDeposit_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CashDeposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CashDeposit_network_signature_key" ON "CashDeposit"("network", "signature");
CREATE INDEX "CashDeposit_userId_idx" ON "CashDeposit"("userId");
ALTER TABLE "UnityWallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashDeposit" ENABLE ROW LEVEL SECURITY;
