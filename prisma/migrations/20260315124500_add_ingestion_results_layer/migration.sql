-- CreateEnum
CREATE TYPE "IngestionProvider" AS ENUM ('ESPN', 'SLEEPER', 'CSV');

-- CreateEnum
CREATE TYPE "IngestionImportType" AS ENUM ('SEASON_STANDINGS', 'WEEKLY_STANDINGS');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "SeasonSourceConfig" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "provider" "IngestionProvider" NOT NULL,
    "externalLeagueId" TEXT,
    "externalSeasonKey" TEXT,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonSourceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonMemberSourceMapping" (
    "id" TEXT NOT NULL,
    "seasonSourceConfigId" TEXT NOT NULL,
    "leagueMemberId" TEXT NOT NULL,
    "externalEntityId" TEXT NOT NULL,
    "externalDisplayName" TEXT NOT NULL,
    "confidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonMemberSourceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonSourceConfigId" TEXT,
    "provider" "IngestionProvider" NOT NULL,
    "importType" "IngestionImportType" NOT NULL,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "weekNumber" INTEGER,
    "actingUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "sourceSummary" JSONB,
    "warnings" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonStanding" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "leagueMemberId" TEXT NOT NULL,
    "provider" "IngestionProvider" NOT NULL,
    "seasonSourceConfigId" TEXT,
    "ingestionRunId" TEXT,
    "externalEntityId" TEXT,
    "externalDisplayName" TEXT,
    "rank" INTEGER,
    "wins" INTEGER,
    "losses" INTEGER,
    "ties" INTEGER,
    "pointsFor" DOUBLE PRECISION,
    "pointsAgainst" DOUBLE PRECISION,
    "playoffFinish" TEXT,
    "isChampion" BOOLEAN,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyStanding" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "leagueMemberId" TEXT NOT NULL,
    "provider" "IngestionProvider" NOT NULL,
    "seasonSourceConfigId" TEXT,
    "ingestionRunId" TEXT,
    "externalEntityId" TEXT,
    "externalDisplayName" TEXT,
    "rank" INTEGER,
    "pointsFor" DOUBLE PRECISION,
    "pointsAgainst" DOUBLE PRECISION,
    "result" TEXT,
    "opponentExternalEntityId" TEXT,
    "opponentDisplayName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyStanding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonSourceConfig_seasonId_provider_key" ON "SeasonSourceConfig"("seasonId", "provider");

-- CreateIndex
CREATE INDEX "SeasonSourceConfig_seasonId_idx" ON "SeasonSourceConfig"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonMemberSourceMapping_seasonSourceConfigId_leagueMemberId_key" ON "SeasonMemberSourceMapping"("seasonSourceConfigId", "leagueMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonMemberSourceMapping_seasonSourceConfigId_externalEntityId_key" ON "SeasonMemberSourceMapping"("seasonSourceConfigId", "externalEntityId");

-- CreateIndex
CREATE INDEX "SeasonMemberSourceMapping_leagueMemberId_idx" ON "SeasonMemberSourceMapping"("leagueMemberId");

-- CreateIndex
CREATE INDEX "IngestionRun_seasonId_provider_importType_idx" ON "IngestionRun"("seasonId", "provider", "importType");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonStanding_seasonId_leagueMemberId_key" ON "SeasonStanding"("seasonId", "leagueMemberId");

-- CreateIndex
CREATE INDEX "SeasonStanding_seasonId_rank_idx" ON "SeasonStanding"("seasonId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyStanding_seasonId_weekNumber_leagueMemberId_key" ON "WeeklyStanding"("seasonId", "weekNumber", "leagueMemberId");

-- CreateIndex
CREATE INDEX "WeeklyStanding_seasonId_weekNumber_rank_idx" ON "WeeklyStanding"("seasonId", "weekNumber", "rank");

-- AddForeignKey
ALTER TABLE "SeasonSourceConfig" ADD CONSTRAINT "SeasonSourceConfig_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMemberSourceMapping" ADD CONSTRAINT "SeasonMemberSourceMapping_seasonSourceConfigId_fkey" FOREIGN KEY ("seasonSourceConfigId") REFERENCES "SeasonSourceConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMemberSourceMapping" ADD CONSTRAINT "SeasonMemberSourceMapping_leagueMemberId_fkey" FOREIGN KEY ("leagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_seasonSourceConfigId_fkey" FOREIGN KEY ("seasonSourceConfigId") REFERENCES "SeasonSourceConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonStanding" ADD CONSTRAINT "SeasonStanding_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonStanding" ADD CONSTRAINT "SeasonStanding_leagueMemberId_fkey" FOREIGN KEY ("leagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonStanding" ADD CONSTRAINT "SeasonStanding_seasonSourceConfigId_fkey" FOREIGN KEY ("seasonSourceConfigId") REFERENCES "SeasonSourceConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonStanding" ADD CONSTRAINT "SeasonStanding_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "IngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyStanding" ADD CONSTRAINT "WeeklyStanding_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyStanding" ADD CONSTRAINT "WeeklyStanding_leagueMemberId_fkey" FOREIGN KEY ("leagueMemberId") REFERENCES "LeagueMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyStanding" ADD CONSTRAINT "WeeklyStanding_seasonSourceConfigId_fkey" FOREIGN KEY ("seasonSourceConfigId") REFERENCES "SeasonSourceConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyStanding" ADD CONSTRAINT "WeeklyStanding_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "IngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
