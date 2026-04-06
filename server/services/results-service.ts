import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ledgerService, replaceFantasyPayoutEntriesForSeasonTx } from "@/server/services/ledger-service";
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

function decimalToNumber(value: Prisma.Decimal | number | string) {
  return Number(new Prisma.Decimal(value).toFixed(2));
}

function buildLedgerTotalsByLeagueMemberId(
  members: Array<{
    id: string;
    userId: string;
    role: "COMMISSIONER" | "OWNER";
    user: {
      displayName: string;
      email: string;
    };
  }>,
  ledgerEntries: Array<{
    leagueMemberId: string;
    amount: Prisma.Decimal;
  }>
) {
  const totalsByMemberId = new Map<string, number>();

  for (const entry of ledgerEntries) {
    totalsByMemberId.set(
      entry.leagueMemberId,
      Number(((totalsByMemberId.get(entry.leagueMemberId) ?? 0) + decimalToNumber(entry.amount)).toFixed(2))
    );
  }

  for (const member of members) {
    if (!totalsByMemberId.has(member.id)) {
      totalsByMemberId.set(member.id, 0);
    }
  }

  return totalsByMemberId;
}

function compareDraftOrderCandidates(
  left: { ledgerTotal: number; sourceSeasonRank: number | null; displayName: string },
  right: { ledgerTotal: number; sourceSeasonRank: number | null; displayName: string }
) {
  if (left.ledgerTotal !== right.ledgerTotal) {
    return left.ledgerTotal - right.ledgerTotal;
  }

  const leftRank = left.sourceSeasonRank;
  const rightRank = right.sourceSeasonRank;
  if (leftRank !== null && rightRank !== null && leftRank !== rightRank) {
    return rightRank - leftRank;
  }

  if (leftRank === null && rightRank !== null) {
    return 1;
  }

  if (leftRank !== null && rightRank === null) {
    return -1;
  }

  return left.displayName.localeCompare(right.displayName);
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
    select: {
      id: true,
      leagueId: true,
      year: true,
      name: true,
      status: true,
      fantasyPayoutConfig: true,
      league: {
        select: {
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              user: true
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
          }
        }
      },
      seasonStandings: {
        select: {
          leagueMemberId: true,
          provider: true,
          rank: true,
          wins: true,
          losses: true,
          ties: true,
          pointsFor: true,
          pointsAgainst: true,
          playoffFinish: true,
          isChampion: true,
          ingestionRunId: true,
          externalDisplayName: true,
          leagueMember: {
            select: {
              userId: true,
              role: true,
              user: true
            }
          }
        },
        orderBy: [{ rank: "asc" }, { leagueMember: { joinedAt: "asc" } }]
      },
      ledgerEntries: {
        select: {
          leagueMemberId: true,
          amount: true,
          category: true,
          description: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          leagueMember: {
            select: {
              userId: true,
              role: true,
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
  const standingsByLeagueMemberId = new Map(
    seasonStandings.map((standing) => [standing.leagueMemberId, standing] as const)
  );
  const ledgerTotalsByLeagueMemberId = buildLedgerTotalsByLeagueMemberId(season.league.members, season.ledgerEntries);
  const ownersWithLedgerEntries = season.league.members.filter(
    (member) => (ledgerTotalsByLeagueMemberId.get(member.id) ?? 0) !== 0
  ).length;
  const zeroLedgerOwnerCount = eligibleMembers.length - ownersWithLedgerEntries;
  const ledgerCoverageStatus: "NONE" | "PARTIAL" | "FULL" =
    ownersWithLedgerEntries === 0 ? "NONE" : ownersWithLedgerEntries === eligibleMembers.length ? "FULL" : "PARTIAL";
  const hasCompleteFantasyStandings =
    seasonStandings.length === eligibleMembers.length && seasonStandings.every((standing) => standing.rank !== null);

  const rankedDraftOrderCandidates = eligibleMembers
    .map((member) => {
      const standing = standingsByLeagueMemberId.get(member.leagueMemberId) ?? null;
      const ledgerTotal = ledgerTotalsByLeagueMemberId.get(member.leagueMemberId) ?? 0;
      const warnings: string[] = [];

      if (ledgerTotal === 0) {
        warnings.push("No season ledger entries were recorded for this owner.");
      }

      if (!standing?.rank) {
        warnings.push("Fantasy rank is unavailable, so ties fall back to display name ordering.");
      }

      return {
        ...member,
        sourceSeasonRank: standing?.rank ?? null,
        ledgerTotal,
        tieBreakReason: "LEDGER_TOTAL" as const,
        warnings
      };
    })
    .sort(compareDraftOrderCandidates);

  const recommendedOffseasonDraftOrder = rankedDraftOrderCandidates.map((member, index) => ({
      ...member,
      tieBreakReason: determineTieBreakReason(member, index > 0 ? rankedDraftOrderCandidates[index - 1] : null),
      draftSlot: index + 1
    }));

  const { config: fantasyPayoutConfig, configSource } = normalizePayoutConfigValue(season.fantasyPayoutConfig);
  const fantasyPayoutEntries = season.ledgerEntries.filter((entry) => entry.category === "FANTASY_PAYOUT");
  const publishedEntries = fantasyPayoutEntries
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
    fantasyPayoutEntries.length > 0
      ? [...fantasyPayoutEntries]
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0]
          ?.updatedAt.toISOString() ?? null
      : null;
  const hasAnyLedgerEntries = season.ledgerEntries.length > 0;

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
      isReadyForDraftOrderAutomation: eligibleMembers.length === 10 && hasAnyLedgerEntries,
      hasFantasyPayoutsPublished: fantasyPayoutEntries.length > 0,
      draftOrderReadiness: {
        hasAnyLedgerEntries,
        ownersWithLedgerEntries,
        zeroLedgerOwnerCount,
        ledgerCoverageStatus,
        hasCompleteFantasyStandings
      }
    },
    eligibleMembers,
    seasonStandings,
    recommendedOffseasonDraftOrder,
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

function determineTieBreakReason(
  current: { ledgerTotal: number; sourceSeasonRank: number | null; displayName: string },
  previous: { ledgerTotal: number; sourceSeasonRank: number | null; displayName: string } | null
): "LEDGER_TOTAL" | "FANTASY_RANK" | "DISPLAY_NAME" {
  if (!previous || current.ledgerTotal !== previous.ledgerTotal) {
    return "LEDGER_TOTAL";
  }

  if (current.sourceSeasonRank !== previous.sourceSeasonRank) {
    return "FANTASY_RANK";
  }

  return "DISPLAY_NAME";
}

async function getOffseasonDraftOrderContext(sourceSeasonId: string, targetSeasonId: string) {
  const [sourceSeason, ledgerTotalsContext, targetSeason] = await Promise.all([
    prisma.season.findUnique({
      where: {
        id: sourceSeasonId
      },
      select: {
        id: true,
        leagueId: true,
        year: true,
        name: true,
        league: {
          select: {
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
                user: true
              },
              orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
            }
          }
        },
        seasonStandings: {
          select: {
            leagueMemberId: true,
            rank: true,
            leagueMember: {
              select: {
                id: true,
                userId: true,
                role: true,
                user: true
              }
            }
          },
          orderBy: [{ rank: "asc" }, { leagueMember: { joinedAt: "asc" } }]
        }
      }
    }),
    ledgerService.getSeasonLedgerTotalsForDraftOrder(sourceSeasonId),
    prisma.season.findUnique({
      where: {
        id: targetSeasonId
      },
      select: {
        id: true,
        leagueId: true,
        year: true,
        name: true,
        league: {
          select: {
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
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

  const targetMembersByUserId = new Map(
    targetSeason.league.members.map((member) => [member.userId, member] as const)
  );
  const standingsByUserId = new Map(
    sourceSeason.seasonStandings.map((standing) => [standing.leagueMember.userId, standing] as const)
  );
  const hasCompleteFantasyStandings =
    sourceSeason.seasonStandings.length === sourceSeason.league.members.length &&
    sourceSeason.seasonStandings.every((standing) => standing.rank !== null);
  const zeroLedgerOwnerCount = ledgerTotalsContext.totals.filter((entry) => entry.entryCount === 0).length;
  const ownersWithLedgerEntries = ledgerTotalsContext.totals.length - zeroLedgerOwnerCount;
  const ledgerCoverageStatus: "NONE" | "PARTIAL" | "FULL" =
    ownersWithLedgerEntries === 0 ? "NONE" : ownersWithLedgerEntries === ledgerTotalsContext.totals.length ? "FULL" : "PARTIAL";
  const warnings: string[] = [];

  if (!ledgerTotalsContext.hasAnyEntries) {
    warnings.push("No season ledger entries exist yet, so the money-based draft order is not trustworthy.");
  }

  if (!hasCompleteFantasyStandings) {
    warnings.push("Complete fantasy standings are not available, so ledger-total ties fall back to display name ordering.");
  }

  const rankedRecommendedCandidates = [...ledgerTotalsContext.totals]
    .map((total) => {
      const standing = standingsByUserId.get(total.userId) ?? null;
      const targetMember = targetMembersByUserId.get(total.userId) ?? null;
      const entryWarnings: string[] = [];

      if (total.entryCount === 0) {
        entryWarnings.push("No season ledger entries were recorded for this owner.");
      }

      if (!standing?.rank) {
        entryWarnings.push("Fantasy rank is unavailable, so ties fall back to display name ordering.");
      }

      if (!targetMember) {
        entryWarnings.push("This owner is not a member of the target season league.");
      }

      return {
        leagueMemberId: targetMember?.id ?? null,
        sourceLeagueMemberId: total.leagueMemberId,
        targetLeagueMemberId: targetMember?.id ?? null,
        userId: total.userId,
        displayName: targetMember?.user.displayName ?? total.displayName,
        email: targetMember?.user.email ?? total.email,
        role: targetMember?.role ?? total.role,
        sourceSeasonRank: standing?.rank ?? null,
        ledgerTotal: total.ledgerTotal,
        mappingStatus: targetMember ? ("MAPPED" as const) : ("MISSING_TARGET_MEMBER" as const),
        tieBreakReason: "LEDGER_TOTAL" as const,
        warnings: entryWarnings
      };
    })
    .sort(compareDraftOrderCandidates);

  const recommended = rankedRecommendedCandidates.map((entry, index) => ({
      ...entry,
      tieBreakReason: determineTieBreakReason(entry, index > 0 ? rankedRecommendedCandidates[index - 1] : null),
      draftSlot: index + 1
    }));

  const allTargetMappingsComplete = recommended.every((entry) => entry.targetLeagueMemberId !== null);

  if (!allTargetMappingsComplete) {
    warnings.push("One or more source-season owners could not be mapped into the target season by userId.");
  }

  if (new Set(recommended.map((entry) => entry.userId)).size !== sourceSeason.league.members.length) {
    throw new ResultsServiceError("Auto-generated draft order must contain all 10 owners exactly once.", 409);
  }

  return {
    sourceSeason,
    targetSeason,
    recommended,
    readiness: {
      hasAnyLedgerEntries: ledgerTotalsContext.hasAnyEntries,
      hasCompleteFantasyStandings,
      allTargetMappingsComplete,
      ownersWithLedgerEntries,
      zeroLedgerOwnerCount,
      ledgerCoverageStatus,
      isReady: ledgerTotalsContext.hasAnyEntries && allTargetMappingsComplete
    },
    warnings
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
      select: {
        id: true,
        leagueId: true,
        year: true,
        name: true,
        status: true,
        fantasyPayoutConfig: true,
        league: {
          select: {
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
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
      select: {
        id: true,
        leagueId: true,
        year: true,
        name: true,
        status: true,
        fantasyPayoutConfig: true,
        league: {
          select: {
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
                user: true
              },
              orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
            }
          }
        },
        seasonStandings: {
          select: {
            leagueMemberId: true,
            provider: true,
            rank: true,
            wins: true,
            losses: true,
            ties: true,
            pointsFor: true,
            pointsAgainst: true,
            playoffFinish: true,
            isChampion: true,
            ingestionRunId: true,
            externalDisplayName: true,
            leagueMember: {
              select: {
                userId: true,
                role: true,
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
          select: {
            leagueMemberId: true,
            amount: true,
            category: true,
            description: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
            leagueMember: {
              select: {
                userId: true,
                role: true,
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

  async getRecommendedOffseasonDraftOrder(sourceSeasonId: string, targetSeasonId: string) {
    const normalizedSourceSeasonId = sourceSeasonId.trim();
    const normalizedTargetSeasonId = targetSeasonId.trim();

    if (!normalizedSourceSeasonId || !normalizedTargetSeasonId) {
      throw new ResultsServiceError("sourceSeasonId and targetSeasonId are required.", 400);
    }

    const { sourceSeason, recommended, readiness, warnings } = await getOffseasonDraftOrderContext(
      normalizedSourceSeasonId,
      normalizedTargetSeasonId
    );

    return {
      sourceSeasonId: sourceSeason.id,
      sourceSeasonName: sourceSeason.name,
      sourceSeasonYear: sourceSeason.year,
      lowestTotalOwner:
        recommended.length > 0
          ? {
              leagueMemberId: recommended[0].targetLeagueMemberId,
              userId: recommended[0].userId,
              displayName: recommended[0].displayName,
              ledgerTotal: recommended[0].ledgerTotal
            }
          : null,
      highestTotalOwner:
        recommended.length > 0
          ? {
              leagueMemberId: recommended[recommended.length - 1].targetLeagueMemberId,
              userId: recommended[recommended.length - 1].userId,
              displayName: recommended[recommended.length - 1].displayName,
              ledgerTotal: recommended[recommended.length - 1].ledgerTotal
            }
          : null,
      readiness,
      warnings,
      entries: recommended
    };
  },

  async getRecommendedReverseDraftOrder(sourceSeasonId: string, targetSeasonId: string) {
    // Backward-compatible alias for older call sites that still reference the standings-era name.
    return this.getRecommendedOffseasonDraftOrder(sourceSeasonId, targetSeasonId);
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
