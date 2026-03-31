-- CreateEnum
CREATE TYPE "LedgerEntryCategory" AS ENUM (
  'MANUAL_ADJUSTMENT',
  'FANTASY_PAYOUT',
  'NFL_REGULAR_SEASON',
  'NFL_PLAYOFF',
  'UNUSED_TEAM_ALLOCATION'
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "leagueMemberId" TEXT NOT NULL,
  "category" "LedgerEntryCategory" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "actingUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_leagueId_createdAt_idx" ON "LedgerEntry"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_seasonId_createdAt_idx" ON "LedgerEntry"("seasonId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_seasonId_leagueMemberId_createdAt_idx" ON "LedgerEntry"("seasonId", "leagueMemberId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_seasonId_category_idx" ON "LedgerEntry"("seasonId", "category");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_leagueMemberId_fkey" FOREIGN KEY ("leagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
