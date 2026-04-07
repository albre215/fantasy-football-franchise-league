import { Prisma } from "@prisma/client";

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
      select: {
        id: true,
        name: true,
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
    }),
    prisma.season.findMany({
      where: { leagueId: normalizedLeagueId },
      select: {
        id: true,
        year: true,
        name: true,
        teamOwnerships: {
          select: {
            nflTeamId: true,
            nflTeam: true,
            leagueMember: {
              select: {
                id: true,
                userId: true,
                user: true
              }
            }
          },
          orderBy: [{ slot: "asc" }, { createdAt: "asc" }]
        },
        seasonStandings: {
          select: {
            leagueMemberId: true,
            rank: true,
            isChampion: true,
            wins: true,
            losses: true,
            ties: true,
            leagueMember: {
              select: {
                id: true,
                userId: true,
                user: true
              }
            }
          },
          orderBy: [{ rank: "asc" }, { updatedAt: "asc" }]
        },
        ledgerEntries: {
          select: {
            leagueMemberId: true,
            category: true,
            amount: true
          }
        },
        nflTeamResults: {
          select: {
            nflTeamId: true,
            leagueMemberId: true,
            phase: true,
            result: true
          }
        }
      },
      orderBy: { year: "desc" }
    }),
    prisma.draft.findMany({
      where: { leagueId: normalizedLeagueId },
      include: {
        sourceSeason: {
          select: {
            id: true,
            year: true,
            name: true
          }
        },
        targetSeason: {
          select: {
            id: true,
            year: true,
            name: true
          }
        },
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

function decimalToNumber(value: Prisma.Decimal | number | string) {
  return Number(new Prisma.Decimal(value).toFixed(2));
}

// Winning percentage definition used across fantasy and NFL analytics:
// (wins + 0.5 * ties) / total games.
// Null means the metric is unavailable because no games were recorded.
function calculateRate(wins: number, losses: number, ties: number) {
  const total = wins + losses + ties;

  if (total === 0) {
    return null;
  }

  return Number(((wins + ties * 0.5) / total).toFixed(3));
}

function buildSeasonLedgerTotalsByMember(
  entries: Array<{
    leagueMemberId: string;
    amount: Prisma.Decimal;
  }>
) {
  // Season ledger total:
  // Sum of every posted LedgerEntry amount for one league member within
  // one season. Analytics intentionally use the ledger as the financial
  // source of truth, so all persisted categories are included.
  const totals = new Map<string, number>();

  for (const entry of entries) {
    totals.set(
      entry.leagueMemberId,
      Number(((totals.get(entry.leagueMemberId) ?? 0) + decimalToNumber(entry.amount)).toFixed(2))
    );
  }

  return totals;
}

function buildSeasonNflTotalsByMember(
  results: Array<{
    leagueMemberId: string | null;
    phase: "REGULAR_SEASON" | "WILD_CARD" | "DIVISIONAL" | "CONFERENCE" | "SUPER_BOWL";
    result: "WIN" | "LOSS" | "TIE";
  }>
) {
  // Owner NFL totals:
  // Aggregate persisted SeasonNflTeamResult rows by owning league member.
  // This powers read-only analytics for NFL win rates and team performance.
  const totals = new Map<
    string,
    { wins: number; losses: number; ties: number; regularSeasonWins: number; playoffWins: number }
  >();

  for (const row of results) {
    if (!row.leagueMemberId) {
      continue;
    }

    const current = totals.get(row.leagueMemberId) ?? {
      wins: 0,
      losses: 0,
      ties: 0,
      regularSeasonWins: 0,
      playoffWins: 0
    };

    if (row.result === "WIN") {
      current.wins += 1;
      if (row.phase === "REGULAR_SEASON") {
        current.regularSeasonWins += 1;
      } else {
        current.playoffWins += 1;
      }
    } else if (row.result === "LOSS") {
      current.losses += 1;
    } else {
      current.ties += 1;
    }

    totals.set(row.leagueMemberId, current);
  }

  return totals;
}

export const analyticsService = {
  async getLeagueOverview(leagueId: string): Promise<LeagueOverviewAnalytics> {
    const { league, seasons } = await getLeagueAnalyticsContext(leagueId);
    const teamById = new Map(
      seasons.flatMap((season) =>
        season.teamOwnerships.map((ownership) => [ownership.nflTeamId, ownership.nflTeam] as const)
      )
    );

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

    // Champion metrics:
    // A season champion comes from the first saved standing flagged as
    // isChampion, or rank 1 when that explicit flag is absent.
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
    // Career earnings metrics:
    // Sum of posted season ledger totals by owner across all tracked seasons.
    const ownerEarnings = new Map<string, { ownerUserId: string; ownerDisplayName: string; totalEarnings: number }>();
    const seasonSummaries = seasons.map((season) => {
      const ledgerTotals = buildSeasonLedgerTotalsByMember(season.ledgerEntries);
      const totalsWithNames = league.members
        .map((member) => ({
          ownerUserId: member.userId,
          ownerDisplayName: member.user.displayName,
          amount: ledgerTotals.get(member.id) ?? 0
        }))
        .sort((left, right) => {
          if (right.amount !== left.amount) {
            return right.amount - left.amount;
          }

          return left.ownerDisplayName.localeCompare(right.ownerDisplayName);
        });

      for (const row of totalsWithNames) {
        const current = ownerEarnings.get(row.ownerUserId) ?? {
          ownerUserId: row.ownerUserId,
          ownerDisplayName: row.ownerDisplayName,
          totalEarnings: 0
        };
        current.totalEarnings = Number((current.totalEarnings + row.amount).toFixed(2));
        ownerEarnings.set(row.ownerUserId, current);
      }

      // totalLeaguePayouts:
      // Net posted ledger total for this season across all persisted categories.
      const totalLeaguePayouts = Number(
        season.ledgerEntries.reduce((total, entry) => total + decimalToNumber(entry.amount), 0).toFixed(2)
      );
      const biggestWinner = totalsWithNames[0] ?? null;
      const biggestLoser = totalsWithNames[totalsWithNames.length - 1] ?? null;
      // parityGap:
      // Spread between the highest and lowest owner season ledger totals.
      const parityGap =
        biggestWinner && biggestLoser ? Number((biggestWinner.amount - biggestLoser.amount).toFixed(2)) : null;

      return {
        seasonId: season.id,
        seasonYear: season.year,
        seasonName: season.name,
        totalLeaguePayouts,
        biggestWinner: biggestWinner
          ? {
              ownerUserId: biggestWinner.ownerUserId,
              ownerDisplayName: biggestWinner.ownerDisplayName,
              amount: biggestWinner.amount
            }
          : null,
        biggestLoser: biggestLoser
          ? {
              ownerUserId: biggestLoser.ownerUserId,
              ownerDisplayName: biggestLoser.ownerDisplayName,
              amount: biggestLoser.amount
            }
          : null,
        parityGap
      };
    });
    // totalLeaguePayouts:
    // Sum of every season's net ledger total across the league history.
    const totalLeaguePayouts = Number(
      seasonSummaries.reduce((total, season) => total + season.totalLeaguePayouts, 0).toFixed(2)
    );
    // averageSeasonParityGap:
    // Average parity gap across seasons with ledger totals.
    const averageSeasonParityGap =
      seasonSummaries.length > 0
        ? Number(
            (
              seasonSummaries.reduce((total, season) => total + (season.parityGap ?? 0), 0) / seasonSummaries.length
            ).toFixed(2)
          )
        : null;
    const rankedEarnings = [...ownerEarnings.values()].sort((left, right) => {
      if (right.totalEarnings !== left.totalEarnings) {
        return right.totalEarnings - left.totalEarnings;
      }

      return left.ownerDisplayName.localeCompare(right.ownerDisplayName);
    });

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
      totalLeaguePayouts,
      averageSeasonParityGap,
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
          : null,
      biggestCareerWinner: rankedEarnings[0] ?? null,
      biggestCareerLoser: rankedEarnings.length > 0 ? rankedEarnings[rankedEarnings.length - 1] : null,
      seasonSummaries
    };
  },

  async getFranchiseAnalytics(leagueId: string): Promise<FranchiseAnalytics> {
    const { league, seasons, drafts, teams } = await getLeagueAnalyticsContext(leagueId);
    const resolveAcquisition = buildAcquisitionTypeResolver(drafts);
    const teamById = new Map(teams.map((team) => [team.id, team] as const));
    // Franchise performance metrics use only persisted NFL team results.
    const teamNflStats = new Map<
      string,
      { regularSeasonWins: number; playoffWins: number; totalNflLedgerAmount: number; seasonsTracked: Set<string> }
    >();

    for (const season of seasons) {
      for (const result of season.nflTeamResults) {
        const current = teamNflStats.get(result.nflTeamId) ?? {
          regularSeasonWins: 0,
          playoffWins: 0,
          totalNflLedgerAmount: 0,
          seasonsTracked: new Set<string>()
        };

        if (result.result === "WIN") {
          if (result.phase === "REGULAR_SEASON") {
            current.regularSeasonWins += 1;
            current.totalNflLedgerAmount = Number((current.totalNflLedgerAmount + 1).toFixed(2));
          } else {
            current.playoffWins += 1;
            current.totalNflLedgerAmount = Number((current.totalNflLedgerAmount + 1).toFixed(2));
          }
        }

        current.seasonsTracked.add(season.id);
        teamNflStats.set(result.nflTeamId, current);
      }
    }

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
            // totalRegularSeasonWins / totalPlayoffWins:
            // Historical persisted win counts for this franchise by phase.
            totalRegularSeasonWins: teamNflStats.get(teamId)?.regularSeasonWins ?? 0,
            totalPlayoffWins: teamNflStats.get(teamId)?.playoffWins ?? 0,
            // totalNflLedgerAmount:
            // Analytics mirror of the current NFL posting formula:
            // one unit per persisted regular-season or playoff win.
            totalNflLedgerAmount: teamNflStats.get(teamId)?.totalNflLedgerAmount ?? 0,
            // averageNflLedgerAmountPerSeason:
            // Average NFL-derived ledger amount across seasons where the team
            // has persisted NFL results.
            averageNflLedgerAmountPerSeason:
              (teamNflStats.get(teamId)?.seasonsTracked.size ?? 0) > 0
                ? Number(
                    (
                      (teamNflStats.get(teamId)?.totalNflLedgerAmount ?? 0) /
                      (teamNflStats.get(teamId)?.seasonsTracked.size ?? 1)
                    ).toFixed(2)
                  )
                : null,
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
    // mostProfitableTeams:
    // Franchises ranked by cumulative NFL-derived ledger amount.
    const mostProfitableTeams = [...franchises]
      .sort((left, right) => {
        if (right.totalNflLedgerAmount !== left.totalNflLedgerAmount) {
          return right.totalNflLedgerAmount - left.totalNflLedgerAmount;
        }

        return left.team.name.localeCompare(right.team.name);
      })
      .slice(0, 8)
      .map((entry) => ({
        team: entry.team,
        totalNflLedgerAmount: entry.totalNflLedgerAmount,
        averageNflLedgerAmountPerSeason: entry.averageNflLedgerAmountPerSeason
      }));
    // bestHistoricalTeams:
    // Franchises ranked by total persisted wins across all phases.
    const bestHistoricalTeams = [...franchises]
      .sort((left, right) => {
        const rightWins = right.totalRegularSeasonWins + right.totalPlayoffWins;
        const leftWins = left.totalRegularSeasonWins + left.totalPlayoffWins;

        if (rightWins !== leftWins) {
          return rightWins - leftWins;
        }

        return left.team.name.localeCompare(right.team.name);
      })
      .slice(0, 8)
      .map((entry) => ({
        team: entry.team,
        totalWins: entry.totalRegularSeasonWins + entry.totalPlayoffWins,
        regularSeasonWins: entry.totalRegularSeasonWins,
        playoffWins: entry.totalPlayoffWins
      }));

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
      mostProfitableTeams,
      mostProfitableTeamsChart: toChartData(
        mostProfitableTeams.map((entry) => ({
          key: entry.team.id,
          label: entry.team.abbreviation,
          value: entry.totalNflLedgerAmount
        }))
      ),
      bestHistoricalTeams,
      bestHistoricalTeamsChart: toChartData(
        bestHistoricalTeams.map((entry) => ({
          key: entry.team.id,
          label: entry.team.abbreviation,
          value: entry.totalWins
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
        // seasonMemberIdBySeasonId:
        // Resolve the season-scoped member id for this owner, preferring the
        // final standings record and falling back to ownership when needed.
        const seasonMemberIdBySeasonId = new Map(
          seasons.map((season) => {
            const standingMemberId =
              season.seasonStandings.find((standing) => standing.leagueMember.userId === owner.ownerUserId)?.leagueMemberId ??
              null;
            const ownershipMemberId =
              season.teamOwnerships.find((ownership) => ownership.leagueMember.userId === owner.ownerUserId)?.leagueMember.id ??
              null;

            return [season.id, standingMemberId ?? ownershipMemberId] as const;
          })
        );
        const ledgerTotalBySeasonId = new Map(
          seasons.map((season) => [
            season.id,
            seasonMemberIdBySeasonId.get(season.id)
              ? (buildSeasonLedgerTotalsByMember(season.ledgerEntries).get(seasonMemberIdBySeasonId.get(season.id)!) ?? 0)
              : 0
          ] as const)
        );
        const standingBySeasonId = new Map(
          seasons.flatMap((season) =>
            season.seasonStandings
              .filter((standing) => standing.leagueMember.userId === owner.ownerUserId)
              .map((standing) => [season.id, standing] as const)
          )
        );
        const nflTotalsBySeasonId = new Map(
          seasons.map((season) => [season.id, buildSeasonNflTotalsByMember(season.nflTeamResults)] as const)
        );
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
          .filter((row) => row.teams.length > 0 || standingBySeasonId.has(row.seasonId) || (ledgerTotalBySeasonId.get(row.seasonId) ?? 0) !== 0)
          .sort((left, right) => right.seasonYear - left.seasonYear);
        // performanceTrend:
        // One analytics row per season where this owner had ownership,
        // standings, or ledger participation. This is the canonical source for
        // owner earnings, average finish, and average win-rate metrics.
        const performanceTrend = seasonsForOwner
          .map((season) => {
            const standing = standingBySeasonId.get(season.seasonId) ?? null;
            const seasonMemberId = seasonMemberIdBySeasonId.get(season.seasonId) ?? null;
            const nflTotals = seasonMemberId
              ? nflTotalsBySeasonId.get(season.seasonId)?.get(seasonMemberId) ?? null
              : null;
            const fantasyWinRate =
              standing && standing.wins !== null && standing.losses !== null && standing.ties !== null
                ? calculateRate(standing.wins, standing.losses, standing.ties)
                : null;
            const nflWinRate = nflTotals
              ? calculateRate(nflTotals.wins, nflTotals.losses, nflTotals.ties)
              : null;

            return {
              seasonId: season.seasonId,
              seasonYear: season.seasonYear,
              seasonName: season.seasonName,
              ledgerTotal: ledgerTotalBySeasonId.get(season.seasonId) ?? 0,
              finish: standing?.rank ?? null,
              fantasyWinRate,
              nflWinRate
            };
          })
          .sort((left, right) => left.seasonYear - right.seasonYear);

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
          // totalEarnings:
          // Sum of season ledger totals across the owner's tracked seasons.
          totalEarnings: Number(performanceTrend.reduce((total, row) => total + row.ledgerTotal, 0).toFixed(2)),
          // averageFinish:
          // Average final standing rank across seasons where a saved finish exists.
          averageFinish:
            performanceTrend.filter((row) => row.finish !== null).length > 0
              ? Number(
                  (
                    performanceTrend.reduce((total, row) => total + (row.finish ?? 0), 0) /
                    performanceTrend.filter((row) => row.finish !== null).length
                  ).toFixed(2)
                )
              : null,
          // fantasyWinRate:
          // Average of per-season fantasy winning percentages derived from
          // saved SeasonStanding wins/losses/ties.
          fantasyWinRate:
            performanceTrend.filter((row) => row.fantasyWinRate !== null).length > 0
              ? Number(
                  (
                    performanceTrend.reduce((total, row) => total + (row.fantasyWinRate ?? 0), 0) /
                    performanceTrend.filter((row) => row.fantasyWinRate !== null).length
                  ).toFixed(3)
                )
              : null,
          // nflWinRate:
          // Average of per-season NFL winning percentages derived from
          // persisted SeasonNflTeamResult rows tied to this owner's teams.
          nflWinRate:
            performanceTrend.filter((row) => row.nflWinRate !== null).length > 0
              ? Number(
                  (
                    performanceTrend.reduce((total, row) => total + (row.nflWinRate ?? 0), 0) /
                    performanceTrend.filter((row) => row.nflWinRate !== null).length
                  ).toFixed(3)
                )
              : null,
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
          performanceTrend,
          earningsTrendChart: toChartData(
            performanceTrend.map((entry) => ({
              key: entry.seasonId,
              label: String(entry.seasonYear),
              value: entry.ledgerTotal
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
      totalEarningsChart: toChartData(
        owners
          .slice()
          .sort((left, right) => right.totalEarnings - left.totalEarnings)
          .slice(0, 8)
          .map((owner) => ({
            key: owner.ownerUserId,
            label: owner.ownerDisplayName,
            value: owner.totalEarnings
          }))
      ),
      averageFinishChart: toChartData(
        owners
          .slice()
          .filter((owner) => owner.averageFinish !== null)
          .sort((left, right) => (left.averageFinish ?? 999) - (right.averageFinish ?? 999))
          .slice(0, 8)
          .map((owner) => ({
            key: owner.ownerUserId,
            label: owner.ownerDisplayName,
            value: Number((11 - (owner.averageFinish ?? 10)).toFixed(2))
          }))
      ),
      owners
    };
  },

  async getDraftAnalytics(leagueId: string): Promise<DraftAnalytics> {
    const { league, drafts, teams, seasons } = await getLeagueAnalyticsContext(leagueId);
    const teamById = new Map(teams.map((team) => [team.id, team] as const));
    const standingsBySeasonId = new Map(seasons.map((season) => [season.id, season.seasonStandings] as const));
    const ledgerTotalsBySeasonId = new Map(
      seasons.map((season) => [season.id, buildSeasonLedgerTotalsByMember(season.ledgerEntries)] as const)
    );
    const nflResultStatsBySeasonAndTeam = new Map<
      string,
      Map<string, { regularSeasonWins: number; playoffWins: number; nflLedgerAmount: number }>
    >();

    const keepCountByTeam = new Map<string, number>();
    const draftPickStatsByTeam = new Map<string, { count: number; totalPickNumber: number }>();

    for (const season of seasons) {
      const byTeam = new Map<string, { regularSeasonWins: number; playoffWins: number; nflLedgerAmount: number }>();
      for (const result of season.nflTeamResults) {
        const current = byTeam.get(result.nflTeamId) ?? { regularSeasonWins: 0, playoffWins: 0, nflLedgerAmount: 0 };
        if (result.result === "WIN") {
          if (result.phase === "REGULAR_SEASON") {
            current.regularSeasonWins += 1;
          } else {
            current.playoffWins += 1;
          }
          current.nflLedgerAmount = Number((current.nflLedgerAmount + 1).toFixed(2));
        }
        byTeam.set(result.nflTeamId, current);
      }
      nflResultStatsBySeasonAndTeam.set(season.id, byTeam);
    }

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

    // mostDraftedTeams:
    // Frequency of non-keeper teams selected through replacement draft picks.
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

    // mostKeptTeams:
    // Frequency of explicit keeper selections recorded before the replacement draft.
    const mostKeptTeams = [...keepCountByTeam.entries()]
      .flatMap(([teamId, keepCount]) => {
        const team = teamById.get(teamId);
        return team ? [{ team: mapTeam(team), keepCount }] : [];
      })
      .sort((left, right) => right.keepCount - left.keepCount);
    const completedPickRows = drafts.flatMap((draft) =>
      draft.picks
        .filter((pick) => Boolean(pick.selectedNflTeamId))
        .map((pick) => {
          const targetStandings = standingsBySeasonId.get(draft.targetSeasonId) ?? [];
          const targetLedgerTotals = ledgerTotalsBySeasonId.get(draft.targetSeasonId) ?? new Map<string, number>();
          const standing = targetStandings.find(
            (entry) => entry.leagueMember.userId === pick.selectingLeagueMember.userId
          ) ?? null;

          return {
            draftId: draft.id,
            targetSeasonId: draft.targetSeasonId,
            targetSeasonYear: draft.targetSeason.year,
            targetSeasonName: draft.targetSeason.name,
            draftSlot: pick.overallPickNumber,
            ownerUserId: pick.selectingLeagueMember.userId,
            ownerDisplayName: pick.selectingLeagueMember.user.displayName,
            leagueMemberId: pick.selectingLeagueMemberId,
            selectedTeamId: pick.selectedNflTeamId!,
            selectedTeam: pick.selectedNflTeam ? mapTeam(pick.selectedNflTeam) : null,
            finalFinish: standing?.rank ?? null,
            finalLedgerTotal: targetLedgerTotals.get(pick.selectingLeagueMemberId) ?? null,
            selectedTeamStats:
              nflResultStatsBySeasonAndTeam.get(draft.targetSeasonId)?.get(pick.selectedNflTeamId!) ?? {
                regularSeasonWins: 0,
                playoffWins: 0,
                nflLedgerAmount: 0
              }
          };
        })
    );
    // draftSlotOutcomes:
    // Average target-season finish and full season ledger total by replacement
    // draft slot after the owner made that pick.
    const draftSlotOutcomes = [...new Set(completedPickRows.map((row) => row.draftSlot))]
      .sort((left, right) => left - right)
      .map((draftSlot) => {
        const rows = completedPickRows.filter((row) => row.draftSlot === draftSlot);
        const finishRows = rows.filter((row) => row.finalFinish !== null);
        const ledgerRows = rows.filter((row) => row.finalLedgerTotal !== null);

        return {
          draftSlot,
          averageFinish:
            finishRows.length > 0
              ? Number(
                  (finishRows.reduce((total, row) => total + (row.finalFinish ?? 0), 0) / finishRows.length).toFixed(2)
                )
              : null,
          averageLedgerTotal:
            ledgerRows.length > 0
              ? Number(
                  (ledgerRows.reduce((total, row) => total + (row.finalLedgerTotal ?? 0), 0) / ledgerRows.length).toFixed(2)
                )
              : null,
          sampleSize: rows.length
        };
      });
    // replacementDraftEffectiveness:
    // Draft-by-draft audit view pairing each replacement draft pick with the
    // owner's target-season outcome and the selected team's persisted NFL results.
    const replacementDraftEffectiveness = drafts
      .filter((draft) => draft.picks.some((pick) => Boolean(pick.selectedNflTeamId)))
      .slice(0, 6)
      .map((draft) => ({
        draftId: draft.id,
        targetSeasonId: draft.targetSeasonId,
        targetSeasonYear: draft.targetSeason.year,
        targetSeasonName: draft.targetSeason.name,
        entries: completedPickRows
          .filter((row) => row.draftId === draft.id)
          .sort((left, right) => left.draftSlot - right.draftSlot)
          .map((row) => ({
            draftSlot: row.draftSlot,
            ownerUserId: row.ownerUserId,
            ownerDisplayName: row.ownerDisplayName,
            selectedTeam: row.selectedTeam,
            finalFinish: row.finalFinish,
            finalLedgerTotal: row.finalLedgerTotal,
            selectedTeamRegularSeasonWins: row.selectedTeamStats.regularSeasonWins,
            selectedTeamPlayoffWins: row.selectedTeamStats.playoffWins,
            selectedTeamNflLedgerAmount: row.selectedTeamStats.nflLedgerAmount
          }))
      }));

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
      draftSlotOutcomes,
      draftSlotOutcomeChart: toChartData(
        draftSlotOutcomes.map((entry) => ({
          key: String(entry.draftSlot),
          label: `Pick ${entry.draftSlot}`,
          value: entry.averageLedgerTotal ?? 0
        }))
      ),
      replacementDraftEffectiveness,
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
