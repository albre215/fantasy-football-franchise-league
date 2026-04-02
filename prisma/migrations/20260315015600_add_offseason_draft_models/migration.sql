CREATE TYPE "DraftStatus" AS ENUM ('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "targetSeasonId" TEXT NOT NULL,
    "sourceSeasonId" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PLANNING',
    "currentPick" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DraftPick" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "overallPickNumber" INTEGER NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "roundPickNumber" INTEGER NOT NULL,
    "selectingLeagueMemberId" TEXT NOT NULL,
    "selectedNflTeamId" TEXT,
    "actingUserId" TEXT,
    "pickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KeeperSelection" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "leagueMemberId" TEXT NOT NULL,
    "nflTeamId" TEXT NOT NULL,
    "sourceSeasonId" TEXT NOT NULL,
    "actingUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeeperSelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Draft_targetSeasonId_key" ON "Draft"("targetSeasonId");
CREATE INDEX "Draft_leagueId_status_idx" ON "Draft"("leagueId", "status");

CREATE UNIQUE INDEX "DraftPick_draftId_overallPickNumber_key" ON "DraftPick"("draftId", "overallPickNumber");
CREATE UNIQUE INDEX "DraftPick_draftId_selectedNflTeamId_key" ON "DraftPick"("draftId", "selectedNflTeamId");
CREATE INDEX "DraftPick_selectingLeagueMemberId_idx" ON "DraftPick"("selectingLeagueMemberId");

CREATE UNIQUE INDEX "KeeperSelection_draftId_leagueMemberId_nflTeamId_key" ON "KeeperSelection"("draftId", "leagueMemberId", "nflTeamId");
CREATE INDEX "KeeperSelection_leagueMemberId_idx" ON "KeeperSelection"("leagueMemberId");
CREATE INDEX "KeeperSelection_nflTeamId_idx" ON "KeeperSelection"("nflTeamId");

ALTER TABLE "Draft"
ADD CONSTRAINT "Draft_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Draft"
ADD CONSTRAINT "Draft_targetSeasonId_fkey" FOREIGN KEY ("targetSeasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Draft"
ADD CONSTRAINT "Draft_sourceSeasonId_fkey" FOREIGN KEY ("sourceSeasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DraftPick"
ADD CONSTRAINT "DraftPick_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DraftPick"
ADD CONSTRAINT "DraftPick_selectingLeagueMemberId_fkey" FOREIGN KEY ("selectingLeagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DraftPick"
ADD CONSTRAINT "DraftPick_selectedNflTeamId_fkey" FOREIGN KEY ("selectedNflTeamId") REFERENCES "NFLTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KeeperSelection"
ADD CONSTRAINT "KeeperSelection_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KeeperSelection"
ADD CONSTRAINT "KeeperSelection_leagueMemberId_fkey" FOREIGN KEY ("leagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KeeperSelection"
ADD CONSTRAINT "KeeperSelection_nflTeamId_fkey" FOREIGN KEY ("nflTeamId") REFERENCES "NFLTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KeeperSelection"
ADD CONSTRAINT "KeeperSelection_sourceSeasonId_fkey" FOREIGN KEY ("sourceSeasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
