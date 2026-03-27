import { prisma } from "@/lib/prisma";
import type { SeasonResultsSummary } from "@/types/results";

class ResultsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ResultsServiceError";
  }
}

function mapRun(run: {
  id: string;
  provider: "ESPN" | "SLEEPER" | "CSV";
  importType: "SEASON_STANDINGS" | "WEEKLY_STANDINGS";
  status: "RUNNING" | "COMPLETED" | "FAILED";
  weekNumber: number | null;
  actingUserId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  warnings: unknown;
  errorMessage: string | null;
  sourceSummary: unknown;
}): SeasonResultsSummary["importRuns"][number] {
  return {
    id: run.id,
    provider: run.provider,
    importType: run.importType,
    status: run.status,
    weekNumber: run.weekNumber,
    actingUserId: run.actingUserId,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    warnings: Array.isArray(run.warnings) ? (run.warnings as string[]) : [],
    errorMessage: run.errorMessage,
    sourceSummary: run.sourceSummary ? (run.sourceSummary as SeasonResultsSummary["importRuns"][number]["sourceSummary"]) : null
  };
}

export const resultsService = {
  async getSeasonResults(seasonId: string): Promise<SeasonResultsSummary> {
    const normalizedSeasonId = seasonId.trim();

    if (!normalizedSeasonId) {
      throw new ResultsServiceError("seasonId is required.", 400);
    }

    const season = await prisma.season.findUnique({
      where: {
        id: normalizedSeasonId
      },
      include: {
        league: {
          include: {
            members: {
              include: {
                user: true
              },
              orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
            }
          }
        },
        sourceConfigs: true,
        seasonStandings: {
          include: {
            leagueMember: {
              include: {
                user: true
              }
            }
          },
          orderBy: [{ rank: "asc" }, { leagueMember: { joinedAt: "asc" } }]
        },
        weeklyStandings: {
          include: {
            leagueMember: {
              include: {
                user: true
              }
            }
          },
          orderBy: [{ weekNumber: "desc" }, { rank: "asc" }]
        },
        ingestionRuns: {
          orderBy: {
            startedAt: "desc"
          },
          take: 10
        }
      }
    });

    if (!season) {
      throw new ResultsServiceError("Season not found.", 404);
    }

    return {
      season: {
        id: season.id,
        leagueId: season.leagueId,
        year: season.year,
        name: season.name,
        status: season.status
      },
      availability: {
        hasSeasonStandings: season.seasonStandings.length > 0,
        hasWeeklyStandings: season.weeklyStandings.length > 0,
        hasChampionData: season.seasonStandings.some((standing) => standing.isChampion === true),
        hasPlayoffData: season.seasonStandings.some((standing) => Boolean(standing.playoffFinish)),
        isReadyForDraftOrderAutomation:
          season.seasonStandings.length === season.league.members.length &&
          season.seasonStandings.every((standing) => standing.rank !== null)
      },
      sourceConfigs: season.sourceConfigs.map((config) => ({
        id: config.id,
        seasonId: config.seasonId,
        provider: config.provider,
        externalLeagueId: config.externalLeagueId,
        externalSeasonKey: config.externalSeasonKey,
        config: (config.config as Record<string, string | number | boolean | null>) ?? {},
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString()
      })),
      seasonStandings: season.seasonStandings.map((standing) => ({
        leagueMemberId: standing.leagueMemberId,
        userId: standing.leagueMember.userId,
        displayName: standing.leagueMember.user.displayName,
        email: standing.leagueMember.user.email,
        role: standing.leagueMember.role,
        provider: standing.provider,
        rank: standing.rank,
        wins: standing.wins,
        losses: standing.losses,
        ties: standing.ties,
        pointsFor: standing.pointsFor,
        pointsAgainst: standing.pointsAgainst,
        playoffFinish: standing.playoffFinish,
        isChampion: standing.isChampion,
        sourceRunId: standing.ingestionRunId,
        externalDisplayName: standing.externalDisplayName
      })),
      weeklyStandings: season.weeklyStandings.map((standing) => ({
        weekNumber: standing.weekNumber,
        leagueMemberId: standing.leagueMemberId,
        userId: standing.leagueMember.userId,
        displayName: standing.leagueMember.user.displayName,
        provider: standing.provider,
        rank: standing.rank,
        pointsFor: standing.pointsFor,
        pointsAgainst: standing.pointsAgainst,
        result: standing.result,
        opponentDisplayName: standing.opponentDisplayName,
        sourceRunId: standing.ingestionRunId
      })),
      importRuns: season.ingestionRuns.map(mapRun)
    };
  }
};

export { ResultsServiceError };
