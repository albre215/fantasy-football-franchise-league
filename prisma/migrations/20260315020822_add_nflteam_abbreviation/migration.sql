/*
  Warnings:

  - You are about to drop the column `city` on the `NFLTeam` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `NFLTeam` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[abbreviation]` on the table `NFLTeam` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `abbreviation` to the `NFLTeam` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "NFLTeam_code_key";

-- AlterTable
ALTER TABLE "NFLTeam" DROP COLUMN "city",
DROP COLUMN "code",
ADD COLUMN     "abbreviation" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "NFLTeam_abbreviation_key" ON "NFLTeam"("abbreviation");
