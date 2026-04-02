import { prisma } from "@/lib/prisma";
import { resultsService } from "@/server/services/results-service";
import { seasonService } from "@/server/services/season-service";
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

function mapAllowedActions(currentPhase: LeaguePhase): SeasonPhaseContext["allowedActions"] {
  return {
    canReviewResults: currentPhase === "IN_SEASON" || currentPhase === "POST_SEASON",
    canReviewOffseasonRecommendation:
      currentPhase === "POST_SEASON" || currentPhase === "DROP_PHASE" || currentPhase === "DRAFT_PHASE",
    canPrepareDraft: currentPhase === "DRAFT_PHASE",
    canEditDraft: currentPhase === "DRAFT_PHASE",
    canRunDraft: currentPhase === "DRAFT_PHASE",
    canEnterDropPhase: currentPhase === "POST_SEASON"
  };
}

function buildTransitionWarnings(
  currentPhase: LeaguePhase,
  nextPhase: LeaguePhase,
  readiness: SeasonPhaseContext["readiness"],
  hasRecommendationWarnings: boolean
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
    if (!readiness.draftOrderReady) {
      warnings.push("Ledger-based offseason draft recommendation is not fully ready yet.");
    }

    if (!readiness.allTargetMappingsComplete) {
      warnings.push("Target-season owner mappings are incomplete.");
    }

    if (hasRecommendationWarnings) {
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
      leaguePhase: true,
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
    select: {
      id: true
    }
  });

  const results = await resultsService.getSeasonResults(season.id);
  const recommendation = previousSeason
    ? await resultsService.getRecommendedOffseasonDraftOrder(previousSeason.id, season.id)
    : null;

  return {
    season,
    recommendation,
    results
  };
}

export const seasonPhaseService = {
  async getSeasonPhaseContext(seasonId: string): Promise<SeasonPhaseContext> {
    const { season, recommendation, results } = await getSeasonPhaseBaseContext(seasonId);
    const currentPhase = season.leaguePhase as LeaguePhase;
    const readiness: SeasonPhaseContext["readiness"] = {
      hasPreviousSeason: recommendation !== null,
      hasFinalStandings: results.availability.hasFinalStandings,
      hasFantasyPayoutsPublished: results.availability.hasFantasyPayoutsPublished,
      draftOrderReady: recommendation?.readiness.isReady ?? false,
      allTargetMappingsComplete: recommendation?.readiness.allTargetMappingsComplete ?? false,
      ledgerCoverageStatus: recommendation?.readiness.ledgerCoverageStatus ?? "NONE",
      hasDraftWorkspace: Boolean(season.targetDraft),
      draftStatus: season.targetDraft?.status ?? null
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
      ...(recommendation?.warnings ?? []),
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
        isAvailable: true,
        warnings: buildTransitionWarnings(currentPhase, nextPhase, readiness, Boolean(recommendation?.warnings.length))
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

    const season = await prisma.season.findUnique({
      where: {
        id: input.seasonId.trim()
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
      throw new SeasonPhaseServiceError(`Season is already in ${nextPhase}.`, 409);
    }

    if (!FORWARD_TRANSITIONS[currentPhase].includes(nextPhase)) {
      throw new SeasonPhaseServiceError(
        `Invalid season phase transition from ${currentPhase} to ${nextPhase}.`,
        409
      );
    }

    await prisma.season.update({
      where: {
        id: season.id
      },
      data: {
        leaguePhase: nextPhase
      }
    });

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
  }
};

export { SeasonPhaseServiceError };
