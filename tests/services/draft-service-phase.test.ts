import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockPhaseService } = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    draft: {
      findUnique: vi.fn()
    }
  },
  mockPhaseService: {
    assertPhaseAllowsDraftPreparation: vi.fn(),
    assertPhaseAllowsDraftExecution: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/results-service", () => ({
  resultsService: {}
}));

vi.mock("@/server/services/season-service", () => ({
  seasonService: {}
}));

vi.mock("@/server/services/season-phase-service", async () => {
  const actual = await vi.importActual<typeof import("@/server/services/season-phase-service")>(
    "@/server/services/season-phase-service"
  );

  return {
    ...actual,
    seasonPhaseService: mockPhaseService
  };
});

import { DraftServiceError, draftService } from "@/server/services/draft-service";
import { SeasonPhaseServiceError } from "@/server/services/season-phase-service";

describe("draftService phase gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks draft initialization outside DRAFT_PHASE", async () => {
    mockPhaseService.assertPhaseAllowsDraftPreparation.mockRejectedValueOnce(
      new SeasonPhaseServiceError(
        "Offseason draft actions are only available during DRAFT_PHASE. Current phase: POST_SEASON.",
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
    ).rejects.toMatchObject<DraftServiceError>({
      statusCode: 409,
      message: "Offseason draft actions are only available during DRAFT_PHASE. Current phase: POST_SEASON."
    });
  });

  it("blocks draft execution outside DRAFT_PHASE", async () => {
    mockPrisma.draft.findUnique.mockResolvedValueOnce({
      targetSeasonId: "target-season"
    });
    mockPhaseService.assertPhaseAllowsDraftExecution.mockRejectedValueOnce(
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
    ).rejects.toMatchObject<DraftServiceError>({
      statusCode: 409,
      message: "Draft execution is only available during DRAFT_PHASE. Current phase: DROP_PHASE."
    });
  });
});
