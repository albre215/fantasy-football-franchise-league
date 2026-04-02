CREATE TYPE "LeaguePhase" AS ENUM ('IN_SEASON', 'POST_SEASON', 'DROP_PHASE', 'DRAFT_PHASE');

ALTER TABLE "Season"
ADD COLUMN "leaguePhase" "LeaguePhase" NOT NULL DEFAULT 'IN_SEASON';

UPDATE "Season"
SET "leaguePhase" = CASE
  WHEN "status" = 'ACTIVE' THEN 'IN_SEASON'::"LeaguePhase"
  WHEN "status" = 'PLANNING' THEN 'DRAFT_PHASE'::"LeaguePhase"
  ELSE 'POST_SEASON'::"LeaguePhase"
END;
