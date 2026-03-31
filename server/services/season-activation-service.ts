import { NflPerformanceServiceError, nflPerformanceService } from "@/server/services/nfl-performance-service";
import { seasonService } from "@/server/services/season-service";
import type { SetActiveSeasonInput, SetActiveSeasonResponse } from "@/types/season";

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
      const message =
        error instanceof NflPerformanceServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to import NFL results automatically.";

      return {
        season,
        nflImport: {
          attempted: true,
          status: "FAILED",
          message
        }
      };
    }
  }
};
