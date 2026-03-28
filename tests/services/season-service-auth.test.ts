import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    season: {
      findUnique: vi.fn()
    },
    leagueMember: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

import { SeasonServiceError, seasonService } from "@/server/services/season-service";

describe("seasonService.assertCommissionerAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects wrong or missing season context", async () => {
    mockPrisma.season.findUnique.mockResolvedValueOnce(null);

    await expect(seasonService.assertCommissionerAccess("missing-season", "user-1")).rejects.toMatchObject<
      SeasonServiceError
    >({
      message: "Season not found.",
      statusCode: 404
    });
  });

  it("rejects authenticated owners for commissioner-only season actions", async () => {
    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "season-1",
      leagueId: "league-1",
      isLocked: false
    });
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce({
      id: "member-1",
      role: "OWNER"
    });

    await expect(seasonService.assertCommissionerAccess("season-1", "user-1")).rejects.toMatchObject<
      SeasonServiceError
    >({
      message: "Only the commissioner can perform this action.",
      statusCode: 403
    });
  });
});
