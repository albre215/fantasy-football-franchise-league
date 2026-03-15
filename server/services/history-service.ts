import { prisma } from "@/lib/prisma";
import type {
  AnalyticsLeaderboardEntry,
  DraftHistorySeasonSummary,
  HistoryFranchiseOption,
  HistoryOwnerOption,
  HistorySeasonSummary,
  HistoryTeamSummary,
  LeagueAnalyticsSummary,
  LeagueHistoryOverview,
  OwnerHistorySummary,
  FranchiseHistorySummary,
  HistoricalAcquisitionType
} from "@/types/history";

class HistoryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "HistoryServiceError";
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

function toSeasonLabel(name: string | null, year: number) {
  return name ?? `${year} Season`;
}

function buildDeferredMetrics() {
  return [
    {
      id: "championships" as const,
      label: "Championship Tracking",
      description: "Available after standings/results ingestion is added in Prompt 8.",
      availability: "PROMPT_8" as const
    },
    {
      id: "win_loss_history" as const,
      label: "Win/Loss History",
      description: "Available after standings/results ingestion is added in Prompt 8.",
      availability: "PROMPT_8" as const
    },
    {
      id: "playoff_results" as const,
      label: "Playoff Results",
      description: "Available after standings/results ingestion is added in Prompt 8.",
      availability: "PROMPT_8" as const
    },
    {
      id: "dynasty_metrics" as const,
      label: "Dynasty Metrics",
      description: "Result-based dynasty detection will populate in Prompt 8.",
      availability: "PROMPT_8" as const
    },
    {
      id: "team_success_by_decade" as const,
      label: "Franchise Success By Decade",
      description: "Requires standings/results ingestion before true success metrics can be calculated.",
      availability: "PROMPT_8" as const
    },
    {
      id: "owner_win_percentage" as const,
      label: "Owner Win Percentage",
      description: "Available after win/loss data is ingested in Prompt 8.",
      availability: "PROMPT_8" as const
    }
  ];
}

async function getLeagueHistoryContext(leagueId: string) {
  const normalizedLeagueId = leagueId.trim();

  if (!normalizedLeagueId) {
    throw new HistoryServiceError("leagueId is required.", 400);
  }

  const [league, seasons, drafts, teams] = await Promise.all([
    prisma.league.findUnique({
      where: {
        id: normalizedLeagueId
      },
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
      where: {
        leagueId: normalizedLeagueId
      },
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
        }
      },
      orderBy: {
        year: "desc"
      }
    }),
    prisma.draft.findMany({
      where: {
        leagueId: normalizedLeagueId
      },
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
          orderBy: {
            overallPickNumber: "asc"
          }
        }
      },
      orderBy: {
        targetSeason: {
          year: "desc"
        }
      }
    }),
    prisma.nFLTeam.findMany({
      where: {
        isActive: true
      },
      orderBy: [{ conference: "asc" }, { division: "asc" }, { name: "asc" }]
    })
  ]);

  if (!league) {
    throw new HistoryServiceError("League not found.", 404);
  }

  return {
    league,
    seasons,
    drafts,
    teams
  };
}

function buildDraftLookupByTargetSeasonId(
  drafts: Awaited<ReturnType<typeof getLeagueHistoryContext>>["drafts"]
) {
  return new Map(drafts.map((draft) => [draft.targetSeasonId, draft]));
}

function buildAcquisitionTypeResolver(
  drafts: Awaited<ReturnType<typeof getLeagueHistoryContext>>["drafts"]
) {
  const draftBySeasonId = buildDraftLookupByTargetSeasonId(drafts);

  return (seasonId: string, leagueMemberId: string, nflTeamId: string): { acquisitionType: HistoricalAcquisitionType; draftPickNumber: number | null } => {
    const draft = draftBySeasonId.get(seasonId);

    if (!draft) {
      return {
        acquisitionType: "MANUAL",
        draftPickNumber: null
      };
    }

    const keeper = draft.keeperSelections.find(
      (entry) => entry.leagueMemberId === leagueMemberId && entry.nflTeamId === nflTeamId
    );

    if (keeper) {
      return {
        acquisitionType: "KEEPER",
        draftPickNumber: null
      };
    }

    const pick = draft.picks.find(
      (entry) => entry.selectingLeagueMemberId === leagueMemberId && entry.selectedNflTeamId === nflTeamId
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
    teamAbbreviation: string;
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
    teamAbbreviation: string;
    length: number;
    startSeasonYear: number;
    endSeasonYear: number;
  }> = [];

  let current = {
    userId: sortedRows[0].userId,
    displayName: sortedRows[0].displayName,
    teamId: sortedRows[0].teamId,
    teamAbbreviation: sortedRows[0].teamAbbreviation,
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
      teamAbbreviation: row.teamAbbreviation,
      length: 1,
      startSeasonYear: row.seasonYear,
      endSeasonYear: row.seasonYear
    };
  }

  streaks.push(current);

  return streaks;
}

function formatLeaderboardValue(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export const historyService = {
  async getLeagueHistoryOverview(leagueId: string): Promise<LeagueHistoryOverview> {
    const { league, seasons, drafts, teams } = await getLeagueHistoryContext(leagueId);

    const ownershipRows = seasons.flatMap((season) =>
      season.teamOwnerships.map((ownership) => ({
        seasonYear: season.year,
        userId: ownership.leagueMember.userId,
        displayName: ownership.leagueMember.user.displayName,
        teamId: ownership.nflTeamId,
        teamAbbreviation: ownership.nflTeam.abbreviation
      }))
    );
    const streaks = computeTeamStreaks(ownershipRows);
    const longestStreak = [...streaks].sort((left, right) => right.length - left.length)[0] ?? null;

    const ownershipCountByTeam = new Map<string, number>();
    for (const season of seasons) {
      for (const ownership of season.teamOwnerships) {
        ownershipCountByTeam.set(
          ownership.nflTeam.abbreviation,
          (ownershipCountByTeam.get(ownership.nflTeam.abbreviation) ?? 0) + 1
        );
      }
    }

    const transitionCounts = new Map<string, number>();
    const ownershipsByTeam = new Map<string, Array<{ seasonYear: number; ownerUserId: string }>>();

    for (const season of seasons) {
      for (const ownership of season.teamOwnerships) {
        const bucket = ownershipsByTeam.get(ownership.nflTeamId) ?? [];
        bucket.push({
          seasonYear: season.year,
          ownerUserId: ownership.leagueMember.userId
        });
        ownershipsByTeam.set(ownership.nflTeamId, bucket);
      }
    }

    for (const [teamId, rows] of ownershipsByTeam.entries()) {
      const sortedRows = rows.sort((left, right) => left.seasonYear - right.seasonYear);
      let transitions = 0;

      for (let index = 1; index < sortedRows.length; index += 1) {
        if (sortedRows[index].ownerUserId !== sortedRows[index - 1].ownerUserId) {
          transitions += 1;
        }
      }

      transitionCounts.set(teamId, transitions);
    }

    const mostFrequentlyOwnedTeam = [...ownershipCountByTeam.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
    const mostFrequentlyChangingTeam = [...transitionCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
    const mostFrequentlyChangingTeamRecord = mostFrequentlyChangingTeam
      ? teams.find((team) => team.id === mostFrequentlyChangingTeam[0]) ?? null
      : null;

    return {
      leagueId: league.id,
      leagueName: league.name,
      totalSeasonsTracked: seasons.length,
      totalOwnershipRecords: seasons.reduce((total, season) => total + season.teamOwnerships.length, 0),
      totalHistoricalOwners: new Set(
        seasons.flatMap((season) => season.teamOwnerships.map((ownership) => ownership.leagueMember.userId))
      ).size,
      totalDraftsTracked: drafts.length,
      totalKeeperSelections: drafts.reduce((total, draft) => total + draft.keeperSelections.length, 0),
      totalDraftPicksMade: drafts.reduce(
        (total, draft) => total + draft.picks.filter((pick) => Boolean(pick.selectedNflTeamId)).length,
        0
      ),
      franchiseOptions: teams.map((team) => ({
        nflTeamId: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        conference: team.conference,
        division: team.division
      })),
      ownerOptions: league.members.map((member) => ({
        userId: member.userId,
        displayName: member.user.displayName,
        email: member.user.email
      })),
      continuitySummary: {
        longestOwnershipStreak: longestStreak
          ? {
              ownerDisplayName: longestStreak.displayName,
              teamAbbreviation: longestStreak.teamAbbreviation,
              streakLength: longestStreak.length
            }
          : null,
        mostFrequentlyOwnedTeam: mostFrequentlyOwnedTeam
          ? {
              teamAbbreviation: mostFrequentlyOwnedTeam[0],
              ownershipCount: mostFrequentlyOwnedTeam[1]
            }
          : null,
        mostFrequentlyChangingTeam:
          mostFrequentlyChangingTeam && mostFrequentlyChangingTeamRecord
            ? {
                teamAbbreviation: mostFrequentlyChangingTeamRecord.abbreviation,
                transitionCount: mostFrequentlyChangingTeam[1]
              }
            : null
      },
      deferredMetrics: buildDeferredMetrics()
    };
  },

  async getSeasonHistory(leagueId: string): Promise<HistorySeasonSummary[]> {
    const { seasons, drafts } = await getLeagueHistoryContext(leagueId);
    const draftBySeasonId = buildDraftLookupByTargetSeasonId(drafts);

    return seasons.map((season) => {
      const draft = draftBySeasonId.get(season.id);
      const assignedTeamCount = season.teamOwnerships.length;

      return {
        seasonId: season.id,
        year: season.year,
        name: season.name,
        status: season.status,
        isLocked: season.isLocked,
        assignedTeamCount,
        unassignedTeamCount: Math.max(32 - assignedTeamCount, 0),
        ownershipRecordCount: assignedTeamCount,
        hasDraft: Boolean(draft),
        draftStatus: draft?.status ?? null,
        keeperCount: draft?.keeperSelections.length ?? 0,
        pickCount: draft?.picks.filter((pick) => Boolean(pick.selectedNflTeamId)).length ?? 0,
        historicalDataAvailable: {
          ownership: assignedTeamCount > 0,
          draft: Boolean(draft)
        }
      };
    });
  },

  async getFranchiseHistory(leagueId: string, nflTeamId: string): Promise<FranchiseHistorySummary> {
    const normalizedTeamId = nflTeamId.trim();

    if (!normalizedTeamId) {
      throw new HistoryServiceError("nflTeamId is required.", 400);
    }

    const { seasons, drafts, teams } = await getLeagueHistoryContext(leagueId);
    const franchise = teams.find((team) => team.id === normalizedTeamId);

    if (!franchise) {
      throw new HistoryServiceError("NFL team not found.", 404);
    }

    const resolveAcquisition = buildAcquisitionTypeResolver(drafts);
    const rows = seasons
      .flatMap((season) =>
        season.teamOwnerships
          .filter((ownership) => ownership.nflTeamId === normalizedTeamId)
          .map((ownership) => {
            const acquisition = resolveAcquisition(season.id, ownership.leagueMemberId, ownership.nflTeamId);

            return {
              seasonId: season.id,
              seasonYear: season.year,
              seasonName: season.name,
              ownerUserId: ownership.leagueMember.userId,
              ownerDisplayName: ownership.leagueMember.user.displayName,
              ownerEmail: ownership.leagueMember.user.email,
              acquisitionType: acquisition.acquisitionType,
              slot: ownership.slot,
              draftPickNumber: acquisition.draftPickNumber
            };
          })
      )
      .sort((left, right) => right.seasonYear - left.seasonYear);

    const streaks = computeTeamStreaks(
      rows.map((row) => ({
        seasonYear: row.seasonYear,
        userId: row.ownerUserId,
        displayName: row.ownerDisplayName,
        teamId: normalizedTeamId,
        teamAbbreviation: franchise.abbreviation
      }))
    );
    const longestStreak = [...streaks].sort((left, right) => right.length - left.length)[0] ?? null;
    const chronologicalRows = [...rows].sort((left, right) => left.seasonYear - right.seasonYear);
    let ownershipTransitions = 0;

    for (let index = 1; index < chronologicalRows.length; index += 1) {
      if (chronologicalRows[index].ownerUserId !== chronologicalRows[index - 1].ownerUserId) {
        ownershipTransitions += 1;
      }
    }

    return {
      franchise: {
        nflTeamId: franchise.id,
        name: franchise.name,
        abbreviation: franchise.abbreviation,
        conference: franchise.conference,
        division: franchise.division
      },
      rows,
      analytics: {
        seasonsOwned: rows.length,
        distinctOwners: new Set(rows.map((row) => row.ownerUserId)).size,
        longestContinuousStreak: longestStreak
          ? {
              ownerDisplayName: longestStreak.displayName,
              length: longestStreak.length,
              startSeasonYear: longestStreak.startSeasonYear,
              endSeasonYear: longestStreak.endSeasonYear
            }
          : null,
        ownershipTransitions,
        timesKept: rows.filter((row) => row.acquisitionType === "KEEPER").length,
        timesDrafted: rows.filter((row) => row.acquisitionType === "DRAFT").length,
        currentOwner: rows[0]
          ? {
              ownerDisplayName: rows[0].ownerDisplayName,
              seasonYear: rows[0].seasonYear
            }
          : null
      }
    };
  },

  async getOwnerHistory(leagueId: string, userId: string): Promise<OwnerHistorySummary> {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      throw new HistoryServiceError("userId is required.", 400);
    }

    const { league, seasons, drafts } = await getLeagueHistoryContext(leagueId);
    const owner = league.members.find((member) => member.userId === normalizedUserId)?.user;

    if (!owner) {
      throw new HistoryServiceError("Owner not found in this league.", 404);
    }

    const resolveAcquisition = buildAcquisitionTypeResolver(drafts);
    const ownerRows = seasons
      .map((season) => {
        const teams = season.teamOwnerships
          .filter((ownership) => ownership.leagueMember.userId === normalizedUserId)
          .map((ownership) => {
            const acquisition = resolveAcquisition(season.id, ownership.leagueMemberId, ownership.nflTeamId);

            return {
              team: mapTeam(ownership.nflTeam),
              slot: ownership.slot,
              acquisitionType: acquisition.acquisitionType,
              draftPickNumber: acquisition.draftPickNumber
            };
          })
          .sort((left, right) => left.slot - right.slot);

        return {
          seasonId: season.id,
          seasonYear: season.year,
          seasonName: season.name,
          teams
        };
      })
      .filter((row) => row.teams.length > 0)
      .sort((left, right) => right.seasonYear - left.seasonYear);

    const streaks = computeTeamStreaks(
      ownerRows.flatMap((row) =>
        row.teams.map((entry) => ({
          seasonYear: row.seasonYear,
          userId: normalizedUserId,
          displayName: owner.displayName,
          teamId: entry.team.id,
          teamAbbreviation: entry.team.abbreviation
        }))
      )
    );
    const longestStreak = [...streaks].sort((left, right) => right.length - left.length)[0] ?? null;

    return {
      owner: {
        userId: owner.id,
        displayName: owner.displayName,
        email: owner.email
      },
      rows: ownerRows,
      analytics: {
        totalSeasonsParticipated: ownerRows.length,
        totalDistinctTeamsControlled: new Set(
          ownerRows.flatMap((row) => row.teams.map((entry) => entry.team.id))
        ).size,
        totalKeeperSelections: drafts.reduce(
          (total, draft) =>
            total + draft.keeperSelections.filter((selection) => selection.leagueMember.userId === normalizedUserId).length,
          0
        ),
        totalDraftedTeamsAcquired: drafts.reduce(
          (total, draft) =>
            total +
            draft.picks.filter(
              (pick) => pick.selectingLeagueMember.userId === normalizedUserId && Boolean(pick.selectedNflTeamId)
            ).length,
          0
        ),
        longestTeamTenure: longestStreak
          ? {
              teamAbbreviation: longestStreak.teamAbbreviation,
              length: longestStreak.length,
              startSeasonYear: longestStreak.startSeasonYear,
              endSeasonYear: longestStreak.endSeasonYear
            }
          : null,
        currentPortfolio: ownerRows[0]?.teams.map((entry) => entry.team) ?? []
      }
    };
  },

  async getDraftHistory(leagueId: string): Promise<DraftHistorySeasonSummary[]> {
    const { drafts } = await getLeagueHistoryContext(leagueId);

    return drafts.map((draft) => ({
      draftId: draft.id,
      targetSeasonId: draft.targetSeasonId,
      targetSeasonYear: draft.targetSeason.year,
      targetSeasonName: draft.targetSeason.name,
      sourceSeasonId: draft.sourceSeasonId,
      sourceSeasonYear: draft.sourceSeason.year,
      sourceSeasonName: draft.sourceSeason.name,
      status: draft.status,
      keeperCount: draft.keeperSelections.length,
      picksCompleted: draft.picks.filter((pick) => Boolean(pick.selectedNflTeamId)).length,
      completedAt: draft.completedAt?.toISOString() ?? null,
      keepers: draft.keeperSelections.map((keeper) => ({
        ownerDisplayName: keeper.leagueMember.user.displayName,
        team: mapTeam(keeper.nflTeam)
      })),
      picks: draft.picks.map((pick) => ({
        overallPickNumber: pick.overallPickNumber,
        ownerDisplayName: pick.selectingLeagueMember.user.displayName,
        team: pick.selectedNflTeam ? mapTeam(pick.selectedNflTeam) : null,
        pickedAt: pick.pickedAt?.toISOString() ?? null
      }))
    }));
  },

  async getLeagueAnalyticsSummary(leagueId: string): Promise<LeagueAnalyticsSummary> {
    const { league, seasons, drafts, teams } = await getLeagueHistoryContext(leagueId);

    const ownershipRows = seasons.flatMap((season) =>
      season.teamOwnerships.map((ownership) => ({
        seasonYear: season.year,
        seasonId: season.id,
        userId: ownership.leagueMember.userId,
        displayName: ownership.leagueMember.user.displayName,
        teamId: ownership.nflTeamId,
        teamName: ownership.nflTeam.name,
        teamAbbreviation: ownership.nflTeam.abbreviation
      }))
    );
    const streaks = computeTeamStreaks(
      ownershipRows.map((row) => ({
        seasonYear: row.seasonYear,
        userId: row.userId,
        displayName: row.displayName,
        teamId: row.teamId,
        teamAbbreviation: row.teamAbbreviation
      }))
    );

    const teamOwnershipCount = new Map<string, number>();
    const teamOwnershipBySeasons = new Map<string, Array<{ seasonYear: number; userId: string }>>();
    const teamKeepCount = new Map<string, number>();
    const teamDraftCount = new Map<string, number>();
    const ownerDistinctTeams = new Map<string, Set<string>>();
    const ownerKeepCount = new Map<string, number>();
    const ownerDraftCount = new Map<string, number>();

    for (const row of ownershipRows) {
      teamOwnershipCount.set(row.teamId, (teamOwnershipCount.get(row.teamId) ?? 0) + 1);
      const teamBucket = teamOwnershipBySeasons.get(row.teamId) ?? [];
      teamBucket.push({
        seasonYear: row.seasonYear,
        userId: row.userId
      });
      teamOwnershipBySeasons.set(row.teamId, teamBucket);

      const ownerTeams = ownerDistinctTeams.get(row.userId) ?? new Set<string>();
      ownerTeams.add(row.teamId);
      ownerDistinctTeams.set(row.userId, ownerTeams);
    }

    for (const draft of drafts) {
      for (const keeper of draft.keeperSelections) {
        teamKeepCount.set(keeper.nflTeamId, (teamKeepCount.get(keeper.nflTeamId) ?? 0) + 1);
        ownerKeepCount.set(
          keeper.leagueMember.userId,
          (ownerKeepCount.get(keeper.leagueMember.userId) ?? 0) + 1
        );
      }

      for (const pick of draft.picks) {
        if (!pick.selectedNflTeamId) {
          continue;
        }

        teamDraftCount.set(pick.selectedNflTeamId, (teamDraftCount.get(pick.selectedNflTeamId) ?? 0) + 1);
        ownerDraftCount.set(
          pick.selectingLeagueMember.userId,
          (ownerDraftCount.get(pick.selectingLeagueMember.userId) ?? 0) + 1
        );
      }
    }

    const teamTransitionCount = new Map<string, number>();
    for (const [teamId, rows] of teamOwnershipBySeasons.entries()) {
      const sortedRows = rows.sort((left, right) => left.seasonYear - right.seasonYear);
      let transitions = 0;

      for (let index = 1; index < sortedRows.length; index += 1) {
        if (sortedRows[index].userId !== sortedRows[index - 1].userId) {
          transitions += 1;
        }
      }

      teamTransitionCount.set(teamId, transitions);
    }

    const ownerByUserId = new Map(
      league.members.map((member) => [member.userId, member.user.displayName] as const)
    );
    const teamById = new Map(teams.map((team) => [team.id, team] as const));

    const mapTeamEntries = (
      source: Map<string, number>,
      supportingFormatter: (team: HistoryFranchiseOption, count: number) => string
    ): AnalyticsLeaderboardEntry[] =>
      [...source.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .flatMap(([teamId, count]) => {
          const team = teamById.get(teamId);

          if (!team) {
            return [];
          }

          const summary: HistoryFranchiseOption = {
            nflTeamId: team.id,
            name: team.name,
            abbreviation: team.abbreviation,
            conference: team.conference,
            division: team.division
          };

          return [
            {
              label: `${team.abbreviation} - ${team.name}`,
              value: formatLeaderboardValue(count, "season"),
              supportingText: supportingFormatter(summary, count)
            }
          ];
        });

    const mapOwnerEntries = (
      source: Map<string, number>,
      noun: string
    ): AnalyticsLeaderboardEntry[] =>
      [...source.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([userId, count]) => ({
          label: ownerByUserId.get(userId) ?? userId,
          value: formatLeaderboardValue(count, noun),
          supportingText: `Based on league history tracked so far.`
        }));

    return {
      franchiseLeaderboards: {
        longestOwnershipStreak: [...streaks]
          .sort((left, right) => right.length - left.length)
          .slice(0, 5)
          .map((streak) => ({
            label: `${streak.displayName} - ${streak.teamAbbreviation}`,
            value: formatLeaderboardValue(streak.length, "season"),
            supportingText: `${streak.startSeasonYear} to ${streak.endSeasonYear}`
          })),
        mostFrequentlyOwned: mapTeamEntries(
          teamOwnershipCount,
          (_team, count) => `Appeared in ${formatLeaderboardValue(count, "owner-season")} portfolios.`
        ),
        mostFrequentlyChanging: mapTeamEntries(
          teamTransitionCount,
          (_team, count) => `${formatLeaderboardValue(count, "owner transition")} across tracked seasons.`
        ),
        mostKept: mapTeamEntries(
          teamKeepCount,
          (_team, count) => `Kept ${formatLeaderboardValue(count, "time")} in offseason drafts.`
        ),
        mostDrafted: mapTeamEntries(
          teamDraftCount,
          (_team, count) => `Drafted ${formatLeaderboardValue(count, "time")} in offseason drafts.`
        )
      },
      ownerLeaderboards: {
        widestFranchiseHistory: [...ownerDistinctTeams.entries()]
          .sort((left, right) => right[1].size - left[1].size)
          .slice(0, 5)
          .map(([userId, teamsOwned]) => ({
            label: ownerByUserId.get(userId) ?? userId,
            value: formatLeaderboardValue(teamsOwned.size, "franchise"),
            supportingText: "Distinct NFL teams controlled across league history."
          })),
        longestFranchiseTenure: [...streaks]
          .sort((left, right) => right.length - left.length)
          .slice(0, 5)
          .map((streak) => ({
            label: streak.displayName,
            value: `${streak.teamAbbreviation} for ${formatLeaderboardValue(streak.length, "season")}`,
            supportingText: `${streak.startSeasonYear} to ${streak.endSeasonYear}`
          })),
        mostKeeperSelections: mapOwnerEntries(ownerKeepCount, "keeper"),
        mostDraftedAcquisitions: mapOwnerEntries(ownerDraftCount, "drafted team")
      },
      deferredMetrics: buildDeferredMetrics()
    };
  }
};

export { HistoryServiceError };
