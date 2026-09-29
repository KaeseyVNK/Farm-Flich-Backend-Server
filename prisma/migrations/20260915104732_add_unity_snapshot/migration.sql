/*
  Warnings:

  - You are about to drop the `RateWindow` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Bounty" DROP CONSTRAINT "Bounty_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Bounty" DROP CONSTRAINT "Bounty_thiefId_fkey";

-- DropForeignKey
ALTER TABLE "Reputation" DROP CONSTRAINT "Reputation_userId_fkey";

-- DropIndex
DROP INDEX "VillageChat_createdAt_idx";

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "unitySnapshot" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FarmLike" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Friendship" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GiftLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Reputation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserProgression" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserStoryFlags" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VisitLog" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "RateWindow";

-- CreateIndex
CREATE INDEX "VillageChat_createdAt_idx" ON "VillageChat"("createdAt");

-- AddForeignKey
ALTER TABLE "Bounty" ADD CONSTRAINT "Bounty_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bounty" ADD CONSTRAINT "Bounty_thiefId_fkey" FOREIGN KEY ("thiefId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
