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

function startSeasonNflImportInBackground(seasonId: string, actingUserId: string) {
  void nflPerformanceService
    .importSeasonNflResults({
      seasonId,
      actingUserId
    })
    .catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Background NFL import failed:", mapNflImportMessage(error));
      }
    });
}

export const seasonActivationService = {
  async setActiveSeasonAndSyncNflResults(input: SetActiveSeasonInput): Promise<SetActiveSeasonResponse> {
    const season = await seasonService.setActiveSeason(input);
    startSeasonNflImportInBackground(season.id, input.actingUserId);

    return {
      season,
      nflImport: {
        attempted: true,
        status: "PENDING",
        message: `Automatic NFL import started for the ${season.year} season.`
      }
    };
  },

  async updateSeasonYearAndSyncNflResults(input: UpdateSeasonYearInput): Promise<UpdateSeasonYearResponse> {
    const season = await seasonService.updateSeasonYear(input);

    if (season.status !== "ACTIVE") {
      return {
        season,
        nflImport: null
      };
    }

    startSeasonNflImportInBackground(season.id, input.actingUserId);

    return {
      season,
      nflImport: {
        attempted: true,
        status: "PENDING",
        message: `Automatic NFL re-import started for the ${season.year} season.`
      }
    };
  }
};
