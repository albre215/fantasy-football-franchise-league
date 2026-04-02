import { prisma } from "@/lib/prisma";
import { seasonService } from "@/server/services/season-service";
import type {
  LeaguePhase,
  SeasonPhaseContext,
  SeasonSummary,
  UpdateSeasonLeaguePhaseInput
} from "@/types/season";

class SeasonPhaseServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "SeasonPhaseServiceError";
  }
}

const NEXT_PHASES: Record<LeaguePhase, LeaguePhase[]> = {
  IN_SEASON: ["POST_SEASON"],
  POST_SEASON: ["DROP_PHASE"],
  DROP_PHASE: ["DRAFT_PHASE"],
  DRAFT_PHASE: []
};

function normalizeSeasonId(seasonId: string) {
  const normalized = seasonId.trim();

  if (!normalized) {
    throw new SeasonPhaseServiceError("seasonId is required.", 400);
  }

  return normalized;
}

function normalizeNextPhase(nextPhase: LeaguePhase | string) {
  const allowed = new Set<LeaguePhase>(["IN_SEASON", "POST_SEASON", "DROP_PHASE", "DRAFT_PHASE"]);

  if (!allowed.has(nextPhase as LeaguePhase)) {
    throw new SeasonPhaseServiceError("A valid league phase is required.", 400);
  }

  return nextPhase as LeaguePhase;
}

async function getSeasonPhaseDataOrThrow(seasonId: string) {
  const normalizedSeasonId = normalizeSeasonId(seasonId);
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
      targetDraft: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  if (!season) {
    throw new SeasonPhaseServiceError("Season not found.", 404);
  }

  const previousSeason = await prisma.season.findFirst({
    where: {
      leagueId: season.leagueId,
      year: season.year - 1
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
  });

  return {
    season,
    previousSeason
  };
}

function getTransitionWarnings(
  currentPhase: LeaguePhase,
  nextPhase: LeaguePhase,
  readiness: SeasonPhaseContext["readiness"]
) {
  const warnings: string[] = [];

  if (currentPhase === "IN_SEASON" && nextPhase === "POST_SEASON" && !readiness.hasFinalStandings) {
    warnings.push("Final standings have not been saved for the previous season yet.");
  }

  if (currentPhase === "POST_SEASON" && nextPhase === "DROP_PHASE") {
    if (!readiness.hasRecommendedDraftOrder) {
      warnings.push("The offseason recommendation is not ready yet.");
    }

    if (!readiness.hasCompleteTargetMapping) {
      warnings.push("Not every previous-season owner maps cleanly into the current season.");
    }
  }

  if (currentPhase === "DROP_PHASE" && nextPhase === "DRAFT_PHASE" && !readiness.hasRecommendedDraftOrder) {
    warnings.push("The offseason recommendation should be reviewable before entering draft phase.");
  }

  return warnings;
}

function buildSeasonPhaseContext(data: Awaited<ReturnType<typeof getSeasonPhaseDataOrThrow>>): SeasonPhaseContext {
  const { season, previousSeason } = data;
  const participantCount = season.league.members.length;
  const targetMembersByUserId = new Map(season.league.members.map((member) => [member.userId, member] as const));
  const standings = previousSeason?.seasonStandings ?? [];
  const standingsWithRank = standings.filter((standing) => standing.rank !== null);
  const mappedTargetMemberCount = standingsWithRank.filter((standing) =>
    targetMembersByUserId.has(standing.leagueMember.userId)
  ).length;
  const hasPreviousSeason = Boolean(previousSeason);
  const hasFinalStandings =
    hasPreviousSeason &&
    standings.length === participantCount &&
    standings.length > 0 &&
    standings.every((standing) => standing.rank !== null);
  const hasRecommendedDraftOrder = hasFinalStandings;
  const hasCompleteTargetMapping = hasRecommendedDraftOrder && mappedTargetMemberCount === participantCount;
  const hasDraftWorkspace = Boolean(season.targetDraft);
  const draftStatus = season.targetDraft?.status ?? null;
  const readiness = {
    hasPreviousSeason,
    hasFinalStandings,
    hasRecommendedDraftOrder,
    hasCompleteTargetMapping,
    hasDraftWorkspace,
    draftStatus,
    participantCount,
    mappedTargetMemberCount
  } satisfies SeasonPhaseContext["readiness"];
  const warnings: string[] = [];

  if (!hasPreviousSeason) {
    warnings.push("The immediately previous season does not exist yet.");
  }

  if (hasPreviousSeason && !hasFinalStandings) {
    warnings.push("Final standings for the immediately previous season are not complete yet.");
  }

  if (hasRecommendedDraftOrder && !hasCompleteTargetMapping) {
    warnings.push("Some previous-season owners are not represented in the current season.");
  }

  if (season.targetDraft?.status === "ACTIVE" || season.targetDraft?.status === "PAUSED") {
    warnings.push("A draft is already in progress for this season.");
  }

  const currentPhase = season.leaguePhase as LeaguePhase;
  const availableTransitions = NEXT_PHASES[currentPhase].map((nextPhase) => ({
    nextPhase,
    warnings: getTransitionWarnings(currentPhase, nextPhase, readiness)
  }));

  return {
    season: {
      id: season.id,
      leagueId: season.leagueId,
      year: season.year,
      name: season.name,
      status: season.status,
      leaguePhase: currentPhase,
      isLocked: season.isLocked
    },
    allowedActions: {
      canReviewResults: currentPhase !== "IN_SEASON",
      canReviewOffseasonRecommendation: currentPhase !== "IN_SEASON",
      canEnterDropPhase: currentPhase === "POST_SEASON",
      canPrepareDraft: currentPhase === "DRAFT_PHASE" && !hasDraftWorkspace,
      canEditDraft: currentPhase === "DRAFT_PHASE",
      canRunDraft: currentPhase === "DRAFT_PHASE"
    },
    availableTransitions,
    warnings,
    readiness
  };
}

export const seasonPhaseService = {
  async getSeasonPhaseContext(seasonId: string): Promise<SeasonPhaseContext> {
    const data = await getSeasonPhaseDataOrThrow(seasonId);
    return buildSeasonPhaseContext(data);
  },

  async updateSeasonLeaguePhase(input: UpdateSeasonLeaguePhaseInput) {
    const seasonId = normalizeSeasonId(input.seasonId);
    const nextPhase = normalizeNextPhase(input.nextPhase);

    await seasonService.assertCommissionerAccess(seasonId, input.actingUserId);

    await prisma.$transaction(async (tx) => {
      const season = await tx.season.findUnique({
        where: {
          id: seasonId
        },
        select: {
          id: true,
          leaguePhase: true
        }
      });

      if (!season) {
        throw new SeasonPhaseServiceError("Season not found.", 404);
      }

      const currentPhase = season.leaguePhase as LeaguePhase;

      if (currentPhase === nextPhase) {
        throw new SeasonPhaseServiceError("Season is already in that league phase.", 409);
      }

      if (!NEXT_PHASES[currentPhase].includes(nextPhase)) {
        throw new SeasonPhaseServiceError(
          `Invalid phase transition from ${currentPhase} to ${nextPhase}.`,
          409
        );
      }

      await tx.season.update({
        where: {
          id: seasonId
        },
        data: {
          leaguePhase: nextPhase
        }
      });
    });

    const phase = await this.getSeasonPhaseContext(seasonId);
    const season = await prisma.season.findUnique({
      where: {
        id: seasonId
      },
      select: {
        id: true,
        leagueId: true,
        year: true,
        name: true,
        status: true,
        leaguePhase: true,
        isLocked: true,
        startsAt: true,
        endsAt: true,
        createdAt: true
      }
    });

    if (!season) {
      throw new SeasonPhaseServiceError("Season not found.", 404);
    }

    return {
      phase,
      season: {
        id: season.id,
        leagueId: season.leagueId,
        year: season.year,
        name: season.name,
        status: season.status,
        leaguePhase: season.leaguePhase as LeaguePhase,
        isLocked: season.isLocked,
        startsAt: season.startsAt?.toISOString() ?? null,
        endsAt: season.endsAt?.toISOString() ?? null,
        createdAt: season.createdAt.toISOString()
      } satisfies SeasonSummary
    };
  },

  async assertPhaseAllowsDraftPreparation(seasonId: string) {
    const phase = await this.getSeasonPhaseContext(seasonId);

    if (!phase.allowedActions.canPrepareDraft && !phase.allowedActions.canEditDraft) {
      throw new SeasonPhaseServiceError(
        `Offseason draft actions are only available during DRAFT_PHASE. Current phase: ${phase.season.leaguePhase}.`,
        409
      );
    }

    return phase;
  },

  async assertPhaseAllowsDraftExecution(seasonId: string) {
    const phase = await this.getSeasonPhaseContext(seasonId);

    if (!phase.allowedActions.canRunDraft) {
      throw new SeasonPhaseServiceError(
        `Draft execution is only available during DRAFT_PHASE. Current phase: ${phase.season.leaguePhase}.`,
        409
      );
    }

    return phase;
  }
};

export { SeasonPhaseServiceError };
