import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockResultsService } = vi.hoisted(() => ({
  mockPrisma: {
    season: {
      findUnique: vi.fn(),
      findFirst: vi.fn()
    }
  },
  mockResultsService: {
    getRecommendedOffseasonDraftOrder: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/results-service", () => ({
  resultsService: mockResultsService
}));

import { dropPhaseService } from "@/server/services/drop-phase-service";

function createTargetMember(userId: string, displayName = userId) {
  return {
    id: `target-${userId}`,
    userId,
    role: "OWNER" as const,
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    user: {
      displayName,
      email: `${userId}@example.com`
    }
  };
}

function createOwnership(userId: string, teamId: string, teamName: string, slot: number) {
  return {
    nflTeamId: teamId,
    slot,
    nflTeam: {
      id: teamId,
      name: teamName,
      abbreviation: teamName.slice(0, 3).toUpperCase(),
      conference: "AFC" as const,
      division: "East"
    },
    leagueMember: {
      id: `source-${userId}`,
      userId,
      role: "OWNER" as const,
      user: {
        displayName: userId,
        email: `${userId}@example.com`
      }
    }
  };
}

describe("dropPhaseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps previous-season ownership into the target season by userId and derives the released pool", async () => {
    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "target-season",
      leagueId: "league-1",
      year: 2026,
      name: null,
      status: "PLANNING",
      leaguePhase: "DROP_PHASE",
      league: {
        members: [createTargetMember("user-a", "Alpha"), createTargetMember("user-b", "Bravo")]
      },
      targetDraft: {
        id: "draft-1",
        status: "PLANNING",
        sourceSeasonId: "source-season",
        keeperSelections: [
          {
            leagueMemberId: "target-user-a",
            nflTeamId: "team-a1",
            nflTeam: {
              id: "team-a1",
              name: "Alpha One",
              abbreviation: "A1",
              conference: "AFC",
              division: "East"
            }
          },
          {
            leagueMemberId: "target-user-a",
            nflTeamId: "team-a2",
            nflTeam: {
              id: "team-a2",
              name: "Alpha Two",
              abbreviation: "A2",
              conference: "AFC",
              division: "East"
            }
          },
          {
            leagueMemberId: "target-user-b",
            nflTeamId: "team-b1",
            nflTeam: {
              id: "team-b1",
              name: "Bravo One",
              abbreviation: "B1",
              conference: "AFC",
              division: "East"
            }
          },
          {
            leagueMemberId: "target-user-b",
            nflTeamId: "team-b2",
            nflTeam: {
              id: "team-b2",
              name: "Bravo Two",
              abbreviation: "B2",
              conference: "AFC",
              division: "East"
            }
          }
        ]
      }
    });
    mockPrisma.season.findFirst.mockResolvedValueOnce({
      id: "source-season",
      year: 2025,
      name: null,
      teamOwnerships: [
        createOwnership("user-a", "team-a1", "Alpha One", 1),
        createOwnership("user-a", "team-a2", "Alpha Two", 2),
        createOwnership("user-a", "team-a3", "Alpha Three", 3),
        createOwnership("user-b", "team-b1", "Bravo One", 1),
        createOwnership("user-b", "team-b2", "Bravo Two", 2),
        createOwnership("user-b", "team-b3", "Bravo Three", 3)
      ]
    });
    mockResultsService.getRecommendedOffseasonDraftOrder.mockResolvedValueOnce({
      readiness: {
        isReady: true,
        allTargetMappingsComplete: true,
        ledgerCoverageStatus: "FULL"
      },
      warnings: []
    });

    const context = await dropPhaseService.getDropPhaseContext("target-season");

    expect(context.ownersCompleteCount).toBe(2);
    expect(context.isReadyForDraftPhase).toBe(true);
    expect(context.owners[0]).toMatchObject({
      userId: "user-a",
      targetLeagueMemberId: "target-user-a",
      sourceLeagueMemberId: "source-user-a",
      keptTeamIds: ["team-a1", "team-a2"]
    });
    expect(context.owners[0].releasedTeam?.id).toBe("team-a3");
    expect(context.releasedTeamPool.map((team) => team.id)).toEqual(["team-a3", "team-b3"]);
  });

  it("surfaces incomplete keeper selections and invalid previous-season portfolio sizes honestly", async () => {
    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "target-season",
      leagueId: "league-1",
      year: 2026,
      name: null,
      status: "PLANNING",
      leaguePhase: "DROP_PHASE",
      league: {
        members: [createTargetMember("user-a", "Alpha"), createTargetMember("user-b", "Bravo")]
      },
      targetDraft: {
        id: "draft-1",
        status: "PLANNING",
        sourceSeasonId: "source-season",
        keeperSelections: [
          {
            leagueMemberId: "target-user-a",
            nflTeamId: "team-a1",
            nflTeam: {
              id: "team-a1",
              name: "Alpha One",
              abbreviation: "A1",
              conference: "AFC",
              division: "East"
            }
          }
        ]
      }
    });
    mockPrisma.season.findFirst.mockResolvedValueOnce({
      id: "source-season",
      year: 2025,
      name: null,
      teamOwnerships: [
        createOwnership("user-a", "team-a1", "Alpha One", 1),
        createOwnership("user-a", "team-a2", "Alpha Two", 2),
        createOwnership("user-a", "team-a3", "Alpha Three", 3),
        createOwnership("user-b", "team-b1", "Bravo One", 1),
        createOwnership("user-b", "team-b2", "Bravo Two", 2)
      ]
    });
    mockResultsService.getRecommendedOffseasonDraftOrder.mockResolvedValueOnce({
      readiness: {
        isReady: true,
        allTargetMappingsComplete: true,
        ledgerCoverageStatus: "FULL"
      },
      warnings: []
    });

    const context = await dropPhaseService.getDropPhaseContext("target-season");

    expect(context.isReadyForDraftPhase).toBe(false);
    expect(context.ownersCompleteCount).toBe(0);
    expect(context.warnings).toContain(
      "Every owner must keep exactly 2 teams and release exactly 1 team before entering DRAFT_PHASE."
    );
    expect(context.owners.find((owner) => owner.userId === "user-b")?.warnings).toContain(
      "This owner does not have exactly 3 teams in the previous season."
    );
  });
});
