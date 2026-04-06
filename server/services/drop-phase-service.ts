import { prisma } from "@/lib/prisma";
import { resultsService } from "@/server/services/results-service";
import type { DropPhaseContext, DraftTeamSummary } from "@/types/draft";
import type { LeaguePhase } from "@/types/season";

const EXPECTED_SOURCE_TEAMS_PER_OWNER = 3;
const EXPECTED_KEEPERS_PER_OWNER = 2;

type KeeperSelectionRow = {
  leagueMemberId: string;
  nflTeamId: string;
  nflTeam: {
    id: string;
    name: string;
    abbreviation: string;
    conference: "AFC" | "NFC";
    division: string;
  };
};

class DropPhaseServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "DropPhaseServiceError";
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

function deriveLeaguePhaseFromSeasonStatus(status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED"): LeaguePhase {
  if (status === "ACTIVE") {
    return "IN_SEASON";
  }

  if (status === "PLANNING") {
    return "DRAFT_PHASE";
  }

  return "POST_SEASON";
}

function compareTeamsByName(left: DraftTeamSummary, right: DraftTeamSummary) {
  return left.name.localeCompare(right.name);
}

function isMissingLeaguePhaseColumnError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("leaguePhase") ||
      error.message.includes("column") ||
      error.message.includes("does not exist") ||
      error.message.includes("Unknown field"))
  );
}

async function getTargetSeasonOrThrow(targetSeasonId: string) {
  const normalizedTargetSeasonId = targetSeasonId.trim();

  if (!normalizedTargetSeasonId) {
    throw new DropPhaseServiceError("targetSeasonId is required.", 400);
  }

  try {
    return await prisma.season.findUnique({
      where: {
        id: normalizedTargetSeasonId
      },
      select: {
        id: true,
        leagueId: true,
        year: true,
        name: true,
        status: true,
        leaguePhase: true,
        league: {
          select: {
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
                joinedAt: true,
                user: true
              },
              orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
            }
          }
        },
        targetDraft: {
          select: {
            id: true,
            status: true,
            sourceSeasonId: true,
            keeperSelections: {
              select: {
                leagueMemberId: true,
                nflTeamId: true,
                nflTeam: true
              },
              orderBy: [{ leagueMemberId: "asc" }, { createdAt: "asc" }]
            }
          }
        }
      }
    });
  } catch (error) {
    if (!isMissingLeaguePhaseColumnError(error)) {
      throw error;
    }

    return prisma.season.findUnique({
      where: {
        id: normalizedTargetSeasonId
      },
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
                joinedAt: true,
                user: true
              },
              orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
            }
          }
        },
        targetDraft: {
          select: {
            id: true,
            status: true,
            sourceSeasonId: true,
            keeperSelections: {
              select: {
                leagueMemberId: true,
                nflTeamId: true,
                nflTeam: true
              },
              orderBy: [{ leagueMemberId: "asc" }, { createdAt: "asc" }]
            }
          }
        }
      }
    });
  }
}

export const dropPhaseService = {
  async getDropPhaseContext(targetSeasonId: string): Promise<DropPhaseContext> {
    const targetSeason = await getTargetSeasonOrThrow(targetSeasonId);

    if (!targetSeason) {
      throw new DropPhaseServiceError("Season not found.", 404);
    }

    const currentPhase = (
      ("leaguePhase" in targetSeason ? targetSeason.leaguePhase : null) ??
      deriveLeaguePhaseFromSeasonStatus(targetSeason.status)
    ) as LeaguePhase;
    const sourceSeason = await prisma.season.findFirst({
      where: {
        leagueId: targetSeason.leagueId,
        year: targetSeason.year - 1
      },
      select: {
        id: true,
        year: true,
        name: true,
        teamOwnerships: {
          select: {
            nflTeamId: true,
            slot: true,
            nflTeam: true,
            leagueMember: {
              select: {
                id: true,
                userId: true,
                role: true,
                user: true
              }
            }
          },
          orderBy: [{ leagueMember: { role: "asc" } }, { slot: "asc" }]
        }
      }
    });

    const recommendation = sourceSeason
      ? await resultsService.getRecommendedOffseasonDraftOrder(sourceSeason.id, targetSeason.id)
      : null;

    const sourceOwnershipsByUserId = new Map<
      string,
      Array<{
        sourceLeagueMemberId: string;
        nflTeamId: string;
        slot: number;
        nflTeam: {
          id: string;
          name: string;
          abbreviation: string;
          conference: "AFC" | "NFC";
          division: string;
        };
      }>
    >();

    for (const ownership of sourceSeason?.teamOwnerships ?? []) {
      const bucket = sourceOwnershipsByUserId.get(ownership.leagueMember.userId) ?? [];
      bucket.push({
        sourceLeagueMemberId: ownership.leagueMember.id,
        nflTeamId: ownership.nflTeamId,
        slot: ownership.slot,
        nflTeam: ownership.nflTeam
      });
      sourceOwnershipsByUserId.set(ownership.leagueMember.userId, bucket);
    }

    const keepersByTargetLeagueMemberId = new Map<string, KeeperSelectionRow[]>();

    for (const keeper of targetSeason.targetDraft?.keeperSelections ?? []) {
      const bucket = keepersByTargetLeagueMemberId.get(keeper.leagueMemberId) ?? [];
      bucket.push(keeper);
      keepersByTargetLeagueMemberId.set(keeper.leagueMemberId, bucket);
    }

    const owners = targetSeason.league.members.map((member) => {
      const sourceOwnerships = [...(sourceOwnershipsByUserId.get(member.userId) ?? [])].sort((left, right) => left.slot - right.slot);
      const eligibleTeams = sourceOwnerships.map((ownership) => mapDraftTeam(ownership.nflTeam));
      const eligibleTeamIds = new Set(sourceOwnerships.map((ownership) => ownership.nflTeamId));
      const savedKeepers = (keepersByTargetLeagueMemberId.get(member.id) ?? []).filter((keeper) =>
        eligibleTeamIds.has(keeper.nflTeamId)
      );
      const keptTeams = sourceOwnerships
        .filter((ownership) => savedKeepers.some((keeper) => keeper.nflTeamId === ownership.nflTeamId))
        .map((ownership) => mapDraftTeam(ownership.nflTeam));
      const keptTeamIds = keptTeams.map((team) => team.id);
      const releasedTeam =
        eligibleTeams.length === EXPECTED_SOURCE_TEAMS_PER_OWNER && keptTeams.length === EXPECTED_KEEPERS_PER_OWNER
          ? eligibleTeams.find((team) => !keptTeamIds.includes(team.id)) ?? null
          : null;
      const warnings: string[] = [];

      if (!sourceSeason) {
        warnings.push("The immediately previous season is missing.");
      } else if (sourceOwnerships.length === 0) {
        warnings.push("No previous-season ownership was found for this owner.");
      } else if (sourceOwnerships.length !== EXPECTED_SOURCE_TEAMS_PER_OWNER) {
        warnings.push("This owner does not have exactly 3 teams in the previous season.");
      }

      if (!targetSeason.targetDraft) {
        warnings.push("No offseason draft workspace exists yet for this target season.");
      }

      if (
        targetSeason.targetDraft &&
        sourceSeason &&
        targetSeason.targetDraft.sourceSeasonId !== sourceSeason.id
      ) {
        warnings.push("The draft workspace is linked to the wrong source season.");
      }

      if (savedKeepers.length !== keptTeams.length) {
        warnings.push("One or more saved keepers do not belong to the owner's previous-season teams.");
      }

      if (keptTeams.length > 0 && keptTeams.length !== EXPECTED_KEEPERS_PER_OWNER) {
        warnings.push("Each owner must keep exactly 2 teams.");
      }

      if (keptTeams.length === EXPECTED_KEEPERS_PER_OWNER && releasedTeam === null) {
        warnings.push("Released team could not be derived from the current keeper selection.");
      }

      return {
        sourceLeagueMemberId: sourceOwnerships[0]?.sourceLeagueMemberId ?? null,
        targetLeagueMemberId: member.id,
        userId: member.userId,
        displayName: member.user.displayName,
        email: member.user.email,
        role: member.role,
        eligibleTeams,
        keptTeamIds,
        keptTeams,
        releasedTeam,
        isComplete:
          sourceOwnerships.length === EXPECTED_SOURCE_TEAMS_PER_OWNER &&
          keptTeams.length === EXPECTED_KEEPERS_PER_OWNER &&
          releasedTeam !== null &&
          warnings.filter((warning) =>
            warning.includes("wrong source season") ||
            warning.includes("do not belong") ||
            warning.includes("exactly 2 teams")
          ).length === 0,
        mappingStatus: sourceOwnerships.length > 0 ? ("MAPPED" as const) : ("MISSING_SOURCE_OWNER" as const),
        warnings
      };
    });

    const releasedTeamPool = owners
      .map((owner) => owner.releasedTeam)
      .filter((team): team is DraftTeamSummary => team !== null)
      .sort(compareTeamsByName);
    const ownersCompleteCount = owners.filter((owner) => owner.isComplete).length;
    const ownersTotalCount = owners.length;
    const warnings: string[] = [];

    if (!sourceSeason) {
      warnings.push("The immediately previous season is missing, so keeper and release review cannot begin.");
    }

    if (!targetSeason.targetDraft) {
      warnings.push("No offseason draft workspace exists yet for this target season.");
    }

    if (targetSeason.targetDraft && sourceSeason && targetSeason.targetDraft.sourceSeasonId !== sourceSeason.id) {
      warnings.push("The current draft workspace is linked to the wrong source season.");
    }

    if (recommendation?.warnings.length) {
      warnings.push(...recommendation.warnings);
    }

    if (ownersCompleteCount !== ownersTotalCount) {
      warnings.push("Every owner must keep exactly 2 teams and release exactly 1 team before entering DRAFT_PHASE.");
    }

    return {
      sourceSeasonId: sourceSeason?.id ?? null,
      sourceSeasonName: sourceSeason?.name ?? null,
      sourceSeasonYear: sourceSeason?.year ?? null,
      targetSeasonId: targetSeason.id,
      targetSeasonName: targetSeason.name,
      targetSeasonYear: targetSeason.year,
      currentPhase,
      hasDraftWorkspace: Boolean(targetSeason.targetDraft),
      draftId: targetSeason.targetDraft?.id ?? null,
      draftStatus: targetSeason.targetDraft?.status ?? null,
      ownersCompleteCount,
      ownersTotalCount,
      releasedTeamPool,
      isReadyForDraftPhase:
        Boolean(sourceSeason) &&
        Boolean(targetSeason.targetDraft) &&
        ownersCompleteCount === ownersTotalCount &&
        Boolean(recommendation?.readiness.isReady) &&
        Boolean(recommendation?.readiness.allTargetMappingsComplete) &&
        (!sourceSeason || targetSeason.targetDraft?.sourceSeasonId === sourceSeason.id),
      recommendationReadiness: {
        draftOrderReady: recommendation?.readiness.isReady ?? false,
        allTargetMappingsComplete: recommendation?.readiness.allTargetMappingsComplete ?? false,
        ledgerCoverageStatus: recommendation?.readiness.ledgerCoverageStatus ?? "NONE"
      },
      warnings,
      owners
    };
  }
};

export { DropPhaseServiceError };
