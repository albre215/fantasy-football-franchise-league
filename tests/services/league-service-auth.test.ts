import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    leagueMember: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

import { LeagueServiceError, leagueService } from "@/server/services/league-service";

describe("leagueService.assertCommissionerAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects authenticated non-members", async () => {
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce(null);

    await expect(leagueService.assertCommissionerAccess("league-1", "user-1")).rejects.toMatchObject<
      LeagueServiceError
    >({
      message: "Only the commissioner can perform this action.",
      statusCode: 403
    });
  });

  it("rejects owners for commissioner-only actions", async () => {
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce({
      id: "member-1",
      role: "OWNER"
    });

    await expect(leagueService.assertCommissionerAccess("league-1", "user-1")).rejects.toMatchObject<
      LeagueServiceError
    >({
      message: "Only the commissioner can perform this action.",
      statusCode: 403
    });
  });

  it("allows commissioners", async () => {
    mockPrisma.leagueMember.findUnique.mockResolvedValueOnce({
      id: "member-1",
      role: "COMMISSIONER"
    });

    await expect(leagueService.assertCommissionerAccess("league-1", "user-1")).resolves.toEqual({
      id: "member-1",
      role: "COMMISSIONER"
    });
  });
});
