import { prisma } from "@/lib/prisma";
import { draftService } from "@/server/services/draft-service";
import { dropPhaseService } from "@/server/services/drop-phase-service";
import { historyService } from "@/server/services/history-service";
import { ledgerService } from "@/server/services/ledger-service";
import { resultsService } from "@/server/services/results-service";
import { seasonPhaseService } from "@/server/services/season-phase-service";
import { teamOwnershipService } from "@/server/services/team-ownership-service";
import type {
  OwnerCurrentSeasonSummary,
  OwnerDashboardSummary,
  OwnerDraftPhaseDetail,
  OwnerDraftStatusSummary,
  OwnerHistorySeasonSummary,
  OwnerLeagueMembershipSummary,
  OwnerSeasonSummary
} from "@/types/owner";

class OwnerServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "OwnerServiceError";
  }
}

function mapLeagueMembership(member: {
  leagueId: string;
  role: "COMMISSIONER" | "OWNER";
  joinedAt: Date;
  league: {
    leagueCode: string | null;
    name: string;
    slug: string;
  };
}): OwnerLeagueMembershipSummary {
  return {
    leagueId: member.leagueId,
    leagueCode: member.league.leagueCode,
    leagueName: member.league.name,
    leagueSlug: member.league.slug,
    role: member.role,
    joinedAt: member.joinedAt.toISOString()
  };
}

function mapOwnerDraftStatus(
  draftState: Awaited<ReturnType<typeof draftService.getDraftStateByTargetSeason>>,
  userId: string
): OwnerDraftStatusSummary | null {
  if (!draftState) {
    return null;
  }

  const member = draftState.members.find((entry) => entry.userId === userId) ?? null;
  const draftPosition =
    draftState.picks.find((pick) => pick.selectingLeagueMemberId === member?.leagueMemberId)?.overallPickNumber ?? null;

  return {
    status: draftState.draft.status,
    draftPosition,
    currentPickNumber: draftState.currentPick?.overallPickNumber ?? null,
    picksCompleted: draftState.draft.picksCompleted,
    totalPicks: draftState.draft.totalPicks,
    isOnClock: Boolean(member && draftState.currentPick?.selectingLeagueMemberId === member.leagueMemberId),
    draftedTeam: member?.draftedTeam ?? null
  };
}

function mapOwnerDraftPhaseDetail(
  draftState: Awaited<ReturnType<typeof draftService.getDraftStateByTargetSeason>>,
  userId: string
): OwnerDraftPhaseDetail | null {
  const summary = mapOwnerDraftStatus(draftState, userId);

  if (!summary) {
    return null;
  }

  return summary;
}

async function requireOwnerUser(userId: string) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new OwnerServiceError("userId is required.", 400);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId
    },
    select: {
      id: true,
      displayName: true,
      email: true
    }
  });

  if (!user) {
    throw new OwnerServiceError("Authenticated user not found.", 404);
  }

  return user;
}

async function getLeagueMembershipsForUser(userId: string) {
  return prisma.leagueMember.findMany({
    where: {
      userId
    },
    select: {
      leagueId: true,
      role: true,
      joinedAt: true,
      league: {
        select: {
          leagueCode: true,
          name: true,
          slug: true
        }
      }
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
  });
}

async function getOwnerSeasonMembership(userId: string, seasonId: string) {
  const normalizedSeasonId = seasonId.trim();

  if (!normalizedSeasonId) {
    throw new OwnerServiceError("seasonId is required.", 400);
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
      league: {
        select: {
          name: true,
          leagueCode: true,
          members: {
            where: {
              userId
            },
            select: {
              id: true,
              role: true
            },
            take: 1
          }
        }
      }
    }
  });

  if (!season) {
    throw new OwnerServiceError("Season not found.", 404);
  }

  const membership = season.league.members[0] ?? null;

  if (!membership) {
    throw new OwnerServiceError("You are not a member of this season's league.", 403);
  }

  return {
    season: {
      id: season.id,
      leagueId: season.leagueId,
      leagueName: season.league.name,
      leagueCode: season.league.leagueCode,
      year: season.year,
      name: season.name,
      status: season.status
    },
    membership
  };
}

async function buildCurrentSeasonSummary(
  userId: string,
  user: Awaited<ReturnType<typeof requireOwnerUser>>,
  input: {
    id: string;
    leagueId: string;
    year: number;
    name: string | null;
    status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
    league: {
      name: string;
      leagueCode: string | null;
      members: Array<{
        id: string;
        role: "COMMISSIONER" | "OWNER";
      }>;
    };
  }
): Promise<OwnerCurrentSeasonSummary> {
  const membership = input.league.members[0] ?? null;

  if (!membership) {
    throw new OwnerServiceError("You are not a member of this season's league.", 403);
  }

  const [teams, ledger, results, phaseContext, draftState] = await Promise.all([
    teamOwnershipService.getUserTeamsForSeason(input.id, userId),
    ledgerService.getLeagueMemberSeasonLedger(input.id, membership.id, userId),
    resultsService.getSeasonResults(input.id),
    seasonPhaseService.getSeasonPhaseContext(input.id),
    draftService.getDraftStateByTargetSeason(input.id)
  ]);

  const standing = results.seasonStandings.find((entry) => entry.userId === user.id) ?? null;

  return {
    leagueId: input.leagueId,
    leagueCode: input.league.leagueCode,
    leagueName: input.league.name,
    seasonId: input.id,
    seasonYear: input.year,
    seasonName: input.name,
    seasonStatus: input.status,
    phase: phaseContext.season.leaguePhase,
    role: membership.role,
    teams: teams.map((entry) => entry.team),
    ledgerTotal: ledger.totals.net,
    standing:
      standing?.rank !== null && standing?.rank !== undefined
        ? {
            rank: standing.rank,
            isChampion: standing.isChampion === true
          }
        : null,
    draftStatus: mapOwnerDraftStatus(draftState, userId)
  };
}

export const ownerService = {
  async getOwnerDashboard(userId: string): Promise<OwnerDashboardSummary> {
    const user = await requireOwnerUser(userId);
    const memberships = await getLeagueMembershipsForUser(user.id);
    const mappedMemberships = memberships.map(mapLeagueMembership);

    if (mappedMemberships.length === 0) {
      return {
        user,
        memberships: [],
        currentSeasons: [],
        featuredSeasonId: null,
        financialSummary: {
          currentSeasonTotal: 0,
          cumulativeEarnings: 0,
          seasons: []
        },
        history: []
      };
    }

    const leagueIds = mappedMemberships.map((entry) => entry.leagueId);
    const [activeSeasons, financialSeasons, leagueHistories] = await Promise.all([
      prisma.season.findMany({
        where: {
          leagueId: {
            in: leagueIds
          },
          status: "ACTIVE",
          league: {
            members: {
              some: {
                userId: user.id
              }
            }
          }
        },
        select: {
          id: true,
          leagueId: true,
          year: true,
          name: true,
          status: true,
          league: {
            select: {
              name: true,
              leagueCode: true,
              members: {
                where: {
                  userId: user.id
                },
                select: {
                  id: true,
                  role: true
                },
                take: 1
              }
            }
          }
        },
        orderBy: [{ year: "desc" }, { createdAt: "desc" }]
      }),
      ledgerService.getOwnerFinancialHistory(user.id),
      Promise.all(mappedMemberships.map((entry) => historyService.getOwnerHistory(entry.leagueId, user.id)))
    ]);

    const currentSeasons = await Promise.all(
      activeSeasons.map((season) => buildCurrentSeasonSummary(user.id, user, season))
    );

    const financialBySeasonId = new Map(financialSeasons.map((entry) => [entry.seasonId, entry] as const));
    const historySeasonIds = leagueHistories.flatMap((entry) => entry.rows.map((row) => row.seasonId));
    const historyStandings = historySeasonIds.length
      ? await prisma.season.findMany({
          where: {
            id: {
              in: historySeasonIds
            }
          },
          select: {
            id: true,
            year: true,
            name: true,
            leagueId: true,
            league: {
              select: {
                name: true,
                leagueCode: true
              }
            },
            seasonStandings: {
              where: {
                leagueMember: {
                  userId: user.id
                }
              },
              select: {
                rank: true,
                isChampion: true
              },
              take: 1
            }
          }
        })
      : [];
    const seasonMetaById = new Map(historyStandings.map((entry) => [entry.id, entry] as const));

    const history: OwnerHistorySeasonSummary[] = leagueHistories
      .flatMap((historySummary) => historySummary.rows)
      .map((row) => {
        const seasonMeta = seasonMetaById.get(row.seasonId);
        const financial = financialBySeasonId.get(row.seasonId);

        if (!seasonMeta) {
          return null;
        }

        return {
          leagueId: seasonMeta.leagueId,
          leagueCode: seasonMeta.league.leagueCode,
          leagueName: seasonMeta.league.name,
          seasonId: row.seasonId,
          seasonYear: row.seasonYear,
          seasonName: row.seasonName,
          teams: row.teams,
          finalPlacement: seasonMeta.seasonStandings[0]?.rank ?? null,
          isChampion: seasonMeta.seasonStandings[0]?.isChampion ?? null,
          ledgerTotal: financial?.ledgerTotal ?? 0
        };
      })
      .filter((entry): entry is OwnerHistorySeasonSummary => entry !== null)
      .sort((left, right) => {
        if (right.seasonYear !== left.seasonYear) {
          return right.seasonYear - left.seasonYear;
        }

        return left.leagueName.localeCompare(right.leagueName);
      });

    return {
      user,
      memberships: mappedMemberships,
      currentSeasons,
      featuredSeasonId: currentSeasons[0]?.seasonId ?? history[0]?.seasonId ?? null,
      financialSummary: {
        currentSeasonTotal: Number(
          currentSeasons.reduce((total, season) => total + season.ledgerTotal, 0).toFixed(2)
        ),
        cumulativeEarnings: Number(
          financialSeasons.reduce((total, season) => total + season.ledgerTotal, 0).toFixed(2)
        ),
        seasons: financialSeasons
      },
      history
    };
  },

  async getOwnerSeasonContext(userId: string, seasonId: string): Promise<OwnerSeasonSummary> {
    const user = await requireOwnerUser(userId);
    const { season, membership } = await getOwnerSeasonMembership(user.id, seasonId);

    const [teams, ledger, results, phaseContext, draftState] = await Promise.all([
      teamOwnershipService.getUserTeamsForSeason(season.id, user.id),
      ledgerService.getLeagueMemberSeasonLedger(season.id, membership.id, user.id),
      resultsService.getSeasonResults(season.id),
      seasonPhaseService.getSeasonPhaseContext(season.id),
      draftService.getDraftStateByTargetSeason(season.id)
    ]);
    const dropPhaseContext =
      phaseContext.season.leaguePhase === "DROP_PHASE"
        ? await dropPhaseService.getDropPhaseContext(season.id)
        : null;

    const standing = results.seasonStandings.find((entry) => entry.userId === user.id) ?? null;
    const ownerDropPhase = dropPhaseContext?.owners.find((entry) => entry.userId === user.id) ?? null;
    const dropPhase =
      phaseContext.season.leaguePhase === "DROP_PHASE" && ownerDropPhase
        ? {
            sourceSeasonId: dropPhaseContext?.sourceSeasonId ?? null,
            sourceSeasonYear: dropPhaseContext?.sourceSeasonYear ?? null,
            sourceSeasonName: dropPhaseContext?.sourceSeasonName ?? null,
            eligibleTeams: ownerDropPhase.eligibleTeams,
            keptTeams: ownerDropPhase.keptTeams,
            releasedTeam: ownerDropPhase.releasedTeam,
            isComplete: ownerDropPhase.isComplete,
            warnings: ownerDropPhase.warnings
          }
        : null;

    return {
      user,
      membership: {
        leagueMemberId: membership.id,
        role: membership.role
      },
      season: {
        id: season.id,
        leagueId: season.leagueId,
        leagueCode: season.leagueCode,
        leagueName: season.leagueName,
        year: season.year,
        name: season.name,
        status: season.status,
        phase: phaseContext.season.leaguePhase
      },
      teams: teams.map((entry) => entry.team),
      ledger: {
        total: ledger.totals.net,
        entryCount: ledger.entries.length,
        entries: ledger.entries.map((entry) => ({
          id: entry.id,
          category: entry.category,
          amount: entry.amount,
          description: entry.description,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          metadata: entry.metadata
        }))
      },
      standing:
        standing?.rank !== null && standing?.rank !== undefined
          ? {
              rank: standing.rank,
              isChampion: standing.isChampion === true
            }
          : null,
      dropPhase,
      draftPhase:
        phaseContext.season.leaguePhase === "DRAFT_PHASE"
          ? mapOwnerDraftPhaseDetail(draftState, user.id)
          : null
    };
  }
};

export { OwnerServiceError };
