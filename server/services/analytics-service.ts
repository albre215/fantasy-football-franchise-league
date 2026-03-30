import { prisma } from "@/lib/prisma";
import type {
  DraftAnalytics,
  FranchiseAnalytics,
  LeagueOverviewAnalytics,
  OwnerAnalytics
} from "@/types/analytics";
import type { HistoricalAcquisitionType, HistoryTeamSummary } from "@/types/history";

class AnalyticsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "AnalyticsServiceError";
  }
}

function mapTeam(team: {
  id: string;
  name: string;
  abbreviation: string;
  conference: "AFC" | "NFC";
  division: string;
}): HistoryTeamSummary {
  return {
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    conference: team.conference,
    division: team.division
  };
}

async function getLeagueAnalyticsContext(leagueId: string) {
  const normalizedLeagueId = leagueId.trim();

  if (!normalizedLeagueId) {
    throw new AnalyticsServiceError("leagueId is required.", 400);
  }

  const [league, seasons, drafts, teams] = await Promise.all([
    prisma.league.findUnique({
      where: { id: normalizedLeagueId },
      include: {
        members: {
          include: {
            user: true
          },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
        }
      }
    }),
    prisma.season.findMany({
      where: { leagueId: normalizedLeagueId },
      include: {
        teamOwnerships: {
          include: {
            nflTeam: true,
            leagueMember: {
              include: {
                user: true
              }
            }
          },
          orderBy: [{ slot: "asc" }, { createdAt: "asc" }]
        },
        seasonStandings: {
          include: {
            leagueMember: {
              include: {
                user: true
              }
            }
          },
          orderBy: [{ rank: "asc" }, { updatedAt: "asc" }]
        }
      },
      orderBy: { year: "desc" }
    }),
    prisma.draft.findMany({
      where: { leagueId: normalizedLeagueId },
      include: {
        sourceSeason: true,
        targetSeason: true,
        keeperSelections: {
          include: {
            nflTeam: true,
            leagueMember: {
              include: {
                user: true
              }
            }
          },
          orderBy: [{ leagueMemberId: "asc" }, { createdAt: "asc" }]
        },
        picks: {
          include: {
            selectedNflTeam: true,
            selectingLeagueMember: {
              include: {
                user: true
              }
            }
          },
          orderBy: { overallPickNumber: "asc" }
        }
      },
      orderBy: {
        targetSeason: {
          year: "desc"
        }
      }
    }),
    prisma.nFLTeam.findMany({
      where: { isActive: true },
      orderBy: [{ conference: "asc" }, { division: "asc" }, { name: "asc" }]
    })
  ]);

  if (!league) {
    throw new AnalyticsServiceError("League not found.", 404);
  }

  return {
    league,
    seasons,
    drafts,
    teams
  };
}

function buildDraftLookupByTargetSeasonId(
  drafts: Awaited<ReturnType<typeof getLeagueAnalyticsContext>>["drafts"]
) {
  return new Map(drafts.map((draft) => [draft.targetSeasonId, draft]));
}

function buildAcquisitionTypeResolver(
  drafts: Awaited<ReturnType<typeof getLeagueAnalyticsContext>>["drafts"]
) {
  const draftBySeasonId = buildDraftLookupByTargetSeasonId(drafts);

  return (
    seasonId: string,
    leagueMemberId: string,
    nflTeamId: string
  ): { acquisitionType: HistoricalAcquisitionType; draftPickNumber: number | null } => {
    const draft = draftBySeasonId.get(seasonId);

    if (!draft) {
      return {
        acquisitionType: "MANUAL",
        draftPickNumber: null
      };
    }

    const keeper = draft.keeperSelections.find(
      (entry) => entry.leagueMemberId === leagueMemberId && entry.nflTeam.id === nflTeamId
    );

    if (keeper) {
      return {
        acquisitionType: "KEEPER",
        draftPickNumber: null
      };
    }

    const pick = draft.picks.find(
      (entry) => entry.selectingLeagueMember.id === leagueMemberId && entry.selectedNflTeam?.id === nflTeamId
    );

    if (pick) {
      return {
        acquisitionType: "DRAFT",
        draftPickNumber: pick.overallPickNumber
      };
    }

    return {
      acquisitionType: "MANUAL",
      draftPickNumber: null
    };
  };
}

function computeTeamStreaks(
  rows: Array<{
    seasonYear: number;
    userId: string;
    displayName: string;
    teamId: string;
  }>
) {
  if (rows.length === 0) {
    return [];
  }

  const sortedRows = [...rows].sort((left, right) => left.seasonYear - right.seasonYear);
  const streaks: Array<{
    userId: string;
    displayName: string;
    teamId: string;
    length: number;
    startSeasonYear: number;
    endSeasonYear: number;
  }> = [];

  let current = {
    userId: sortedRows[0].userId,
    displayName: sortedRows[0].displayName,
    teamId: sortedRows[0].teamId,
    length: 1,
    startSeasonYear: sortedRows[0].seasonYear,
    endSeasonYear: sortedRows[0].seasonYear
  };

  for (let index = 1; index < sortedRows.length; index += 1) {
    const row = sortedRows[index];
    const isContinuation =
      row.userId === current.userId && row.teamId === current.teamId && row.seasonYear === current.endSeasonYear + 1;

    if (isContinuation) {
      current.length += 1;
      current.endSeasonYear = row.seasonYear;
      continue;
    }

    streaks.push(current);
    current = {
      userId: row.userId,
      displayName: row.displayName,
      teamId: row.teamId,
      length: 1,
      startSeasonYear: row.seasonYear,
      endSeasonYear: row.seasonYear
    };
  }

  streaks.push(current);

  return streaks;
}

function toChartData<T extends { key?: string; label: string; value: number }>(rows: T[]) {
  return rows.map((row, index) => ({
    key: row.key ?? `${row.label}-${index}`,
    label: row.label,
    value: row.value
  }));
}

export const analyticsService = {
  async getLeagueOverview(leagueId: string): Promise<LeagueOverviewAnalytics> {
    const { league, seasons, teams } = await getLeagueAnalyticsContext(leagueId);
    const teamById = new Map(teams.map((team) => [team.id, team] as const));

    const ownershipCountByTeam = new Map<string, number>();
    for (const season of seasons) {
      for (const ownership of season.teamOwnerships) {
        ownershipCountByTeam.set(
          ownership.nflTeamId,
          (ownershipCountByTeam.get(ownership.nflTeamId) ?? 0) + 1
        );
      }
    }

    const mostOwnedTeamEntry =
      [...ownershipCountByTeam.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;

    const championRows = seasons
      .map((season) => {
        const championStanding =
          season.seasonStandings.find((standing) => standing.isChampion) ??
          season.seasonStandings.find((standing) => standing.rank === 1) ??
          null;

        if (!championStanding) {
          return null;
        }

        const championTeams = season.teamOwnerships
          .filter((ownership) => ownership.leagueMember.userId === championStanding.leagueMember.userId)
          .map((ownership) => mapTeam(ownership.nflTeam));

        return {
          seasonId: season.id,
          seasonYear: season.year,
          seasonName: season.name,
          ownerUserId: championStanding.leagueMember.userId,
          ownerDisplayName: championStanding.leagueMember.user.displayName,
          ownerEmail: championStanding.leagueMember.user.email,
          championTeams
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const championCountsByOwner = new Map<
      string,
      { ownerUserId: string; ownerDisplayName: string; championshipCount: number }
    >();

    for (const champion of championRows) {
      const current = championCountsByOwner.get(champion.ownerUserId);
      championCountsByOwner.set(champion.ownerUserId, {
        ownerUserId: champion.ownerUserId,
        ownerDisplayName: champion.ownerDisplayName,
        championshipCount: (current?.championshipCount ?? 0) + 1
      });
    }

    const championCounts = [...championCountsByOwner.values()].sort(
      (left, right) => right.championshipCount - left.championshipCount
    );

    return {
      leagueId: league.id,
      leagueName: league.name,
      totalSeasons: seasons.length,
      totalUniqueFranchisesUsed: new Set(
        seasons.flatMap((season) => season.teamOwnerships.map((ownership) => ownership.nflTeamId))
      ).size,
      totalOwnersAcrossHistory: new Set(
        seasons.flatMap((season) => season.teamOwnerships.map((ownership) => ownership.leagueMember.userId))
      ).size,
      mostRecentChampion: championRows[0] ?? null,
      mostCommonChampion: championCounts[0] ?? null,
      championCounts,
      championChart: toChartData(
        championCounts.slice(0, 6).map((entry) => ({
          key: entry.ownerUserId,
          label: entry.ownerDisplayName,
          value: entry.championshipCount
        }))
      ),
      mostOwnedTeam:
        mostOwnedTeamEntry && teamById.get(mostOwnedTeamEntry[0])
          ? {
              team: mapTeam(teamById.get(mostOwnedTeamEntry[0])!),
              ownershipCount: mostOwnedTeamEntry[1]
            }
          : null
    };
  },

  async getFranchiseAnalytics(leagueId: string): Promise<FranchiseAnalytics> {
    const { league, seasons, drafts, teams } = await getLeagueAnalyticsContext(leagueId);
    const resolveAcquisition = buildAcquisitionTypeResolver(drafts);
    const teamById = new Map(teams.map((team) => [team.id, team] as const));

    const groupedRows = new Map<
      string,
      Array<{
        seasonId: string;
        seasonYear: number;
        seasonName: string | null;
        ownerUserId: string;
        ownerDisplayName: string;
        acquisitionType: HistoricalAcquisitionType;
        draftPickNumber: number | null;
      }>
    >();

    for (const season of seasons) {
      for (const ownership of season.teamOwnerships) {
        const rows = groupedRows.get(ownership.nflTeamId) ?? [];
        const acquisition = resolveAcquisition(season.id, ownership.leagueMember.id, ownership.nflTeamId);
        rows.push({
          seasonId: season.id,
          seasonYear: season.year,
          seasonName: season.name,
          ownerUserId: ownership.leagueMember.userId,
          ownerDisplayName: ownership.leagueMember.user.displayName,
          acquisitionType: acquisition.acquisitionType,
          draftPickNumber: acquisition.draftPickNumber
        });
        groupedRows.set(ownership.nflTeamId, rows);
      }
    }

    const franchises = [...groupedRows.entries()]
      .flatMap(([teamId, rows]) => {
        const team = teamById.get(teamId);

        if (!team) {
          return [];
        }

        const streaks = computeTeamStreaks(
          rows.map((row) => ({
            seasonYear: row.seasonYear,
            userId: row.ownerUserId,
            displayName: row.ownerDisplayName,
            teamId
          }))
        );
        const longestStreak = [...streaks].sort((left, right) => right.length - left.length)[0] ?? null;

        return [
          {
            team: mapTeam(team),
            ownershipCount: rows.length,
            longestOwnershipStreak: longestStreak
              ? {
                  ownerUserId: longestStreak.userId,
                  ownerDisplayName: longestStreak.displayName,
                  length: longestStreak.length,
                  startSeasonYear: longestStreak.startSeasonYear,
                  endSeasonYear: longestStreak.endSeasonYear
                }
              : null,
            timeline: [...rows].sort((left, right) => right.seasonYear - left.seasonYear)
          }
        ];
      })
      .sort((left, right) => right.ownershipCount - left.ownershipCount);

    const longestOwnershipStreaks = franchises
      .filter((entry) => entry.longestOwnershipStreak)
      .map((entry) => ({
        team: entry.team,
        ownerUserId: entry.longestOwnershipStreak!.ownerUserId,
        ownerDisplayName: entry.longestOwnershipStreak!.ownerDisplayName,
        streakLength: entry.longestOwnershipStreak!.length,
        startSeasonYear: entry.longestOwnershipStreak!.startSeasonYear,
        endSeasonYear: entry.longestOwnershipStreak!.endSeasonYear
      }))
      .sort((left, right) => right.streakLength - left.streakLength)
      .slice(0, 8);

    return {
      leagueId: league.id,
      topOwnedTeams: franchises.slice(0, 8).map((entry) => ({
        team: entry.team,
        ownershipCount: entry.ownershipCount
      })),
      topOwnedTeamsChart: toChartData(
        franchises.slice(0, 8).map((entry) => ({
          key: entry.team.id,
          label: entry.team.abbreviation,
          value: entry.ownershipCount
        }))
      ),
      longestOwnershipStreaks,
      franchises
    };
  },

  async getOwnerAnalytics(leagueId: string): Promise<OwnerAnalytics> {
    const { league, seasons, drafts, teams } = await getLeagueAnalyticsContext(leagueId);
    const resolveAcquisition = buildAcquisitionTypeResolver(drafts);
    const teamById = new Map(teams.map((team) => [team.id, team] as const));
    const ownerByUserId = new Map(
      league.members.map((member) => [
        member.userId,
        {
          ownerUserId: member.userId,
          ownerDisplayName: member.user.displayName,
          ownerEmail: member.user.email
        }
      ] as const)
    );

    const owners = [...ownerByUserId.values()]
      .map((owner) => {
        const seasonsForOwner = seasons
          .map((season) => {
            const teamsForSeason = season.teamOwnerships
              .filter((ownership) => ownership.leagueMember.userId === owner.ownerUserId)
              .map((ownership) => {
                const acquisition = resolveAcquisition(season.id, ownership.leagueMember.id, ownership.nflTeamId);
                return {
                  team: mapTeam(ownership.nflTeam),
                  acquisitionType: acquisition.acquisitionType,
                  draftPickNumber: acquisition.draftPickNumber
                };
              });

            return {
              seasonId: season.id,
              seasonYear: season.year,
              seasonName: season.name,
              teams: teamsForSeason
            };
          })
          .filter((row) => row.teams.length > 0)
          .sort((left, right) => right.seasonYear - left.seasonYear);

        const teamCounts = new Map<string, number>();
        for (const season of seasonsForOwner) {
          for (const entry of season.teams) {
            teamCounts.set(entry.team.id, (teamCounts.get(entry.team.id) ?? 0) + 1);
          }
        }

        const streaks = computeTeamStreaks(
          seasonsForOwner.flatMap((season) =>
            season.teams.map((entry) => ({
              seasonYear: season.seasonYear,
              userId: owner.ownerUserId,
              displayName: owner.ownerDisplayName,
              teamId: entry.team.id
            }))
          )
        );
        const longestStreak = [...streaks].sort((left, right) => right.length - left.length)[0] ?? null;
        const sortedTeamCounts = [...teamCounts.entries()]
          .flatMap(([teamId, count]) => {
            const team = teamById.get(teamId);
            return team ? [{ team: mapTeam(team), count }] : [];
          })
          .sort((left, right) => right.count - left.count);

        return {
          ownerUserId: owner.ownerUserId,
          ownerDisplayName: owner.ownerDisplayName,
          ownerEmail: owner.ownerEmail,
          totalSeasonsParticipated: seasonsForOwner.length,
          totalUniqueFranchisesOwned: teamCounts.size,
          ownershipDiversity: teamCounts.size,
          mostFrequentlyOwnedTeam: sortedTeamCounts[0] ?? null,
          longestContinuousOwnership:
            longestStreak && teamById.get(longestStreak.teamId)
              ? {
                  team: mapTeam(teamById.get(longestStreak.teamId)!),
                  length: longestStreak.length,
                  startSeasonYear: longestStreak.startSeasonYear,
                  endSeasonYear: longestStreak.endSeasonYear
                }
              : null,
          teamCounts: sortedTeamCounts,
          teamCountChart: toChartData(
            sortedTeamCounts.slice(0, 8).map((entry) => ({
              key: entry.team.id,
              label: entry.team.abbreviation,
              value: entry.count
            }))
          ),
          seasons: seasonsForOwner
        };
      })
      .sort((left, right) => left.ownerDisplayName.localeCompare(right.ownerDisplayName));

    return {
      leagueId: league.id,
      ownershipDiversityChart: toChartData(
        owners
          .slice()
          .sort((left, right) => right.ownershipDiversity - left.ownershipDiversity)
          .slice(0, 8)
          .map((owner) => ({
            key: owner.ownerUserId,
            label: owner.ownerDisplayName,
            value: owner.ownershipDiversity
          }))
      ),
      owners
    };
  },

  async getDraftAnalytics(leagueId: string): Promise<DraftAnalytics> {
    const { league, drafts, teams } = await getLeagueAnalyticsContext(leagueId);
    const teamById = new Map(teams.map((team) => [team.id, team] as const));

    const keepCountByTeam = new Map<string, number>();
    const draftPickStatsByTeam = new Map<string, { count: number; totalPickNumber: number }>();

    for (const draft of drafts) {
      for (const keeper of draft.keeperSelections) {
        keepCountByTeam.set(keeper.nflTeam.id, (keepCountByTeam.get(keeper.nflTeam.id) ?? 0) + 1);
      }

      for (const pick of draft.picks) {
        if (!pick.selectedNflTeam) {
          continue;
        }

        const current = draftPickStatsByTeam.get(pick.selectedNflTeam.id) ?? { count: 0, totalPickNumber: 0 };
        draftPickStatsByTeam.set(pick.selectedNflTeam.id, {
          count: current.count + 1,
          totalPickNumber: current.totalPickNumber + pick.overallPickNumber
        });
      }
    }

    const mostDraftedTeams = [...draftPickStatsByTeam.entries()]
      .flatMap(([teamId, stats]) => {
        const team = teamById.get(teamId);
        return team
          ? [
              {
                team: mapTeam(team),
                draftCount: stats.count,
                averagePickNumber: stats.count > 0 ? Number((stats.totalPickNumber / stats.count).toFixed(1)) : null
              }
            ]
          : [];
      })
      .sort((left, right) => right.draftCount - left.draftCount);

    const mostKeptTeams = [...keepCountByTeam.entries()]
      .flatMap(([teamId, keepCount]) => {
        const team = teamById.get(teamId);
        return team ? [{ team: mapTeam(team), keepCount }] : [];
      })
      .sort((left, right) => right.keepCount - left.keepCount);

    return {
      leagueId: league.id,
      mostDraftedTeams,
      mostDraftedTeamsChart: toChartData(
        mostDraftedTeams.slice(0, 8).map((entry) => ({
          key: entry.team.id,
          label: entry.team.abbreviation,
          value: entry.draftCount
        }))
      ),
      mostKeptTeams,
      mostKeptTeamsChart: toChartData(
        mostKeptTeams.slice(0, 8).map((entry) => ({
          key: entry.team.id,
          label: entry.team.abbreviation,
          value: entry.keepCount
        }))
      ),
      recentDrafts: drafts.slice(0, 6).map((draft) => ({
        draftId: draft.id,
        targetSeasonId: draft.targetSeasonId,
        targetSeasonYear: draft.targetSeason.year,
        targetSeasonName: draft.targetSeason.name,
        sourceSeasonYear: draft.sourceSeason.year,
        sourceSeasonName: draft.sourceSeason.name,
        status: draft.status,
        keeperCount: draft.keeperSelections.length,
        picksCompleted: draft.picks.filter((pick) => Boolean(pick.selectedNflTeam)).length
      }))
    };
  }
};

export { AnalyticsServiceError };
