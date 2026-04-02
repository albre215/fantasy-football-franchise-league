-- Add a nullable unique concurrency key so only one RUNNING import can claim a season at a time.
ALTER TABLE "SeasonNflImportRun"
ADD COLUMN "concurrencyKey" TEXT;

CREATE UNIQUE INDEX "SeasonNflImportRun_concurrencyKey_key"
ON "SeasonNflImportRun"("concurrencyKey");
