CREATE TYPE "LeaguePhase" AS ENUM ('IN_SEASON', 'POST_SEASON', 'DROP_PHASE', 'DRAFT_PHASE');

ALTER TABLE "Season"
ADD COLUMN "leaguePhase" "LeaguePhase" NOT NULL DEFAULT 'IN_SEASON';

UPDATE "Season"
SET "leaguePhase" = 'IN_SEASON'
WHERE "status" = 'ACTIVE';

UPDATE "Season"
SET "leaguePhase" = 'DRAFT_PHASE'
WHERE "status" = 'PLANNING';

UPDATE "Season"
SET "leaguePhase" = 'POST_SEASON'
WHERE "status" IN ('COMPLETED', 'ARCHIVED');
