import { NflPerformanceServiceError, nflPerformanceService } from "@/server/services/nfl-performance-service";
import { seasonService } from "@/server/services/season-service";
import type {
  SetActiveSeasonInput,
  SetActiveSeasonResponse,
  UpdateSeasonYearInput,
  UpdateSeasonYearResponse
} from "@/types/season";

function mapNflImportMessage(error: unknown) {
  return error instanceof NflPerformanceServiceError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Unable to import NFL results automatically.";
}

export const seasonActivationService = {
  async setActiveSeasonAndSyncNflResults(input: SetActiveSeasonInput): Promise<SetActiveSeasonResponse> {
    const season = await seasonService.setActiveSeason(input);

    try {
      await nflPerformanceService.importSeasonNflResults({
        seasonId: season.id,
        actingUserId: input.actingUserId
      });

      return {
        season,
        nflImport: {
          attempted: true,
          status: "COMPLETED",
          message: `Imported available NFL results for the ${season.year} season automatically.`
        }
      };
    } catch (error) {
      return {
        season,
        nflImport: {
          attempted: true,
          status: "FAILED",
          message: mapNflImportMessage(error)
        }
      };
    }
  },

  async updateSeasonYearAndSyncNflResults(input: UpdateSeasonYearInput): Promise<UpdateSeasonYearResponse> {
    const season = await seasonService.updateSeasonYear(input);

    if (season.status !== "ACTIVE") {
      return {
        season,
        nflImport: null
      };
    }

    try {
      await nflPerformanceService.importSeasonNflResults({
        seasonId: season.id,
        actingUserId: input.actingUserId
      });

      return {
        season,
        nflImport: {
          attempted: true,
          status: "COMPLETED",
          message: `Re-imported available NFL results for the ${season.year} season automatically.`
        }
      };
    } catch (error) {
      return {
        season,
        nflImport: {
          attempted: true,
          status: "FAILED",
          message: mapNflImportMessage(error)
        }
      };
    }
  }
};
