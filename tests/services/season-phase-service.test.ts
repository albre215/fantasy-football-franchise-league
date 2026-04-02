import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockSeasonService } = vi.hoisted(() => ({
  mockPrisma: {
    season: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn()
  },
  mockSeasonService: {
    assertCommissionerAccess: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/season-service", () => ({
  seasonService: mockSeasonService
}));

import {
  seasonPhaseService,
  SeasonPhaseServiceError
} from "@/server/services/season-phase-service";

describe("seasonPhaseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
      callback(mockPrisma)
    );
  });

  it("builds phase context with honest readiness and warnings", async () => {
    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "season-2",
      leagueId: "league-1",
      year: 2025,
      name: "2025 Season",
      status: "ACTIVE",
      leaguePhase: "POST_SEASON",
      isLocked: false,
      league: {
        members: [
          {
            id: "target-member-1",
            userId: "user-1",
            role: "OWNER",
            user: { displayName: "Alpha", email: "alpha@test.com" }
          },
          {
            id: "target-member-2",
            userId: "user-2",
            role: "OWNER",
            user: { displayName: "Beta", email: "beta@test.com" }
          }
        ]
      },
      targetDraft: {
        id: "draft-1",
        status: "PLANNING"
      }
    });
    mockPrisma.season.findFirst.mockResolvedValueOnce({
      id: "season-1",
      seasonStandings: [
        {
          rank: 1,
          leagueMember: {
            userId: "user-1",
            user: { displayName: "Alpha" }
          }
        }
      ]
    });

    const phase = await seasonPhaseService.getSeasonPhaseContext("season-2");

    expect(phase.season.leaguePhase).toBe("POST_SEASON");
    expect(phase.allowedActions.canReviewResults).toBe(true);
    expect(phase.allowedActions.canPrepareDraft).toBe(false);
    expect(phase.readiness.hasPreviousSeason).toBe(true);
    expect(phase.readiness.hasFinalStandings).toBe(false);
    expect(phase.readiness.hasDraftWorkspace).toBe(true);
    expect(phase.warnings).toContain("Final standings for the immediately previous season are not complete yet.");
    expect(phase.availableTransitions).toEqual([
      {
        nextPhase: "DROP_PHASE",
        warnings: [
          "The offseason recommendation is not ready yet.",
          "Not every previous-season owner maps cleanly into the current season."
        ]
      }
    ]);
  });

  it("updates a valid forward phase transition", async () => {
    mockSeasonService.assertCommissionerAccess.mockResolvedValueOnce({
      season: {
        id: "season-2"
      }
    });
    mockPrisma.season.findUnique
      .mockResolvedValueOnce({
        id: "season-2",
        leaguePhase: "POST_SEASON"
      })
      .mockResolvedValueOnce({
        id: "season-2",
        leagueId: "league-1",
        year: 2025,
        name: "2025 Season",
        status: "ACTIVE",
        leaguePhase: "DROP_PHASE",
        isLocked: false,
        league: {
          members: [
            {
              id: "target-member-1",
              userId: "user-1",
              role: "OWNER",
              user: { displayName: "Alpha", email: "alpha@test.com" }
            }
          ]
        },
        targetDraft: null
      })
      .mockResolvedValueOnce({
        id: "season-2",
        leagueId: "league-1",
        year: 2025,
        name: "2025 Season",
        status: "ACTIVE",
        leaguePhase: "DROP_PHASE",
        isLocked: false,
        startsAt: null,
        endsAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      });
    mockPrisma.season.update.mockResolvedValueOnce({
      id: "season-2",
      leaguePhase: "DROP_PHASE"
    });
    mockPrisma.season.findFirst.mockResolvedValueOnce(null);

    const result = await seasonPhaseService.updateSeasonLeaguePhase({
      seasonId: "season-2",
      nextPhase: "DROP_PHASE",
      actingUserId: "user-commissioner"
    });

    expect(mockPrisma.season.update).toHaveBeenCalledWith({
      where: {
        id: "season-2"
      },
      data: {
        leaguePhase: "DROP_PHASE"
      }
    });
    expect(result.phase.season.leaguePhase).toBe("DROP_PHASE");
  });

  it("rejects invalid phase transitions", async () => {
    mockSeasonService.assertCommissionerAccess.mockResolvedValueOnce({
      season: {
        id: "season-2"
      }
    });
    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "season-2",
      leaguePhase: "IN_SEASON"
    });

    await expect(
      seasonPhaseService.updateSeasonLeaguePhase({
        seasonId: "season-2",
        nextPhase: "DRAFT_PHASE",
        actingUserId: "user-commissioner"
      })
    ).rejects.toMatchObject<SeasonPhaseServiceError>({
      statusCode: 409,
      message: "Invalid phase transition from IN_SEASON to DRAFT_PHASE."
    });
  });
});
