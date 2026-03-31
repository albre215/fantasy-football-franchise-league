import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { replaceFantasyPayoutEntriesForSeasonTx } from "@/server/services/ledger-service";
import { seasonService } from "@/server/services/season-service";
import type {
  FantasyPayoutConfigEntry,
  FantasyPayoutPublishedEntry,
  OverwriteManualSeasonStandingsInput,
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

const DEFAULT_FANTASY_PAYOUT_CONFIG: FantasyPayoutConfigEntry[] = [
  { rank: 1, amount: 100 },
  { rank: 2, amount: 50 },
  { rank: 3, amount: 25 },
  { rank: 4, amount: 0 },
  { rank: 5, amount: 0 },
  { rank: 6, amount: 0 },
  { rank: 7, amount: 0 },
  { rank: 8, amount: 0 },
  { rank: 9, amount: 0 },
  { rank: 10, amount: 0 }
];

function formatPlacement(rank: number) {
  if (rank === 1) {
    return "1st";
  }

  if (rank === 2) {
    return "2nd";
  }

  if (rank === 3) {
    return "3rd";
  }

  return `${rank}th`;
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

function normalizePayoutConfigValue(
  value: Prisma.JsonValue | null | undefined
): { config: FantasyPayoutConfigEntry[]; configSource: "DEFAULT" | "SEASON" } {
  if (!Array.isArray(value)) {
    return {
      config: DEFAULT_FANTASY_PAYOUT_CONFIG,
      configSource: "DEFAULT"
    };
  }

  const candidateEntries = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const rank = typeof entry.rank === "number" ? entry.rank : null;
      const amount = typeof entry.amount === "number" ? entry.amount : null;

      if (rank === null || amount === null) {
        return null;
      }

      return {
        rank,
        amount
      };
    })
    .filter((entry): entry is FantasyPayoutConfigEntry => entry !== null);

  if (candidateEntries.length !== 10) {
    return {
      config: DEFAULT_FANTASY_PAYOUT_CONFIG,
      configSource: "DEFAULT"
    };
  }

  try {
    return {
      config: validateFantasyPayoutConfig(candidateEntries),
      configSource: "SEASON"
    };
  } catch {
    return {
      config: DEFAULT_FANTASY_PAYOUT_CONFIG,
      configSource: "DEFAULT"
    };
  }
}

function validateFantasyPayoutConfig(config: FantasyPayoutConfigEntry[]) {
  if (config.length !== 10) {
    throw new ResultsServiceError("Fantasy payout configuration must include ranks 1 through 10.", 400);
  }

  const normalized = config.map((entry) => {
    if (!Number.isInteger(entry.rank) || entry.rank < 1 || entry.rank > 10) {
      throw new ResultsServiceError("Fantasy payout configuration contains an invalid rank.", 400);
    }

    if (!Number.isFinite(entry.amount)) {
      throw new ResultsServiceError("Fantasy payout configuration contains an invalid amount.", 400);
    }

    if (entry.amount < 0) {
      throw new ResultsServiceError("Fantasy payout amounts cannot be negative.", 400);
    }

    return {
      rank: entry.rank,
      amount: Number(entry.amount.toFixed(2))
    };
  });

  if (new Set(normalized.map((entry) => entry.rank)).size !== 10) {
    throw new ResultsServiceError("Fantasy payout configuration must define each placement exactly once.", 400);
  }

  return [...normalized].sort((left, right) => left.rank - right.rank);
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
      },
      ledgerEntries: {
        where: {
          category: "FANTASY_PAYOUT"
        },
        include: {
          leagueMember: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
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
      role: standing.role,
      sourceSeasonRank: standing.rank ?? index + 1,
      draftSlot: index + 1
    }));

  const { config: fantasyPayoutConfig, configSource } = normalizePayoutConfigValue(season.fantasyPayoutConfig);
  const publishedEntries = season.ledgerEntries
    .map((entry) => {
      const metadata =
        entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
          ? (entry.metadata as Record<string, unknown>)
          : null;
      const rank = typeof metadata?.rank === "number" ? metadata.rank : null;

      if (rank === null) {
        return null;
      }

      const published: FantasyPayoutPublishedEntry = {
        leagueMemberId: entry.leagueMemberId,
        userId: entry.leagueMember.userId,
        displayName: entry.leagueMember.user.displayName,
        email: entry.leagueMember.user.email,
        role: entry.leagueMember.role,
        amount: Number(entry.amount.toFixed(2)),
        rank,
        description: entry.description,
        createdAt: entry.createdAt.toISOString()
      };

      return published;
    })
    .filter((entry): entry is FantasyPayoutPublishedEntry => entry !== null)
    .sort((left, right) => left.rank - right.rank || left.displayName.localeCompare(right.displayName));

  const publishedAt =
    season.ledgerEntries.length > 0
      ? [...season.ledgerEntries]
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0]
          ?.updatedAt.toISOString() ?? null
      : null;

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
        seasonStandings.every((standing) => standing.rank !== null),
      hasFantasyPayoutsPublished: season.ledgerEntries.length > 0
    },
    eligibleMembers,
    seasonStandings,
    recommendedReverseDraftOrder,
    fantasyPayouts: {
      config: fantasyPayoutConfig,
      configSource,
      publishedEntries,
      publishedAt,
      totalPublishedAmount: Number(
        publishedEntries.reduce((total, entry) => total + entry.amount, 0).toFixed(2)
      )
    }
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

async function saveManualSeasonStandingsInternal(
  input: SaveManualSeasonStandingsInput
): Promise<SeasonResultsSummary> {
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

    const existingConfig = normalizePayoutConfigValue(season.fantasyPayoutConfig).config;
    const resolvedPayoutConfig = validateFantasyPayoutConfig(input.payoutConfig ?? existingConfig);

    await tx.season.update({
      where: {
        id: seasonId
      },
      data: {
        fantasyPayoutConfig: resolvedPayoutConfig as Prisma.InputJsonValue
      }
    });

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

    await replaceFantasyPayoutEntriesForSeasonTx(tx, {
      seasonId,
      leagueId: season.leagueId,
      actingUserId: input.actingUserId.trim(),
      payoutConfig: resolvedPayoutConfig,
      standings: orderedLeagueMemberIds.map((leagueMemberId, index) => {
        const member = season.league.members.find((entry) => entry.id === leagueMemberId);

        if (!member) {
          throw new ResultsServiceError("Final standings contain an invalid owner.", 400);
        }

        return {
          leagueMemberId,
          rank: index + 1,
          displayName: member.user.displayName
        };
      })
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
        },
        ledgerEntries: {
          where: {
            category: "FANTASY_PAYOUT"
          },
          include: {
            leagueMember: {
              include: {
                user: true
              }
            }
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }]
        }
      }
    });

    if (!refreshedSeason) {
      throw new ResultsServiceError("Season not found after saving final standings.", 404);
    }

    return buildResultsSummary(refreshedSeason);
  });
}

async function seasonHasSavedStandings(seasonId: string) {
  const standingCount = await prisma.seasonStanding.count({
    where: {
      seasonId
    }
  });

  return standingCount > 0;
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
      champion:
        recommended.length > 0
          ? {
              leagueMemberId: recommended[recommended.length - 1].leagueMemberId,
              userId: recommended[recommended.length - 1].userId,
              displayName: recommended[recommended.length - 1].displayName
            }
          : null,
      lastPlace:
        recommended.length > 0
          ? {
              leagueMemberId: recommended[0].leagueMemberId,
              userId: recommended[0].userId,
              displayName: recommended[0].displayName
            }
          : null,
      entries: recommended
    };
  },

  async saveManualSeasonStandings(input: SaveManualSeasonStandingsInput): Promise<SeasonResultsSummary> {
    if (await seasonHasSavedStandings(input.seasonId.trim())) {
      throw new ResultsServiceError(
        "Final standings already exist for this season. Use the overwrite workflow to replace them.",
        409
      );
    }

    return saveManualSeasonStandingsInternal(input);
  },

  async overwriteManualSeasonStandings(input: OverwriteManualSeasonStandingsInput): Promise<SeasonResultsSummary> {
    if (!input.confirmOverwrite) {
      throw new ResultsServiceError("Standings overwrite must be explicitly confirmed.", 400);
    }

    return saveManualSeasonStandingsInternal(input);
  }
};

export { DEFAULT_FANTASY_PAYOUT_CONFIG };
export { ResultsServiceError };
