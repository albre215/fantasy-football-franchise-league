import { prisma } from "@/lib/prisma";
import { dropPhaseService } from "@/server/services/drop-phase-service";
import { resultsService } from "@/server/services/results-service";
import { seasonService } from "@/server/services/season-service";
import type { DraftStatus } from "@/types/draft";
import type {
  LeaguePhase,
  SeasonPhaseContext,
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

const FORWARD_TRANSITIONS: Record<LeaguePhase, LeaguePhase[]> = {
  IN_SEASON: ["POST_SEASON"],
  POST_SEASON: ["DROP_PHASE"],
  DROP_PHASE: ["DRAFT_PHASE"],
  DRAFT_PHASE: []
};

function deriveLeaguePhaseFromSeasonStatus(status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED"): LeaguePhase {
  if (status === "ACTIVE") {
    return "IN_SEASON";
  }

  if (status === "PLANNING") {
    return "DRAFT_PHASE";
  }

  return "POST_SEASON";
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

function mapAllowedActions(currentPhase: LeaguePhase): SeasonPhaseContext["allowedActions"] {
  return {
    canReviewResults: currentPhase === "IN_SEASON" || currentPhase === "POST_SEASON",
    canReviewOffseasonRecommendation:
      currentPhase === "POST_SEASON" || currentPhase === "DROP_PHASE" || currentPhase === "DRAFT_PHASE",
    canReviewDropPhase: currentPhase === "POST_SEASON" || currentPhase === "DROP_PHASE" || currentPhase === "DRAFT_PHASE",
    canManageDraftWorkspace: currentPhase === "DROP_PHASE" || currentPhase === "DRAFT_PHASE",
    canEditKeepers: currentPhase === "DROP_PHASE",
    canPrepareDraft: currentPhase === "DRAFT_PHASE",
    canEditDraft: currentPhase === "DRAFT_PHASE",
    canRunDraft: currentPhase === "DRAFT_PHASE",
    canEnterDropPhase: currentPhase === "POST_SEASON"
  };
}

function buildTransitionWarnings(
  currentPhase: LeaguePhase,
  nextPhase: LeaguePhase,
  readiness: SeasonPhaseContext["readiness"]
) {
  const warnings: string[] = [];

  if (currentPhase === "IN_SEASON" && nextPhase === "POST_SEASON") {
    if (!readiness.hasFinalStandings) {
      warnings.push("Final standings have not been saved yet.");
    }

    if (!readiness.hasFantasyPayoutsPublished) {
      warnings.push("Fantasy payouts have not been published to the ledger yet.");
    }
  }

  if (currentPhase === "POST_SEASON" && nextPhase === "DROP_PHASE") {
    if (!readiness.hasPreviousSeason) {
      warnings.push("The immediately previous season is missing, so offseason review is incomplete.");
    }

    if (!readiness.draftOrderReady) {
      warnings.push("Ledger-based offseason draft recommendation is not fully ready yet.");
    }

    if (!readiness.allTargetMappingsComplete) {
      warnings.push("Target-season owner mappings are incomplete.");
    }
  }

  if (currentPhase === "DROP_PHASE" && nextPhase === "DRAFT_PHASE") {
    if (!readiness.hasDraftWorkspace) {
      warnings.push("Prepare the offseason draft workspace before entering DRAFT_PHASE.");
    }

    if (readiness.ownersWithCompletedKeeperSelections !== readiness.ownersTotalCount) {
      warnings.push("Every owner must keep exactly 2 teams and release exactly 1 team before entering DRAFT_PHASE.");
    }

    if (!readiness.allTargetMappingsComplete) {
      warnings.push("Target-season owner mappings are incomplete.");
    }

    if (!readiness.draftOrderReady) {
      warnings.push("Draft recommendation warnings still exist. Review them before entering DRAFT_PHASE.");
    }
  }

  return warnings;
}

async function getSeasonPhaseBaseContext(seasonId: string) {
  const normalizedSeasonId = seasonId.trim();

  if (!normalizedSeasonId) {
    throw new SeasonPhaseServiceError("seasonId is required.", 400);
  }

  let season:
    | {
        id: string;
        leagueId: string;
        year: number;
        name: string | null;
        status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
        leaguePhase?: LeaguePhase | null;
        targetDraft: { id: string; status: DraftStatus } | null;
      }
    | null;

  try {
    season = await prisma.season.findUnique({
      where: {
        id: normalizedSeasonId
      },
      select: {
        id: true,
        leagueId: true,
        year: true,
        name: true,
        status: true,
        leaguePhase: true,
        targetDraft: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });
  } catch (error) {
    if (!isMissingLeaguePhaseColumnError(error)) {
      throw error;
    }

    season = await prisma.season.findUnique({
      where: {
        id: normalizedSeasonId
      },
      select: {
        id: true,
        leagueId: true,
        year: true,
        name: true,
        status: true,
        targetDraft: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });
  }

  if (!season) {
    throw new SeasonPhaseServiceError("Season not found.", 404);
  }

  const previousSeason = await prisma.season.findFirst({
    where: {
      leagueId: season.leagueId,
      year: season.year - 1
    },
    select: {
      id: true
    }
  });

  const results = await resultsService.getSeasonResults(season.id);
  const recommendation = previousSeason
    ? await resultsService.getRecommendedOffseasonDraftOrder(previousSeason.id, season.id)
    : null;

  return {
    season: {
      ...season,
      leaguePhase: season.leaguePhase ?? deriveLeaguePhaseFromSeasonStatus(season.status)
    },
    recommendation,
    results
  };
}

export const seasonPhaseService = {
  async getSeasonPhaseContext(seasonId: string): Promise<SeasonPhaseContext> {
    const { season, recommendation, results } = await getSeasonPhaseBaseContext(seasonId);
    const currentPhase = season.leaguePhase as LeaguePhase;
    const dropPhaseContext =
      currentPhase === "DROP_PHASE" || currentPhase === "DRAFT_PHASE"
        ? await dropPhaseService.getDropPhaseContext(season.id)
        : null;
    const readiness: SeasonPhaseContext["readiness"] = {
      hasPreviousSeason: recommendation !== null,
      hasFinalStandings: results.availability.hasFinalStandings,
      hasFantasyPayoutsPublished: results.availability.hasFantasyPayoutsPublished,
      draftOrderReady: dropPhaseContext?.hasUsableDraftOrder ?? recommendation?.readiness.isReady ?? false,
      allTargetMappingsComplete: recommendation?.readiness.allTargetMappingsComplete ?? false,
      ledgerCoverageStatus: recommendation?.readiness.ledgerCoverageStatus ?? "NONE",
      hasDraftWorkspace: dropPhaseContext?.hasDraftWorkspace ?? Boolean(season.targetDraft),
      draftStatus: dropPhaseContext?.draftStatus ?? season.targetDraft?.status ?? null,
      ownersWithCompletedKeeperSelections: dropPhaseContext?.ownersCompleteCount ?? 0,
      ownersTotalCount: dropPhaseContext?.ownersTotalCount ?? 0,
      isReadyForDraftPhase: dropPhaseContext?.isReadyForDraftPhase ?? false
    };
    const warnings = [
      ...(!readiness.hasFinalStandings &&
      (currentPhase === "POST_SEASON" || currentPhase === "DROP_PHASE" || currentPhase === "DRAFT_PHASE")
        ? ["Final standings are not saved yet."]
        : []),
      ...(!readiness.hasFantasyPayoutsPublished &&
      (currentPhase === "POST_SEASON" || currentPhase === "DROP_PHASE" || currentPhase === "DRAFT_PHASE")
        ? ["Fantasy payouts are not published to the ledger yet."]
        : []),
      ...(!readiness.hasPreviousSeason && currentPhase !== "IN_SEASON"
        ? ["The immediately previous season is missing, so offseason review is incomplete."]
        : []),
      ...((dropPhaseContext?.hasUsableDraftOrder ? [] : recommendation?.warnings) ?? []),
      ...(dropPhaseContext?.warnings ?? []),
      ...(currentPhase === "DRAFT_PHASE" && !readiness.hasDraftWorkspace
        ? ["No offseason draft workspace exists yet for this season."]
        : [])
    ];

    return {
      season: {
        id: season.id,
        leagueId: season.leagueId,
        year: season.year,
        name: season.name,
        status: season.status,
        leaguePhase: currentPhase
      },
      allowedActions: mapAllowedActions(currentPhase),
      readiness,
      availableTransitions: FORWARD_TRANSITIONS[currentPhase].map((nextPhase) => ({
        phase: nextPhase,
        isAvailable: nextPhase === "DRAFT_PHASE" ? readiness.isReadyForDraftPhase : true,
        warnings: buildTransitionWarnings(currentPhase, nextPhase, readiness)
      })),
      warnings
    };
  },

  async updateSeasonLeaguePhase(input: UpdateSeasonLeaguePhaseInput): Promise<SeasonPhaseContext> {
    const nextPhase = input.nextPhase;

    if (!nextPhase) {
      throw new SeasonPhaseServiceError("nextPhase is required.", 400);
    }

    await seasonService.assertCommissionerAccess(input.seasonId, input.actingUserId);

    let season: { id: string; leaguePhase?: LeaguePhase | null } | null;

    try {
      season = await prisma.season.findUnique({
        where: {
          id: input.seasonId.trim()
        },
        select: {
          id: true,
          leaguePhase: true
        }
      });
    } catch (error) {
      if (!isMissingLeaguePhaseColumnError(error)) {
        throw error;
      }

      const fallbackSeason = await seasonService.getSeasonSetupStatus(input.seasonId);
      season = {
        id: fallbackSeason.seasonId,
        leaguePhase: null
      };
    }

    if (!season) {
      throw new SeasonPhaseServiceError("Season not found.", 404);
    }

    const currentContext = await this.getSeasonPhaseContext(input.seasonId);
    const currentPhase = currentContext.season.leaguePhase;

    if (currentPhase === nextPhase) {
      throw new SeasonPhaseServiceError(`Season is already in ${nextPhase}.`, 409);
    }

    if (!FORWARD_TRANSITIONS[currentPhase].includes(nextPhase)) {
      throw new SeasonPhaseServiceError(
        `Invalid season phase transition from ${currentPhase} to ${nextPhase}.`,
        409
      );
    }

    if (nextPhase === "DRAFT_PHASE" && !currentContext.readiness.isReadyForDraftPhase) {
      throw new SeasonPhaseServiceError(
        currentContext.availableTransitions.find((transition) => transition.phase === "DRAFT_PHASE")?.warnings[0] ??
          "Complete the DROP_PHASE keeper and release workflow before entering DRAFT_PHASE.",
        409
      );
    }

    try {
      await prisma.season.update({
        where: {
          id: season.id
        },
        data: {
          leaguePhase: nextPhase
        }
      });
    } catch (error) {
      if (!isMissingLeaguePhaseColumnError(error)) {
        throw error;
      }

      throw new SeasonPhaseServiceError(
        "League phase controls require the latest database migration. Run the Prisma migration locally, then try again.",
        409
      );
    }

    return this.getSeasonPhaseContext(season.id);
  },

  async assertPhaseAllowsDraftPreparation(seasonId: string) {
    const phase = await this.getSeasonPhaseContext(seasonId);

    if (!phase.allowedActions.canPrepareDraft) {
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
  },

  async assertPhaseAllowsDraftWorkspaceManagement(seasonId: string) {
    const phase = await this.getSeasonPhaseContext(seasonId);

    if (!phase.allowedActions.canManageDraftWorkspace) {
      throw new SeasonPhaseServiceError(
        `Draft workspace management is only available during DROP_PHASE or DRAFT_PHASE. Current phase: ${phase.season.leaguePhase}.`,
        409
      );
    }

    return phase;
  },

  async assertPhaseAllowsKeeperReleaseEditing(seasonId: string) {
    const phase = await this.getSeasonPhaseContext(seasonId);

    if (!phase.allowedActions.canEditKeepers) {
      throw new SeasonPhaseServiceError(
        `Keeper and release editing is only available during DROP_PHASE. Current phase: ${phase.season.leaguePhase}.`,
        409
      );
    }

    return phase;
  }
};

export { SeasonPhaseServiceError };
