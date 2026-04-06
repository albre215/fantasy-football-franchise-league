import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockSeasonPhaseService } = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    draft: {
      findUnique: vi.fn()
    },
    leagueMember: {
      findUnique: vi.fn()
    }
  },
  mockSeasonPhaseService: {
    assertPhaseAllowsDraftWorkspaceManagement: vi.fn(),
    assertPhaseAllowsKeeperReleaseEditing: vi.fn(),
    assertPhaseAllowsDraftPreparation: vi.fn(),
    assertPhaseAllowsDraftExecution: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/results-service", () => ({
  resultsService: {
    getRecommendedOffseasonDraftOrder: vi.fn()
  }
}));

vi.mock("@/server/services/season-service", () => ({
  seasonService: {
    assertCommissionerAccess: vi.fn()
  }
}));

vi.mock("@/server/services/season-phase-service", () => ({
  seasonPhaseService: mockSeasonPhaseService,
  SeasonPhaseServiceError: class SeasonPhaseServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number
    ) {
      super(message);
      this.name = "SeasonPhaseServiceError";
    }
  }
}));

import { draftService } from "@/server/services/draft-service";
import { SeasonPhaseServiceError } from "@/server/services/season-phase-service";

describe("draftService phase gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks draft initialization outside DRAFT_PHASE", async () => {
    mockSeasonPhaseService.assertPhaseAllowsDraftWorkspaceManagement.mockRejectedValueOnce(
      new SeasonPhaseServiceError(
        "Draft workspace management is only available during DROP_PHASE or DRAFT_PHASE. Current phase: POST_SEASON.",
        409
      )
    );

    await expect(
      draftService.initializeDraft({
        targetSeasonId: "target-season",
        sourceSeasonId: "source-season",
        actingUserId: "commissioner-1",
        orderLeagueMemberIds: Array.from({ length: 10 }, (_, index) => `member-${index + 1}`)
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Draft workspace management is only available during DROP_PHASE or DRAFT_PHASE. Current phase: POST_SEASON."
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks keeper saves outside DROP_PHASE", async () => {
    mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
      mockPrisma.draft.findUnique.mockResolvedValueOnce({
        id: "draft-1",
        leagueId: "league-1",
        targetSeasonId: "target-season"
      });
      mockPrisma.leagueMember.findUnique.mockResolvedValueOnce({
        id: "member-1",
        role: "COMMISSIONER"
      });

      return callback(mockPrisma);
    });
    mockSeasonPhaseService.assertPhaseAllowsKeeperReleaseEditing.mockRejectedValueOnce(
      new SeasonPhaseServiceError(
        "Keeper and release editing is only available during DROP_PHASE. Current phase: DRAFT_PHASE.",
        409
      )
    );

    await expect(
      draftService.saveKeepers({
        draftId: "draft-1",
        leagueMemberId: "member-2",
        nflTeamIds: ["team-1", "team-2"],
        actingUserId: "commissioner-1"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Keeper and release editing is only available during DROP_PHASE. Current phase: DRAFT_PHASE."
    });
  });

  it("blocks draft start outside DRAFT_PHASE", async () => {
    mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
      mockPrisma.draft.findUnique.mockResolvedValueOnce({
        id: "draft-1",
        leagueId: "league-1",
        targetSeasonId: "target-season"
      });
      mockPrisma.leagueMember.findUnique.mockResolvedValueOnce({
        id: "member-1",
        role: "COMMISSIONER"
      });

      return callback(mockPrisma);
    });
    mockSeasonPhaseService.assertPhaseAllowsDraftExecution.mockRejectedValueOnce(
      new SeasonPhaseServiceError(
        "Draft execution is only available during DRAFT_PHASE. Current phase: DROP_PHASE.",
        409
      )
    );

    await expect(
      draftService.startDraft({
        draftId: "draft-1",
        actingUserId: "commissioner-1"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Draft execution is only available during DRAFT_PHASE. Current phase: DROP_PHASE."
    });
  });
});
