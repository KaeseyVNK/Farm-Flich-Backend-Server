-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "linkedEmailAt" TIMESTAMP(3),
    "gold" INTEGER NOT NULL DEFAULT 500,
    "defenseXp" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "migratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "terrain" JSONB NOT NULL,
    "crops" JSONB NOT NULL DEFAULT '{}',
    "objects" JSONB NOT NULL DEFAULT '{}',
    "forage" JSONB NOT NULL DEFAULT '{}',
    "shippingBoxes" JSONB NOT NULL DEFAULT '{}',
    "gameMeta" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "shieldUntil" TIMESTAMP(3),
    "dailyRaidCount" INTEGER NOT NULL DEFAULT 0,
    "dailyRaidResetAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maskId" TEXT NOT NULL,
    "durability" INTEGER NOT NULL DEFAULT 10,
    "equipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Mask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefenseConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefenseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidSession" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "thiefId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'lobby',
    "resultJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidLossDaily" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "RaidLossDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Farm_ownerId_key" ON "Farm"("ownerId");

-- CreateIndex
CREATE INDEX "Farm_ownerId_idx" ON "Farm"("ownerId");

-- CreateIndex
CREATE INDEX "Inventory_userId_idx" ON "Inventory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_userId_itemId_key" ON "Inventory"("userId", "itemId");

-- CreateIndex
CREATE INDEX "Mask_userId_idx" ON "Mask"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Mask_userId_maskId_key" ON "Mask"("userId", "maskId");

-- CreateIndex
CREATE INDEX "DefenseConfig_userId_idx" ON "DefenseConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DefenseConfig_userId_slot_key" ON "DefenseConfig"("userId", "slot");

-- CreateIndex
CREATE INDEX "RaidSession_farmId_idx" ON "RaidSession"("farmId");

-- CreateIndex
CREATE INDEX "RaidSession_ownerId_idx" ON "RaidSession"("ownerId");

-- CreateIndex
CREATE INDEX "RaidSession_thiefId_idx" ON "RaidSession"("thiefId");

-- CreateIndex
CREATE INDEX "RaidSession_status_idx" ON "RaidSession"("status");

-- CreateIndex
CREATE INDEX "RaidEvent_sessionId_idx" ON "RaidEvent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "RaidEvent_sessionId_tick_seq_key" ON "RaidEvent"("sessionId", "tick", "seq");

-- CreateIndex
CREATE INDEX "RaidLossDaily_ownerId_date_idx" ON "RaidLossDaily"("ownerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RaidLossDaily_ownerId_date_category_key" ON "RaidLossDaily"("ownerId", "date", "category");

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mask" ADD CONSTRAINT "Mask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefenseConfig" ADD CONSTRAINT "DefenseConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidSession" ADD CONSTRAINT "RaidSession_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidSession" ADD CONSTRAINT "RaidSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidSession" ADD CONSTRAINT "RaidSession_thiefId_fkey" FOREIGN KEY ("thiefId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEvent" ADD CONSTRAINT "RaidEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RaidSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidLossDaily" ADD CONSTRAINT "RaidLossDaily_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: 1 RaidSession active per farm (audit M1 — Prisma không sinh được)
-- Chặn 2 raider join đồng thời 1 farm (red-team #16 atomic join gate).
CREATE UNIQUE INDEX "RaidSession_single_active_per_farm" ON "RaidSession" ("farmId") WHERE status = 'active';
