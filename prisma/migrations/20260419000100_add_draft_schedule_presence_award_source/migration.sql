-- CreateEnum
CREATE TYPE "DraftType" AS ENUM ('INAUGURAL', 'KEEPER', 'OFFSEASON');

-- CreateEnum
CREATE TYPE "AuctionAwardSource" AS ENUM ('BID', 'AUTO_ASSIGN', 'SIMULATED', 'FINAL_SELECTION');

-- AlterTable
ALTER TABLE "InauguralAuctionAward" ADD COLUMN "source" "AuctionAwardSource" NOT NULL DEFAULT 'BID';

-- CreateTable
CREATE TABLE "DraftSchedule" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "draftType" "DraftType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InauguralAuctionPresence" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "leagueMemberId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InauguralAuctionPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DraftSchedule_seasonId_key" ON "DraftSchedule"("seasonId");

-- CreateIndex
CREATE INDEX "DraftSchedule_scheduledAt_idx" ON "DraftSchedule"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "InauguralAuctionPresence_auctionId_leagueMemberId_key" ON "InauguralAuctionPresence"("auctionId", "leagueMemberId");

-- CreateIndex
CREATE INDEX "InauguralAuctionPresence_leagueMemberId_idx" ON "InauguralAuctionPresence"("leagueMemberId");

-- AddForeignKey
ALTER TABLE "DraftSchedule" ADD CONSTRAINT "DraftSchedule_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InauguralAuctionPresence" ADD CONSTRAINT "InauguralAuctionPresence_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "InauguralAuction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InauguralAuctionPresence" ADD CONSTRAINT "InauguralAuctionPresence_leagueMemberId_fkey" FOREIGN KEY ("leagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
