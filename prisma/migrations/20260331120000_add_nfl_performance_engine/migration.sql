-- CreateEnum
CREATE TYPE "NflResultProvider" AS ENUM ('MANUAL', 'NFLVERSE');

-- CreateEnum
CREATE TYPE "NflImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NflImportMode" AS ENUM ('FULL_SEASON', 'SINGLE_WEEK');

-- CreateEnum
CREATE TYPE "SeasonNflResultPhase" AS ENUM ('REGULAR_SEASON', 'WILD_CARD', 'DIVISIONAL', 'CONFERENCE', 'SUPER_BOWL');

-- CreateEnum
CREATE TYPE "SeasonNflGameResult" AS ENUM ('WIN', 'LOSS', 'TIE');

-- CreateTable
CREATE TABLE "SeasonNflImportRun" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "provider" "NflResultProvider" NOT NULL,
    "mode" "NflImportMode" NOT NULL,
    "weekNumber" INTEGER,
    "status" "NflImportStatus" NOT NULL DEFAULT 'RUNNING',
    "actingUserId" TEXT,
    "importedResultCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonNflImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonNflTeamResult" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "phase" "SeasonNflResultPhase" NOT NULL,
    "nflTeamId" TEXT NOT NULL,
    "opponentNflTeamId" TEXT,
    "leagueMemberId" TEXT,
    "result" "SeasonNflGameResult" NOT NULL,
    "pointsFor" INTEGER,
    "pointsAgainst" INTEGER,
    "sourceProvider" "NflResultProvider" NOT NULL,
    "importRunId" TEXT,
    "actingUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonNflTeamResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeasonNflImportRun_seasonId_startedAt_idx" ON "SeasonNflImportRun"("seasonId", "startedAt");

-- CreateIndex
CREATE INDEX "SeasonNflImportRun_seasonId_provider_mode_weekNumber_idx" ON "SeasonNflImportRun"("seasonId", "provider", "mode", "weekNumber");

-- CreateIndex
CREATE INDEX "SeasonNflTeamResult_seasonId_weekNumber_idx" ON "SeasonNflTeamResult"("seasonId", "weekNumber");

-- CreateIndex
CREATE INDEX "SeasonNflTeamResult_seasonId_leagueMemberId_idx" ON "SeasonNflTeamResult"("seasonId", "leagueMemberId");

-- CreateIndex
CREATE INDEX "SeasonNflTeamResult_seasonId_phase_idx" ON "SeasonNflTeamResult"("seasonId", "phase");

-- CreateIndex
CREATE INDEX "SeasonNflTeamResult_seasonId_nflTeamId_idx" ON "SeasonNflTeamResult"("seasonId", "nflTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonNflTeamResult_seasonId_weekNumber_phase_nflTeamId_key" ON "SeasonNflTeamResult"("seasonId", "weekNumber", "phase", "nflTeamId");

-- AddForeignKey
ALTER TABLE "SeasonNflImportRun" ADD CONSTRAINT "SeasonNflImportRun_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonNflTeamResult" ADD CONSTRAINT "SeasonNflTeamResult_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonNflTeamResult" ADD CONSTRAINT "SeasonNflTeamResult_nflTeamId_fkey" FOREIGN KEY ("nflTeamId") REFERENCES "NFLTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonNflTeamResult" ADD CONSTRAINT "SeasonNflTeamResult_opponentNflTeamId_fkey" FOREIGN KEY ("opponentNflTeamId") REFERENCES "NFLTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonNflTeamResult" ADD CONSTRAINT "SeasonNflTeamResult_leagueMemberId_fkey" FOREIGN KEY ("leagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonNflTeamResult" ADD CONSTRAINT "SeasonNflTeamResult_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "SeasonNflImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
