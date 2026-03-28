import { prisma } from "@/lib/prisma";
import { seasonService } from "@/server/services/season-service";
import type {
  RecommendedDraftOrderEntry,
  SaveManualSeasonStandingsInput,
  SeasonResultsSummary,
  SeasonResultStanding
} from "@/types/results";

class ResultsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ResultsServiceError";
  }
}

function mapSeasonStanding(standing: {
  leagueMemberId: string;
  provider: "MANUAL" | "ESPN" | "SLEEPER" | "CSV";
  rank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  playoffFinish: string | null;
  isChampion: boolean | null;
  ingestionRunId: string | null;
  externalDisplayName: string | null;
  leagueMember: {
    userId: string;
    role: "COMMISSIONER" | "OWNER";
    user: {
      displayName: string;
      email: string;
    };
  };
}): SeasonResultStanding {
  return {
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
  };
}

async function getSeasonResultsContext(seasonId: string) {
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
      seasonStandings: {
        include: {
          leagueMember: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ rank: "asc" }, { leagueMember: { joinedAt: "asc" } }]
      }
    }
  });

  if (!season) {
    throw new ResultsServiceError("Season not found.", 404);
  }

  return season;
}

function buildResultsSummary(
  season: Awaited<ReturnType<typeof getSeasonResultsContext>>
): SeasonResultsSummary {
  const eligibleMembers = season.league.members.map((member) => ({
    leagueMemberId: member.id,
    userId: member.userId,
    displayName: member.user.displayName,
    email: member.user.email,
    role: member.role
  }));
  const seasonStandings = season.seasonStandings.map(mapSeasonStanding);
  const recommendedReverseDraftOrder = [...seasonStandings]
    .filter((standing) => standing.rank !== null)
    .sort((left, right) => (right.rank ?? 0) - (left.rank ?? 0))
    .map((standing, index) => ({
      leagueMemberId: standing.leagueMemberId,
      userId: standing.userId,
      displayName: standing.displayName,
      email: standing.email,
      role: standing.role
,
      sourceSeasonRank: standing.rank ?? index + 1,
      draftSlot: index + 1
    }));

  return {
    season: {
      id: season.id,
      leagueId: season.leagueId,
      year: season.year,
      name: season.name,
      status: season.status
    },
    availability: {
      hasFinalStandings: seasonStandings.length > 0,
      hasChampionData: seasonStandings.some((standing) => standing.isChampion === true),
      isReadyForDraftOrderAutomation:
        seasonStandings.length === eligibleMembers.length &&
        seasonStandings.every((standing) => standing.rank !== null)
    },
    eligibleMembers,
    seasonStandings,
    recommendedReverseDraftOrder
  };
}

async function getReverseDraftOrderContext(sourceSeasonId: string, targetSeasonId: string) {
  const [sourceSeason, targetSeason] = await Promise.all([
    prisma.season.findUnique({
      where: {
        id: sourceSeasonId
      },
      include: {
        seasonStandings: {
          include: {
            leagueMember: {
              include: {
                user: true
              }
            }
          },
          orderBy: [{ rank: "asc" }, { leagueMember: { joinedAt: "asc" } }]
        }
      }
    }),
    prisma.season.findUnique({
      where: {
        id: targetSeasonId
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
        }
      }
    })
  ]);

  if (!sourceSeason || !targetSeason) {
    throw new ResultsServiceError("Source and target seasons must both exist.", 404);
  }

  if (sourceSeason.leagueId !== targetSeason.leagueId) {
    throw new ResultsServiceError("Source and target seasons must belong to the same league.", 400);
  }

  if (sourceSeason.year !== targetSeason.year - 1) {
    throw new ResultsServiceError(
      "Draft order automation must use the immediately previous season as the source season.",
      400
    );
  }

  if (sourceSeason.seasonStandings.length !== targetSeason.league.members.length) {
    throw new ResultsServiceError(
      "Enter complete final standings for the source season before auto-generating draft order.",
      409
    );
  }

  if (sourceSeason.seasonStandings.some((standing) => standing.rank === null)) {
    throw new ResultsServiceError(
      "Source season final standings must have a rank for every owner before auto-generating draft order.",
      409
    );
  }

  const targetMembersByUserId = new Map(
    targetSeason.league.members.map((member) => [member.userId, member] as const)
  );
  const recommended = [...sourceSeason.seasonStandings]
    .sort((left, right) => (right.rank ?? 0) - (left.rank ?? 0))
    .map((standing, index) => {
      const targetMember = targetMembersByUserId.get(standing.leagueMember.userId);

      if (!targetMember) {
        throw new ResultsServiceError(
          "Every owner in the source season standings must still belong to the target season league.",
          409
        );
      }

      const entry: RecommendedDraftOrderEntry = {
        leagueMemberId: targetMember.id,
        userId: targetMember.userId,
        displayName: targetMember.user.displayName,
        email: targetMember.user.email,
        role: targetMember.role,
        sourceSeasonRank: standing.rank ?? index + 1,
        draftSlot: index + 1
      };

      return entry;
    });

  if (new Set(recommended.map((entry) => entry.leagueMemberId)).size !== targetSeason.league.members.length) {
    throw new ResultsServiceError("Auto-generated draft order must contain all 10 owners exactly once.", 409);
  }

  return {
    sourceSeason,
    targetSeason,
    recommended
  };
}

function validateOrderedStandings(
  eligibleLeagueMemberIds: string[],
  orderedLeagueMemberIds: string[]
) {
  if (orderedLeagueMemberIds.length !== 10) {
    throw new ResultsServiceError("Final standings must include exactly 10 placements.", 400);
  }

  if (eligibleLeagueMemberIds.length !== 10) {
    throw new ResultsServiceError("Final standings can only be recorded once the league has exactly 10 members.", 409);
  }

  if (orderedLeagueMemberIds.some((leagueMemberId) => !leagueMemberId.trim())) {
    throw new ResultsServiceError("Every standings placement must be assigned to an owner.", 400);
  }

  const uniqueIds = new Set(orderedLeagueMemberIds);

  if (uniqueIds.size !== orderedLeagueMemberIds.length) {
    throw new ResultsServiceError("Each owner must appear exactly once in the final standings.", 400);
  }

  const eligibleSet = new Set(eligibleLeagueMemberIds);

  if (orderedLeagueMemberIds.some((leagueMemberId) => !eligibleSet.has(leagueMemberId))) {
    throw new ResultsServiceError("Final standings contain an owner who does not belong to this season's league.", 400);
  }

  if (eligibleLeagueMemberIds.some((leagueMemberId) => !uniqueIds.has(leagueMemberId))) {
    throw new ResultsServiceError("Final standings must include every current league member exactly once.", 400);
  }
}

export const resultsService = {
  async getSeasonResults(seasonId: string): Promise<SeasonResultsSummary> {
    const season = await getSeasonResultsContext(seasonId);
    return buildResultsSummary(season);
  },

  async getRecommendedReverseDraftOrder(sourceSeasonId: string, targetSeasonId: string) {
    const normalizedSourceSeasonId = sourceSeasonId.trim();
    const normalizedTargetSeasonId = targetSeasonId.trim();

    if (!normalizedSourceSeasonId || !normalizedTargetSeasonId) {
      throw new ResultsServiceError("sourceSeasonId and targetSeasonId are required.", 400);
    }

    const { sourceSeason, recommended } = await getReverseDraftOrderContext(
      normalizedSourceSeasonId,
      normalizedTargetSeasonId
    );

    return {
      sourceSeasonId: sourceSeason.id,
      sourceSeasonName: sourceSeason.name,
      sourceSeasonYear: sourceSeason.year,
      champion: recommended.length > 0 ? {
        leagueMemberId: recommended[recommended.length - 1].leagueMemberId,
        userId: recommended[recommended.length - 1].userId,
        displayName: recommended[recommended.length - 1].displayName
      } : null,
      lastPlace: recommended.length > 0 ? {
        leagueMemberId: recommended[0].leagueMemberId,
        userId: recommended[0].userId,
        displayName: recommended[0].displayName
      } : null,
      entries: recommended
    };
  },

  async saveManualSeasonStandings(input: SaveManualSeasonStandingsInput): Promise<SeasonResultsSummary> {
    const seasonId = input.seasonId.trim();
    const orderedLeagueMemberIds = input.orderedLeagueMemberIds.map((leagueMemberId) => leagueMemberId.trim());

    if (!seasonId) {
      throw new ResultsServiceError("seasonId is required.", 400);
    }

    await seasonService.assertCommissionerAccess(seasonId, input.actingUserId);

    return prisma.$transaction(async (tx) => {
      const season = await tx.season.findUnique({
        where: {
          id: seasonId
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
          }
        }
      });

      if (!season) {
        throw new ResultsServiceError("Season not found.", 404);
      }

      validateOrderedStandings(
        season.league.members.map((member) => member.id),
        orderedLeagueMemberIds
      );

      await tx.seasonStanding.deleteMany({
        where: {
          seasonId
        }
      });

      await tx.seasonStanding.createMany({
        data: orderedLeagueMemberIds.map((leagueMemberId, index) => ({
          seasonId,
          leagueMemberId,
          provider: "MANUAL",
          rank: index + 1,
          wins: null,
          losses: null,
          ties: null,
          pointsFor: null,
          pointsAgainst: null,
          playoffFinish: null,
          isChampion: index === 0,
          externalEntityId: null,
          externalDisplayName: null,
          ingestionRunId: null,
          metadata: {
            source: "MANUAL_FINAL_STANDINGS"
          }
        }))
      });

      const refreshedSeason = await tx.season.findUnique({
        where: {
          id: seasonId
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
          seasonStandings: {
            include: {
              leagueMember: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ rank: "asc" }, { leagueMember: { joinedAt: "asc" } }]
          }
        }
      });

      if (!refreshedSeason) {
        throw new ResultsServiceError("Season not found after saving final standings.", 404);
      }

      return buildResultsSummary(refreshedSeason);
    });
  }
};

export { ResultsServiceError };
