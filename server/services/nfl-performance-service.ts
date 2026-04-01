import {
  NflImportStatus,
  NflResultProvider,
  Prisma,
  SeasonNflGameResult,
  SeasonNflResultPhase
} from "@prisma/client";

import { normalizeNflTeamAbbreviation } from "@/lib/nfl-team-aliases";
import { prisma } from "@/lib/prisma";
import { nflResultsProviders } from "@/server/providers/nfl";
import type { NormalizedNflTeamResultRecord } from "@/server/providers/nfl/types";
import { NflPerformanceServiceError } from "@/server/services/nfl-performance-errors";
import {
  createSeasonWeekKey,
  getRegularSeasonWeekLimit,
  validateSeasonWeekPhase
} from "@/server/services/nfl-performance-helpers";
import { seasonService } from "@/server/services/season-service";
import type {
  ImportSeasonNflResultsInput,
  NflPerformanceOwnerSummary,
  NflPerformanceTeamSummary,
  OwnerNflRecordSummary,
  OwnerWeekPerformanceSummary,
  SeasonNflImportRunSummary,
  SeasonNflOverview,
  SeasonNflWeekOption,
  SeasonWeekNflResults,
  SeasonNflResultPhase as SeasonNflResultPhaseType,
  TeamWeekPerformanceSummary,
  UpsertSeasonWeekTeamResultInput
} from "@/types/nfl-performance";

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

function toNullableJsonInput(value: Record<string, unknown> | null | undefined) {
  return value === null || typeof value === "undefined"
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

function normalizeSeasonId(seasonId: string) {
  const normalized = seasonId.trim();

  if (!normalized) {
    throw new NflPerformanceServiceError("seasonId is required.", 400);
  }

  return normalized;
}

function normalizeActingUserId(actingUserId: string) {
  const normalized = actingUserId.trim();

  if (!normalized) {
    throw new NflPerformanceServiceError("actingUserId is required.", 400);
  }

  return normalized;
}

function normalizeWeekNumber(weekNumber: number) {
  if (!Number.isInteger(weekNumber) || weekNumber <= 0) {
    throw new NflPerformanceServiceError("A valid week number is required.", 400);
  }

  return weekNumber;
}

function normalizeOptionalScore(value: number | null | undefined) {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new NflPerformanceServiceError("Scores must be whole numbers greater than or equal to zero.", 400);
  }

  return value;
}

function mapPhaseLabel(phase: SeasonNflResultPhaseType, weekNumber: number) {
  switch (phase) {
    case "REGULAR_SEASON":
      return `Week ${weekNumber}`;
    case "WILD_CARD":
      return `Week ${weekNumber} - Wild Card`;
    case "DIVISIONAL":
      return `Week ${weekNumber} - Divisional`;
    case "CONFERENCE":
      return `Week ${weekNumber} - Conference`;
    case "SUPER_BOWL":
      return `Week ${weekNumber} - Super Bowl`;
    default:
      return `Week ${weekNumber}`;
  }
}

function comparePhase(left: SeasonNflResultPhaseType, right: SeasonNflResultPhaseType) {
  const order: Record<SeasonNflResultPhaseType, number> = {
    REGULAR_SEASON: 0,
    WILD_CARD: 1,
    DIVISIONAL: 2,
    CONFERENCE: 3,
    SUPER_BOWL: 4
  };

  return order[left] - order[right];
}

function compareWeekOption(left: SeasonNflWeekOption, right: SeasonNflWeekOption) {
  if (left.weekNumber !== right.weekNumber) {
    return left.weekNumber - right.weekNumber;
  }

  return comparePhase(left.phase, right.phase);
}

function mapOwner(member: {
  id: string;
  userId: string;
  role: "COMMISSIONER" | "OWNER";
  user: { displayName: string; email: string };
}): NflPerformanceOwnerSummary {
  return {
    leagueMemberId: member.id,
    userId: member.userId,
    displayName: member.user.displayName,
    email: member.user.email,
    role: member.role
  };
}

function mapTeam(team: { id: string; abbreviation: string; name: string }): NflPerformanceTeamSummary {
  return {
    nflTeamId: team.id,
    abbreviation: team.abbreviation,
    name: team.name
  };
}

function mapImportRun(run: {
  id: string;
  seasonId: string;
  seasonYear: number;
  provider: "MANUAL" | "NFLVERSE";
  mode: "FULL_SEASON" | "SINGLE_WEEK";
  weekNumber: number | null;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  actingUserId: string | null;
  importedResultCount: number;
  warnings: Prisma.JsonValue | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}): SeasonNflImportRunSummary {
  return {
    id: run.id,
    seasonId: run.seasonId,
    seasonYear: run.seasonYear,
    provider: run.provider,
    mode: run.mode,
    weekNumber: run.weekNumber,
    status: run.status,
    actingUserId: run.actingUserId,
    importedResultCount: run.importedResultCount,
    warnings: (run.warnings as Record<string, unknown> | null) ?? null,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null
  };
}

async function getSeasonContextOrThrow(tx: PrismaClientLike, seasonId: string) {
  const normalizedSeasonId = normalizeSeasonId(seasonId);
  const season = await tx.season.findUnique({
    where: { id: normalizedSeasonId },
    select: {
      id: true,
      leagueId: true,
      year: true,
      name: true,
      status: true,
      league: {
        select: {
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              user: {
                select: {
                  displayName: true,
                  email: true
                }
              }
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
          }
        }
      },
      teamOwnerships: {
        select: {
          nflTeamId: true,
          leagueMemberId: true,
          nflTeam: {
            select: {
              id: true,
              abbreviation: true,
              name: true
            }
          },
          leagueMember: {
            select: {
              id: true,
              userId: true,
              role: true,
              user: {
                select: {
                  displayName: true,
                  email: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!season) {
    throw new NflPerformanceServiceError("Season not found.", 404);
  }

  return season;
}

async function assertViewerMembershipForSeason(tx: PrismaClientLike, seasonId: string, actingUserId: string) {
  const season = await getSeasonContextOrThrow(tx, seasonId);
  const normalizedActingUserId = normalizeActingUserId(actingUserId);
  const membership = season.league.members.find((member) => member.userId === normalizedActingUserId) ?? null;

  if (!membership) {
    throw new NflPerformanceServiceError("Only league members can view NFL performance for this season.", 403);
  }

  return { season, membership };
}

async function getSeasonResults(tx: PrismaClientLike, seasonId: string, seasonYear: number) {
  return tx.seasonNflTeamResult.findMany({
    where: {
      seasonId,
      seasonYear
    },
    include: {
      nflTeam: true,
      opponentNflTeam: true,
      leagueMember: {
        include: { user: true }
      }
    },
    orderBy: [{ weekNumber: "desc" }, { phase: "desc" }, { nflTeam: { name: "asc" } }]
  });
}

async function getSeasonImportRuns(tx: PrismaClientLike, seasonId: string, seasonYear: number) {
  return tx.seasonNflImportRun.findMany({
    where: {
      seasonId,
      seasonYear
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: 8
  });
}

async function getRunningSeasonImportRun(tx: PrismaClientLike, seasonId: string) {
  return tx.seasonNflImportRun.findFirst({
    where: {
      seasonId,
      status: "RUNNING"
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }]
  });
}

function createEmptyOwnerRecord(member: {
  id: string;
  userId: string;
  role: "COMMISSIONER" | "OWNER";
  user: { displayName: string; email: string };
}): OwnerNflRecordSummary {
  return {
    ...mapOwner(member),
    wins: 0,
    losses: 0,
    ties: 0,
    regularSeasonWins: 0,
    playoffWins: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    teamCount: 0,
    resultCount: 0,
    netPoints: 0
  };
}

function buildOwnershipMaps(
  season: Awaited<ReturnType<typeof getSeasonContextOrThrow>>
) {
  const ownerByTeamId = new Map<
    string,
    {
      id: string;
      userId: string;
      role: "COMMISSIONER" | "OWNER";
      user: { displayName: string; email: string };
    }
  >();

  for (const ownership of season.teamOwnerships) {
    ownerByTeamId.set(ownership.nflTeamId, ownership.leagueMember);
  }

  return {
    ownerByTeamId
  };
}

function buildOwnerStandings(
  members: Array<{
    id: string;
    userId: string;
    role: "COMMISSIONER" | "OWNER";
    user: { displayName: string; email: string };
  }>,
  ownerships: Array<{ leagueMemberId: string; nflTeamId: string }>,
  results: Awaited<ReturnType<typeof getSeasonResults>>
) {
  const standingsByMemberId = new Map<string, OwnerNflRecordSummary>();
  const distinctTeamsByMemberId = new Map<string, Set<string>>();

  for (const member of members) {
    standingsByMemberId.set(member.id, createEmptyOwnerRecord(member));
  }

  for (const ownership of ownerships) {
    const bucket = distinctTeamsByMemberId.get(ownership.leagueMemberId) ?? new Set<string>();
    bucket.add(ownership.nflTeamId);
    distinctTeamsByMemberId.set(ownership.leagueMemberId, bucket);
  }

  for (const result of results) {
    const ownership = ownerships.find((entry) => entry.nflTeamId === result.nflTeamId);

    if (!ownership) {
      continue;
    }

    const current = standingsByMemberId.get(ownership.leagueMemberId);

    if (!current) {
      continue;
    }

    current.resultCount += 1;
    current.pointsFor += result.pointsFor ?? 0;
    current.pointsAgainst += result.pointsAgainst ?? 0;

    if (result.result === "WIN") {
      current.wins += 1;
      if (result.phase === "REGULAR_SEASON") {
        current.regularSeasonWins += 1;
      } else {
        current.playoffWins += 1;
      }
    } else if (result.result === "LOSS") {
      current.losses += 1;
    } else {
      current.ties += 1;
    }
  }

  return members
    .map((member) => {
      const record = standingsByMemberId.get(member.id) ?? createEmptyOwnerRecord(member);
      return {
        ...record,
        teamCount: distinctTeamsByMemberId.get(member.id)?.size ?? 0,
        netPoints: record.pointsFor - record.pointsAgainst
      };
    })
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      if (left.losses !== right.losses) {
        return left.losses - right.losses;
      }
      if (right.playoffWins !== left.playoffWins) {
        return right.playoffWins - left.playoffWins;
      }
      if (right.netPoints !== left.netPoints) {
        return right.netPoints - left.netPoints;
      }
      return left.displayName.localeCompare(right.displayName);
    });
}

function mapWeekResult(
  result: Awaited<ReturnType<typeof getSeasonResults>>[number],
  derivedOwner: NflPerformanceOwnerSummary | null
): TeamWeekPerformanceSummary {
  return {
    id: result.id,
    seasonId: result.seasonId,
    seasonYear: result.seasonYear,
    weekNumber: result.weekNumber,
    phase: result.phase,
    result: result.result,
    pointsFor: result.pointsFor,
    pointsAgainst: result.pointsAgainst,
    sourceProvider: result.sourceProvider,
    actingUserId: result.actingUserId,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    team: mapTeam(result.nflTeam),
    opponent: result.opponentNflTeam ? mapTeam(result.opponentNflTeam) : null,
    owner: derivedOwner
  };
}

function buildAvailableWeeks(
  results: Awaited<ReturnType<typeof getSeasonResults>>,
  importRuns: Awaited<ReturnType<typeof getSeasonImportRuns>>
) {
  const latestImportByWeekKey = new Map<string, string>();

  for (const run of importRuns) {
    if (run.completedAt) {
      const warningPayload = (run.warnings as { importedKeys?: string[] } | null) ?? null;
      const importedKeys = Array.isArray(warningPayload?.importedKeys) ? warningPayload.importedKeys : [];

      for (const key of importedKeys) {
        if (!latestImportByWeekKey.has(key)) {
          latestImportByWeekKey.set(key, run.completedAt.toISOString());
        }
      }
    }
  }

  const grouped = new Map<string, SeasonNflWeekOption>();

  for (const result of results) {
    const key = createSeasonWeekKey(result.weekNumber, result.phase);

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        weekNumber: result.weekNumber,
        phase: result.phase,
        label: mapPhaseLabel(result.phase, result.weekNumber),
        gameCount: 0,
        importedAt: latestImportByWeekKey.get(key) ?? null
      });
    }

    const current = grouped.get(key)!;
    current.gameCount += 1;
  }

  return Array.from(grouped.values()).sort((left, right) => {
    return compareWeekOption(left, right);
  });
}

function buildPlayoffHighlights(
  results: Awaited<ReturnType<typeof getSeasonResults>>,
  ownerByTeamId: Map<
    string,
    {
      id: string;
      userId: string;
      role: "COMMISSIONER" | "OWNER";
      user: { displayName: string; email: string };
    }
  >
) {
  return results
    .filter((result) => result.phase !== "REGULAR_SEASON" && result.result === "WIN")
    .sort((left, right) => {
      const phaseComparison = comparePhase(right.phase, left.phase);
      if (phaseComparison !== 0) {
        return phaseComparison;
      }
      return left.nflTeam.name.localeCompare(right.nflTeam.name);
    })
    .slice(0, 12)
    .map((result) => ({
      team: mapTeam(result.nflTeam),
      owner: ownerByTeamId.get(result.nflTeamId) ? mapOwner(ownerByTeamId.get(result.nflTeamId)!) : null,
      phase: result.phase,
      result: result.result
    }));
}

function buildSeasonOverviewFromContext(
  season: Awaited<ReturnType<typeof getSeasonContextOrThrow>>,
  results: Awaited<ReturnType<typeof getSeasonResults>>,
  importRuns: Awaited<ReturnType<typeof getSeasonImportRuns>>
): SeasonNflOverview {
  const availableWeeks = buildAvailableWeeks(results, importRuns);
  const { ownerByTeamId } = buildOwnershipMaps(season);
  const completedRuns = importRuns.filter((run) => run.status === "COMPLETED");
  const regularSeasonWeeks = new Set(availableWeeks.filter((week) => week.phase === "REGULAR_SEASON").map((week) => week.weekNumber));
  const playoffWeeks = new Set(availableWeeks.filter((week) => week.phase !== "REGULAR_SEASON").map((week) => week.weekNumber));
  const playoffPhases = Array.from(
    new Set(availableWeeks.filter((week) => week.phase !== "REGULAR_SEASON").map((week) => week.phase))
  ).sort(comparePhase);
  const hasCompletedFullSeasonImport = completedRuns.some((run) => run.mode === "FULL_SEASON");
  const coverageStatus = results.length === 0 ? "EMPTY" : hasCompletedFullSeasonImport ? "FULL_SEASON_IMPORTED" : "PARTIAL";

  return {
    season: {
      id: season.id,
      leagueId: season.leagueId,
      year: season.year,
      name: season.name,
      status: season.status
    },
    importState: {
      hasImportedResults: results.length > 0,
      totalImportedResults: results.length,
      importedWeekCount: availableWeeks.length,
      importedRegularSeasonWeeks: regularSeasonWeeks.size,
      importedPlayoffWeeks: playoffWeeks.size,
      importedRegularSeasonWeekNumbers: Array.from(regularSeasonWeeks).sort((left, right) => left - right),
      importedPlayoffPhases: playoffPhases,
      coverageStatus,
      hasCompletedFullSeasonImport,
      latestCompletedImport: completedRuns[0] ? mapImportRun(completedRuns[0]) : null,
      recentImports: importRuns.map(mapImportRun)
    },
    availableWeeks,
    ownerStandings: buildOwnerStandings(
      season.league.members,
      season.teamOwnerships.map((ownership) => ({
        leagueMemberId: ownership.leagueMemberId,
        nflTeamId: ownership.nflTeamId
      })),
      results
    ),
    playoffHighlights: buildPlayoffHighlights(results, ownerByTeamId)
  };
}

function buildWeekResults(
  season: Awaited<ReturnType<typeof getSeasonContextOrThrow>>,
  allResults: Awaited<ReturnType<typeof getSeasonResults>>,
  importRuns: Awaited<ReturnType<typeof getSeasonImportRuns>>,
  weekNumber: number,
  phase?: SeasonNflResultPhaseType
): SeasonWeekNflResults {
  const seasonOverview = buildSeasonOverviewFromContext(season, allResults, importRuns);
  const { ownerByTeamId } = buildOwnershipMaps(season);
  const weekResults = allResults.filter(
    (result) => result.weekNumber === weekNumber && (phase ? result.phase === phase : true)
  );
  const selectedWeek =
    seasonOverview.availableWeeks.find((option) => option.weekNumber === weekNumber && (phase ? option.phase === phase : true)) ??
    (weekResults[0]
      ? {
          key: createSeasonWeekKey(weekNumber, weekResults[0].phase),
          weekNumber,
          phase: weekResults[0].phase,
          label: mapPhaseLabel(weekResults[0].phase, weekNumber),
          gameCount: weekResults.length,
          importedAt: null
        }
      : null);

  const ownerResults = season.league.members
    .map((member) => {
      const teamResults = weekResults
        .filter((result) => ownerByTeamId.get(result.nflTeamId)?.id === member.id)
        .map((result) => mapWeekResult(result, mapOwner(member)))
        .sort((left, right) => left.team.name.localeCompare(right.team.name));

      const baseRecord = createEmptyOwnerRecord(member);

      for (const result of teamResults) {
        baseRecord.resultCount += 1;
        baseRecord.pointsFor += result.pointsFor ?? 0;
        baseRecord.pointsAgainst += result.pointsAgainst ?? 0;

        if (result.result === "WIN") {
          baseRecord.wins += 1;
          if (result.phase === "REGULAR_SEASON") {
            baseRecord.regularSeasonWins += 1;
          } else {
            baseRecord.playoffWins += 1;
          }
        } else if (result.result === "LOSS") {
          baseRecord.losses += 1;
        } else {
          baseRecord.ties += 1;
        }
      }

      return {
        ...baseRecord,
        teamCount: new Set(teamResults.map((result) => result.team.nflTeamId)).size,
        netPoints: baseRecord.pointsFor - baseRecord.pointsAgainst,
        teams: teamResults
      };
    })
    .filter((owner) => owner.teams.length > 0)
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }
      if (left.losses !== right.losses) {
        return left.losses - right.losses;
      }
      if (right.netPoints !== left.netPoints) {
        return right.netPoints - left.netPoints;
      }
      return left.displayName.localeCompare(right.displayName);
    });

  return {
    season: seasonOverview.season,
    selectedWeek,
    selectedPhase: selectedWeek?.phase ?? phase ?? null,
    ownerResults,
    unassignedTeamResults: weekResults
      .filter((result) => !ownerByTeamId.has(result.nflTeamId))
      .map((result) => mapWeekResult(result, null))
      .sort((left, right) => left.team.name.localeCompare(right.team.name)),
    allTeamResults: weekResults
      .map((result) => {
        const owner = ownerByTeamId.get(result.nflTeamId);
        return mapWeekResult(result, owner ? mapOwner(owner) : null);
      })
      .sort((left, right) => left.team.name.localeCompare(right.team.name))
  };
}

function ensureValidTeamResultRecord(record: NormalizedNflTeamResultRecord) {
  const teamAbbreviation = normalizeNflTeamAbbreviation(record.teamAbbreviation);
  const opponentAbbreviation =
    record.opponentAbbreviation === null ? null : normalizeNflTeamAbbreviation(record.opponentAbbreviation);

  if (!teamAbbreviation.trim()) {
    throw new NflPerformanceServiceError("NFL provider returned a team result without a team abbreviation.", 502);
  }

  if (opponentAbbreviation !== null && !opponentAbbreviation.trim()) {
    throw new NflPerformanceServiceError("NFL provider returned an opponent abbreviation in an invalid format.", 502);
  }

  validateSeasonWeekPhase(record.seasonYear, record.weekNumber, record.phase);
}

async function runTransactionsInChunks(operations: Prisma.PrismaPromise<unknown>[], chunkSize = 50) {
  for (let index = 0; index < operations.length; index += chunkSize) {
    const chunk = operations.slice(index, index + chunkSize);

    if (chunk.length > 0) {
      await prisma.$transaction(chunk);
    }
  }
}

export const nflPerformanceService = {
  async getSeasonNflOverview(seasonId: string, actingUserId: string): Promise<SeasonNflOverview> {
    const { season } = await assertViewerMembershipForSeason(prisma, seasonId, actingUserId);
    const [results, importRuns] = await Promise.all([
      getSeasonResults(prisma, season.id, season.year),
      getSeasonImportRuns(prisma, season.id, season.year)
    ]);

    return buildSeasonOverviewFromContext(season, results, importRuns);
  },

  async getSeasonWeekNflResults(
    seasonId: string,
    weekNumber: number,
    actingUserId: string,
    phase?: SeasonNflResultPhaseType
  ): Promise<SeasonWeekNflResults> {
    const normalizedWeekNumber = normalizeWeekNumber(weekNumber);
    const { season } = await assertViewerMembershipForSeason(prisma, seasonId, actingUserId);
    const normalizedPhase = phase ?? undefined;

    if (normalizedPhase) {
      validateSeasonWeekPhase(season.year, normalizedWeekNumber, normalizedPhase);
    }

    const [results, importRuns] = await Promise.all([
      getSeasonResults(prisma, season.id, season.year),
      getSeasonImportRuns(prisma, season.id, season.year)
    ]);

    return buildWeekResults(season, results, importRuns, normalizedWeekNumber, normalizedPhase);
  },

  async importSeasonNflResults(input: ImportSeasonNflResultsInput): Promise<SeasonNflOverview> {
    const seasonId = normalizeSeasonId(input.seasonId);
    const actingUserId = normalizeActingUserId(input.actingUserId);
    const weekNumber = typeof input.weekNumber === "number" ? normalizeWeekNumber(input.weekNumber) : undefined;

    await seasonService.assertCommissionerAccess(seasonId, actingUserId);
    const season = await getSeasonContextOrThrow(prisma, seasonId);
    const existingRunningRun = await getRunningSeasonImportRun(prisma, season.id);

    if (existingRunningRun) {
      return this.getSeasonNflOverview(seasonId, actingUserId);
    }

    let run;

    try {
      run = await prisma.seasonNflImportRun.create({
        data: {
          seasonId: season.id,
          seasonYear: season.year,
          concurrencyKey: season.id,
          provider: "NFLVERSE",
          mode: typeof weekNumber === "number" ? "SINGLE_WEEK" : "FULL_SEASON",
          weekNumber: weekNumber ?? null,
          status: "RUNNING",
          actingUserId
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.getSeasonNflOverview(seasonId, actingUserId);
      }

      throw error;
    }

    try {
      const provider = nflResultsProviders.NFLVERSE;
      const loaded =
        typeof weekNumber === "number"
          ? await provider.loadWeekResults({ seasonYear: season.year, weekNumber })
          : await provider.loadSeasonResults({ seasonYear: season.year });

      if (loaded.records.length === 0) {
        throw new NflPerformanceServiceError(
          typeof weekNumber === "number"
            ? `No NFL results were available for ${season.year} week ${weekNumber}.`
            : `No NFL results were available for the ${season.year} NFL season.`,
          404
        );
      }
      const teams = await prisma.nFLTeam.findMany({
        where: { isActive: true },
        select: { id: true, abbreviation: true }
      });
      const existingResults = await prisma.seasonNflTeamResult.findMany({
        where: { seasonId: season.id },
        select: {
          id: true,
          weekNumber: true,
          phase: true,
          nflTeamId: true,
          sourceProvider: true
        }
      });
      const teamIdByAbbreviation = new Map(teams.map((team) => [team.abbreviation, team.id] as const));
      const ownershipByTeamId = new Map(
        season.teamOwnerships.map((ownership) => [ownership.nflTeamId, ownership.leagueMemberId] as const)
      );
      const existingByKey = new Map(
        existingResults.map((result) => [createSeasonWeekKey(result.weekNumber, result.phase) + `:${result.nflTeamId}`, result] as const)
      );

      let importedResultCount = 0;
      let createdCount = 0;
      let updatedCount = 0;
      let preservedManualCount = 0;
      const warnings: string[] = [];
      const importedKeys: string[] = [];
      const createRows: Array<{
        seasonId: string;
        seasonYear: number;
        weekNumber: number;
        phase: SeasonNflResultPhase;
        nflTeamId: string;
        opponentNflTeamId: string | null;
        leagueMemberId: string | null;
        result: SeasonNflGameResult;
        pointsFor: number | null;
        pointsAgainst: number | null;
        sourceProvider: NflResultProvider;
        importRunId: string;
        actingUserId: string;
        metadata: Prisma.InputJsonValue | typeof Prisma.JsonNull;
      }> = [];
      const updateOperations: Prisma.PrismaPromise<unknown>[] = [];

      for (const record of loaded.records) {
        ensureValidTeamResultRecord(record);
        const normalizedTeamAbbreviation = normalizeNflTeamAbbreviation(record.teamAbbreviation);
        const normalizedOpponentAbbreviation =
          record.opponentAbbreviation === null ? null : normalizeNflTeamAbbreviation(record.opponentAbbreviation);
        const nflTeamId = teamIdByAbbreviation.get(normalizedTeamAbbreviation);

        if (!nflTeamId) {
          warnings.push(`Skipped unsupported NFL team abbreviation ${normalizedTeamAbbreviation}.`);
          continue;
        }

        const opponentNflTeamId = normalizedOpponentAbbreviation
          ? teamIdByAbbreviation.get(normalizedOpponentAbbreviation) ?? null
          : null;
        const resultData = {
          seasonYear: season.year,
          opponentNflTeamId,
          leagueMemberId: ownershipByTeamId.get(nflTeamId) ?? null,
          result: record.result,
          pointsFor: record.pointsFor,
          pointsAgainst: record.pointsAgainst,
          sourceProvider: "NFLVERSE" as const,
          importRunId: run.id,
          actingUserId,
          metadata: toNullableJsonInput(record.metadata)
        };
        const weekKey = createSeasonWeekKey(record.weekNumber, record.phase);
        const compositeKey = `${weekKey}:${nflTeamId}`;
        const existing = existingByKey.get(compositeKey);

        if (existing?.sourceProvider === "MANUAL") {
          preservedManualCount += 1;
          warnings.push(`Preserved manual correction for ${normalizedTeamAbbreviation} ${weekKey}.`);
          importedKeys.push(weekKey);
          continue;
        }

        if (existing) {
          updateOperations.push(
            prisma.seasonNflTeamResult.update({
              where: { id: existing.id },
              data: resultData
            })
          );
          updatedCount += 1;
        } else {
          createRows.push({
            seasonId: season.id,
            weekNumber: record.weekNumber,
            phase: record.phase as SeasonNflResultPhase,
            nflTeamId,
            ...resultData
          });
          createdCount += 1;
        }

        importedResultCount += 1;
        importedKeys.push(weekKey);
      }

      if (createRows.length > 0) {
        await prisma.seasonNflTeamResult.createMany({
          data: createRows
        });
      }

      await runTransactionsInChunks(updateOperations);

      await prisma.seasonNflImportRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          concurrencyKey: null,
          importedResultCount,
          warnings:
            warnings.length || importedKeys.length
              ? {
                  messages: warnings,
                  importedKeys,
                  createdCount,
                  updatedCount,
                  preservedManualCount
                }
              : Prisma.JsonNull,
          completedAt: new Date()
        }
      });
    } catch (error) {
      await prisma.seasonNflImportRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          concurrencyKey: null,
          errorMessage: error instanceof Error ? error.message : "NFL import failed.",
          completedAt: new Date()
        }
      });

      throw error;
    }

    return this.getSeasonNflOverview(seasonId, actingUserId);
  },

  async importSeasonWeekNflResults(seasonId: string, weekNumber: number, actingUserId: string) {
    return this.importSeasonNflResults({
      seasonId,
      actingUserId,
      weekNumber
    });
  },

  async upsertSeasonWeekTeamResults(input: UpsertSeasonWeekTeamResultInput): Promise<SeasonWeekNflResults> {
    const seasonId = normalizeSeasonId(input.seasonId);
    const actingUserId = normalizeActingUserId(input.actingUserId);
    const weekNumber = normalizeWeekNumber(input.weekNumber);
    const nflTeamId = input.nflTeamId.trim();

    if (!nflTeamId) {
      throw new NflPerformanceServiceError("nflTeamId is required.", 400);
    }

    const pointsFor = normalizeOptionalScore(input.pointsFor);
    const pointsAgainst = normalizeOptionalScore(input.pointsAgainst);

    if (!input.phase) {
      throw new NflPerformanceServiceError("phase is required.", 400);
    }

    if (!input.result) {
      throw new NflPerformanceServiceError("result is required.", 400);
    }

    await seasonService.assertCommissionerAccess(seasonId, actingUserId);

    await prisma.$transaction(async (tx) => {
      const season = await getSeasonContextOrThrow(tx, seasonId);
      validateSeasonWeekPhase(season.year, weekNumber, input.phase);
      const nflTeam = await tx.nFLTeam.findUnique({ where: { id: nflTeamId } });

      if (!nflTeam) {
        throw new NflPerformanceServiceError("NFL team not found.", 404);
      }

      let opponentNflTeamId: string | null = null;
      if (input.opponentNflTeamId) {
        const opponent = await tx.nFLTeam.findUnique({ where: { id: input.opponentNflTeamId } });

        if (!opponent) {
          throw new NflPerformanceServiceError("Opponent NFL team not found.", 404);
        }

        opponentNflTeamId = opponent.id;
      }

      const ownership = season.teamOwnerships.find((entry) => entry.nflTeamId === nflTeamId) ?? null;

      await tx.seasonNflTeamResult.upsert({
        where: {
          seasonId_weekNumber_phase_nflTeamId: {
            seasonId,
            weekNumber,
            phase: input.phase as SeasonNflResultPhase,
            nflTeamId
          }
        },
        update: {
          seasonYear: season.year,
          opponentNflTeamId,
          leagueMemberId: ownership?.leagueMemberId ?? null,
          result: input.result as SeasonNflGameResult,
          pointsFor,
          pointsAgainst,
          sourceProvider: "MANUAL",
          importRunId: null,
          actingUserId,
          metadata: toNullableJsonInput(input.metadata)
        },
        create: {
          seasonId,
          seasonYear: season.year,
          weekNumber,
          phase: input.phase as SeasonNflResultPhase,
          nflTeamId,
          opponentNflTeamId,
          leagueMemberId: ownership?.leagueMemberId ?? null,
          result: input.result as SeasonNflGameResult,
          pointsFor,
          pointsAgainst,
          sourceProvider: "MANUAL",
          actingUserId,
          metadata: toNullableJsonInput(input.metadata)
        }
      });
    });

    return this.getSeasonWeekNflResults(seasonId, weekNumber, actingUserId, input.phase);
  }
};

export { NflPerformanceServiceError };
