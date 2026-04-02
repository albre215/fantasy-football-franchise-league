import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockResultsService, mockSeasonService } = vi.hoisted(() => ({
  mockPrisma: {
    season: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    }
  },
  mockResultsService: {
    getSeasonResults: vi.fn(),
    getRecommendedOffseasonDraftOrder: vi.fn()
  },
  mockSeasonService: {
    assertCommissionerAccess: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/results-service", () => ({
  resultsService: mockResultsService
}));

vi.mock("@/server/services/season-service", () => ({
  seasonService: mockSeasonService
}));

import { SeasonPhaseServiceError, seasonPhaseService } from "@/server/services/season-phase-service";

describe("seasonPhaseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds honest readiness context with warnings", async () => {
    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "season-2026",
      leagueId: "league-1",
      year: 2026,
      name: null,
      status: "ACTIVE",
      leaguePhase: "POST_SEASON",
      targetDraft: null
    });
    mockPrisma.season.findFirst.mockResolvedValueOnce({ id: "season-2025" });
    mockResultsService.getSeasonResults.mockResolvedValueOnce({
      availability: {
        hasFinalStandings: false,
        hasFantasyPayoutsPublished: false
      }
    });
    mockResultsService.getRecommendedOffseasonDraftOrder.mockResolvedValueOnce({
      readiness: {
        isReady: false,
        allTargetMappingsComplete: false,
        ledgerCoverageStatus: "PARTIAL"
      },
      warnings: ["A target-season owner mapping is missing."]
    });

    const context = await seasonPhaseService.getSeasonPhaseContext("season-2026");

    expect(context.season.leaguePhase).toBe("POST_SEASON");
    expect(context.readiness).toMatchObject({
      hasPreviousSeason: true,
      hasFinalStandings: false,
      hasFantasyPayoutsPublished: false,
      draftOrderReady: false,
      allTargetMappingsComplete: false,
      ledgerCoverageStatus: "PARTIAL",
      hasDraftWorkspace: false,
      draftStatus: null
    });
    expect(context.allowedActions.canReviewResults).toBe(true);
    expect(context.allowedActions.canPrepareDraft).toBe(false);
    expect(context.availableTransitions[0]).toMatchObject({
      phase: "DROP_PHASE",
      isAvailable: true
    });
    expect(context.warnings).toContain("Final standings are not saved yet.");
    expect(context.warnings).toContain("Fantasy payouts are not published to the ledger yet.");
    expect(context.warnings).toContain("A target-season owner mapping is missing.");
  });

  it("updates to the next valid phase after commissioner access passes", async () => {
    mockSeasonService.assertCommissionerAccess.mockResolvedValueOnce(undefined);
    mockPrisma.season.findUnique
      .mockResolvedValueOnce({
        id: "season-2026",
        leaguePhase: "POST_SEASON"
      })
      .mockResolvedValueOnce({
        id: "season-2026",
        leagueId: "league-1",
        year: 2026,
        name: null,
        status: "ACTIVE",
        leaguePhase: "DROP_PHASE",
        targetDraft: null
      });
    mockPrisma.season.update.mockResolvedValueOnce(undefined);
    mockPrisma.season.findFirst.mockResolvedValueOnce({ id: "season-2025" });
    mockResultsService.getSeasonResults.mockResolvedValueOnce({
      availability: {
        hasFinalStandings: true,
        hasFantasyPayoutsPublished: true
      }
    });
    mockResultsService.getRecommendedOffseasonDraftOrder.mockResolvedValueOnce({
      readiness: {
        isReady: true,
        allTargetMappingsComplete: true,
        ledgerCoverageStatus: "FULL"
      },
      warnings: []
    });

    const context = await seasonPhaseService.updateSeasonLeaguePhase({
      seasonId: "season-2026",
      actingUserId: "commissioner-1",
      nextPhase: "DROP_PHASE"
    });

    expect(mockPrisma.season.update).toHaveBeenCalledWith({
      where: { id: "season-2026" },
      data: { leaguePhase: "DROP_PHASE" }
    });
    expect(context.season.leaguePhase).toBe("DROP_PHASE");
  });

  it("rejects invalid phase transitions", async () => {
    mockSeasonService.assertCommissionerAccess.mockResolvedValueOnce(undefined);
    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "season-2026",
      leaguePhase: "IN_SEASON"
    });

    await expect(
      seasonPhaseService.updateSeasonLeaguePhase({
        seasonId: "season-2026",
        actingUserId: "commissioner-1",
        nextPhase: "DRAFT_PHASE"
      })
    ).rejects.toMatchObject<SeasonPhaseServiceError>({
      statusCode: 409,
      message: "Invalid season phase transition from IN_SEASON to DRAFT_PHASE."
    });
  });
});
