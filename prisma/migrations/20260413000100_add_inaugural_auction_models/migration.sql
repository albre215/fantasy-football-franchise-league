CREATE TYPE "SeasonDraftMode" AS ENUM ('CONTINUING_REPLACEMENT', 'INAUGURAL_AUCTION');

CREATE TYPE "InauguralAuctionOrderMethod" AS ENUM ('ALPHABETICAL', 'DIVISION', 'PREVIOUS_YEAR_RECORD');

ALTER TABLE "Season"
ADD COLUMN "draftMode" "SeasonDraftMode" NOT NULL DEFAULT 'CONTINUING_REPLACEMENT';

CREATE TABLE "InauguralAuction" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PLANNING',
    "orderMethod" "InauguralAuctionOrderMethod" NOT NULL,
    "currentNominationIndex" INTEGER NOT NULL DEFAULT 0,
    "clockStartedAt" TIMESTAMP(3),
    "clockExpiresAt" TIMESTAMP(3),
    "announcementAwardId" TEXT,
    "announcementEndsAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InauguralAuction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InauguralAuctionNomination" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "nflTeamId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InauguralAuctionNomination_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InauguralAuctionBid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "nominationId" TEXT NOT NULL,
    "leagueMemberId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InauguralAuctionBid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InauguralAuctionAward" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "nominationId" TEXT NOT NULL,
    "leagueMemberId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InauguralAuctionAward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InauguralAuction_seasonId_key" ON "InauguralAuction"("seasonId");
CREATE INDEX "InauguralAuction_leagueId_status_idx" ON "InauguralAuction"("leagueId", "status");

CREATE UNIQUE INDEX "InauguralAuctionNomination_auctionId_orderIndex_key" ON "InauguralAuctionNomination"("auctionId", "orderIndex");
CREATE UNIQUE INDEX "InauguralAuctionNomination_auctionId_nflTeamId_key" ON "InauguralAuctionNomination"("auctionId", "nflTeamId");
CREATE INDEX "InauguralAuctionNomination_nflTeamId_idx" ON "InauguralAuctionNomination"("nflTeamId");

CREATE INDEX "InauguralAuctionBid_auctionId_nominationId_amount_idx" ON "InauguralAuctionBid"("auctionId", "nominationId", "amount");
CREATE INDEX "InauguralAuctionBid_leagueMemberId_idx" ON "InauguralAuctionBid"("leagueMemberId");

CREATE UNIQUE INDEX "InauguralAuctionAward_nominationId_key" ON "InauguralAuctionAward"("nominationId");
CREATE INDEX "InauguralAuctionAward_auctionId_awardedAt_idx" ON "InauguralAuctionAward"("auctionId", "awardedAt");
CREATE INDEX "InauguralAuctionAward_leagueMemberId_idx" ON "InauguralAuctionAward"("leagueMemberId");

ALTER TABLE "InauguralAuction" ADD CONSTRAINT "InauguralAuction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InauguralAuction" ADD CONSTRAINT "InauguralAuction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InauguralAuctionNomination" ADD CONSTRAINT "InauguralAuctionNomination_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "InauguralAuction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InauguralAuctionNomination" ADD CONSTRAINT "InauguralAuctionNomination_nflTeamId_fkey" FOREIGN KEY ("nflTeamId") REFERENCES "NFLTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InauguralAuctionBid" ADD CONSTRAINT "InauguralAuctionBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "InauguralAuction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InauguralAuctionBid" ADD CONSTRAINT "InauguralAuctionBid_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "InauguralAuctionNomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InauguralAuctionBid" ADD CONSTRAINT "InauguralAuctionBid_leagueMemberId_fkey" FOREIGN KEY ("leagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InauguralAuctionAward" ADD CONSTRAINT "InauguralAuctionAward_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "InauguralAuction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InauguralAuctionAward" ADD CONSTRAINT "InauguralAuctionAward_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "InauguralAuctionNomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InauguralAuctionAward" ADD CONSTRAINT "InauguralAuctionAward_leagueMemberId_fkey" FOREIGN KEY ("leagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
