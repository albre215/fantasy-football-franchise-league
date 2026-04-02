import { prisma } from "@/lib/prisma";
import type { DraftTeamSummary } from "@/types/draft";
import type {
  OwnerActiveSeasonSummary,
  OwnerDashboardSummary,
  OwnerHistoryEntry,
  OwnerLeagueMembershipSummary,
  OwnerOffseasonContextSummary
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

function mapDraftTeam(team: {
  id: string;
  name: string;
  abbreviation: string;
  conference: "AFC" | "NFC";
  division: string;
}): DraftTeamSummary {
  return {
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    conference: team.conference,
    division: team.division
  };
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

function mapActiveSeason(season: {
  id: string;
  leagueId: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  isLocked: boolean;
  league: {
    name: string;
  };
}): OwnerActiveSeasonSummary {
  return {
    leagueId: season.leagueId,
    leagueName: season.league.name,
    seasonId: season.id,
    year: season.year,
    name: season.name,
    status: season.status,
    isLocked: season.isLocked
  };
}

export const ownerService = {
  async getOwnerDashboard(userId: string): Promise<OwnerDashboardSummary> {
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

    const leagueMemberships = await prisma.leagueMember.findMany({
      where: {
        userId: normalizedUserId
      },
      include: {
        league: true
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
    });

    const leagues = leagueMemberships.map(mapLeagueMembership);
    const leagueIds = leagues.map((membership) => membership.leagueId);

    if (leagueIds.length === 0) {
      return {
        user,
        leagues: [],
        activeSeasons: [],
        currentTeams: [],
        history: [],
        offseasonContext: []
      };
    }

    const [activeSeasons, historySeasons] = await Promise.all([
      prisma.season.findMany({
        where: {
          leagueId: {
            in: leagueIds
          },
          status: "ACTIVE"
        },
        include: {
          league: true,
          teamOwnerships: {
            where: {
              leagueMember: {
                userId: normalizedUserId
              }
            },
            include: {
              nflTeam: true
            },
            orderBy: {
              slot: "asc"
            }
          }
        },
        orderBy: [{ year: "desc" }, { createdAt: "desc" }]
      }),
      prisma.season.findMany({
        where: {
          leagueId: {
            in: leagueIds
          },
          OR: [
            {
              teamOwnerships: {
                some: {
                  leagueMember: {
                    userId: normalizedUserId
                  }
                }
              }
            },
            {
              seasonStandings: {
                some: {
                  leagueMember: {
                    userId: normalizedUserId
                  }
                }
              }
            }
          ]
        },
        include: {
          league: true,
          teamOwnerships: {
            where: {
              leagueMember: {
                userId: normalizedUserId
              }
            },
            include: {
              nflTeam: true
            },
            orderBy: {
              slot: "asc"
            }
          },
          seasonStandings: {
            where: {
              leagueMember: {
                userId: normalizedUserId
              }
            },
            select: {
              rank: true,
              isChampion: true
            }
          }
        },
        orderBy: [{ year: "desc" }, { createdAt: "desc" }]
      })
    ]);

    const activeSeasonSummaries = activeSeasons.map(mapActiveSeason);

    const currentTeams = activeSeasons.map((season) => ({
        leagueId: season.leagueId,
        leagueName: season.league.name,
        season: mapActiveSeason(season),
        teams: season.teamOwnerships.map((ownership) => mapDraftTeam(ownership.nflTeam))
      }));

    const history: OwnerHistoryEntry[] = historySeasons.map((season) => ({
      leagueId: season.leagueId,
      leagueName: season.league.name,
      seasonId: season.id,
      seasonYear: season.year,
      seasonName: season.name,
      teams: season.teamOwnerships.map((ownership) => mapDraftTeam(ownership.nflTeam)),
      finalPlacement: season.seasonStandings[0]?.rank ?? null,
      isChampion: season.seasonStandings[0]?.isChampion ?? null
    }));

    const drafts = activeSeasons.length
      ? await prisma.draft.findMany({
          where: {
            targetSeasonId: {
              in: activeSeasons.map((season) => season.id)
            }
          },
          include: {
            targetSeason: {
              include: {
                league: true
              }
            },
            sourceSeason: {
              include: {
                teamOwnerships: {
                  where: {
                    leagueMember: {
                      userId: normalizedUserId
                    }
                  },
                  include: {
                    nflTeam: true
                  },
                  orderBy: {
                    slot: "asc"
                  }
                }
              }
            },
            keeperSelections: {
              where: {
                leagueMember: {
                  userId: normalizedUserId
                }
              },
              include: {
                nflTeam: true
              },
              orderBy: {
                createdAt: "asc"
              }
            },
            picks: {
              include: {
                selectedNflTeam: true,
                selectingLeagueMember: {
                  select: {
                    userId: true
                  }
                }
              },
              orderBy: {
                overallPickNumber: "asc"
              }
            }
          },
          orderBy: [{ targetSeason: { year: "desc" } }, { createdAt: "desc" }]
        })
      : [];

    const offseasonContext: OwnerOffseasonContextSummary[] = drafts.map((draft) => {
      const userPicks = draft.picks.filter((pick) => pick.selectingLeagueMember.userId === normalizedUserId);
      const draftPosition = userPicks[0]?.overallPickNumber ?? null;
      const draftedTeam = userPicks.find((pick) => pick.selectedNflTeam !== null)?.selectedNflTeam ?? null;
      const currentPick = draft.picks.find((pick) => pick.overallPickNumber === draft.currentPick) ?? null;

      return {
        leagueId: draft.leagueId,
        leagueName: draft.targetSeason.league.name,
        targetSeasonId: draft.targetSeasonId,
        targetSeasonYear: draft.targetSeason.year,
        targetSeasonName: draft.targetSeason.name,
        sourceSeasonId: draft.sourceSeasonId,
        sourceSeasonYear: draft.sourceSeason.year,
        sourceSeasonName: draft.sourceSeason.name,
        draftStatus: draft.status,
        previousSeasonTeams: draft.sourceSeason.teamOwnerships.map((ownership) => mapDraftTeam(ownership.nflTeam)),
        keepers: draft.keeperSelections.map((keeper) => mapDraftTeam(keeper.nflTeam)),
        draftedTeam: draftedTeam ? mapDraftTeam(draftedTeam) : null,
        keeperCount: draft.keeperSelections.length,
        keeperEligibleCount: 2,
        draftPosition,
        currentPickNumber: currentPick?.overallPickNumber ?? null,
        isOnClock: currentPick?.selectingLeagueMember.userId === normalizedUserId
      };
    });

    return {
      user,
      leagues,
      activeSeasons: activeSeasonSummaries,
      currentTeams,
      history,
      offseasonContext
    };
  }
};

export { OwnerServiceError };
