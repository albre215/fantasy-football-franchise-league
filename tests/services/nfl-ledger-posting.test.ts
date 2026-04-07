import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockReplaceSeasonNflLedgerEntriesForSeasonTx, mockAssertCommissionerAccess } = vi.hoisted(() => ({
  mockPrisma: {
    season: {
      findUnique: vi.fn()
    },
    seasonNflTeamResult: {
      findMany: vi.fn()
    },
    seasonNflImportRun: {
      findMany: vi.fn()
    },
    ledgerEntry: {
      findMany: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  },
  mockReplaceSeasonNflLedgerEntriesForSeasonTx: vi.fn(),
  mockAssertCommissionerAccess: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/ledger-service", () => ({
  replaceSeasonNflLedgerEntriesForSeasonTx: mockReplaceSeasonNflLedgerEntriesForSeasonTx
}));

vi.mock("@/server/services/season-service", () => ({
  seasonService: {
    assertCommissionerAccess: mockAssertCommissionerAccess
  }
}));

import { nflPerformanceService } from "@/server/services/nfl-performance-service";

function createMember(id: string, userId: string, displayName: string) {
  return {
    id,
    userId,
    role: "OWNER" as const,
    user: {
      displayName,
      email: `${userId}@example.com`
    }
  };
}

function createTeam(id: string, abbreviation: string, name: string) {
  return {
    id,
    abbreviation,
    name
  };
}

describe("nflPerformanceService NFL ledger posting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
  });

  it("builds owner NFL ledger rollups from same-season ownership and persisted results only", async () => {
    const ownerA = createMember("member-a", "user-a", "Alpha");
    const ownerB = createMember("member-b", "user-b", "Bravo");

    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "season-1",
      leagueId: "league-1",
      year: 2025,
      name: "2025 Season",
      status: "COMPLETED",
      league: {
        members: [ownerA, ownerB]
      },
      teamOwnerships: [
        { nflTeamId: "team-a1", leagueMemberId: ownerA.id, nflTeam: createTeam("team-a1", "AAA", "Alpha 1"), leagueMember: ownerA },
        { nflTeamId: "team-a2", leagueMemberId: ownerA.id, nflTeam: createTeam("team-a2", "AAB", "Alpha 2"), leagueMember: ownerA },
        { nflTeamId: "team-a3", leagueMemberId: ownerA.id, nflTeam: createTeam("team-a3", "AAC", "Alpha 3"), leagueMember: ownerA },
        { nflTeamId: "team-b1", leagueMemberId: ownerB.id, nflTeam: createTeam("team-b1", "BBA", "Bravo 1"), leagueMember: ownerB },
        { nflTeamId: "team-b2", leagueMemberId: ownerB.id, nflTeam: createTeam("team-b2", "BBB", "Bravo 2"), leagueMember: ownerB },
        { nflTeamId: "team-b3", leagueMemberId: ownerB.id, nflTeam: createTeam("team-b3", "BBC", "Bravo 3"), leagueMember: ownerB }
      ]
    });
    mockPrisma.seasonNflTeamResult.findMany.mockResolvedValueOnce([
      { id: "r1", seasonId: "season-1", seasonYear: 2025, weekNumber: 1, phase: "REGULAR_SEASON", nflTeamId: "team-a1", result: "WIN", pointsFor: 24, pointsAgainst: 17 },
      { id: "r2", seasonId: "season-1", seasonYear: 2025, weekNumber: 2, phase: "REGULAR_SEASON", nflTeamId: "team-a2", result: "LOSS", pointsFor: 10, pointsAgainst: 20 },
      { id: "r3", seasonId: "season-1", seasonYear: 2025, weekNumber: 19, phase: "WILD_CARD", nflTeamId: "team-a3", result: "WIN", pointsFor: 30, pointsAgainst: 21 },
      { id: "r4", seasonId: "season-1", seasonYear: 2025, weekNumber: 1, phase: "REGULAR_SEASON", nflTeamId: "team-b1", result: "LOSS", pointsFor: 14, pointsAgainst: 28 }
    ]);
    mockPrisma.seasonNflImportRun.findMany.mockResolvedValueOnce([
      {
        id: "run-1",
        seasonId: "season-1",
        seasonYear: 2025,
        provider: "NFLVERSE",
        mode: "FULL_SEASON",
        weekNumber: null,
        status: "COMPLETED",
        actingUserId: "commissioner-1",
        importedResultCount: 4,
        warnings: null,
        errorMessage: null,
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        completedAt: new Date("2026-01-02T00:00:00.000Z")
      }
    ]);
    mockPrisma.ledgerEntry.findMany.mockResolvedValueOnce([]);

    const preview = await nflPerformanceService.getSeasonNflLedgerPostingPreview("season-1", "user-a");

    expect(preview.isReadyToPost).toBe(false);
    expect(preview.readiness.hasCompletedFullSeasonImport).toBe(true);
    expect(preview.ownerRollups.find((entry) => entry.userId === "user-a")).toMatchObject({
      regularSeasonAmount: 1,
      playoffAmount: 1,
      nflLedgerAmount: 2
    });
    expect(preview.ownerRollups.find((entry) => entry.userId === "user-b")).toMatchObject({
      regularSeasonAmount: 0,
      playoffAmount: 0,
      nflLedgerAmount: 0
    });
    expect(preview.readiness.missingOwnedTeamIds).toEqual(["team-b2", "team-b3"]);
  });

  it("surfaces incomplete coverage honestly and blocks posting until ready", async () => {
    const owner = createMember("member-a", "user-a", "Alpha");

    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "season-1",
      leagueId: "league-1",
      year: 2025,
      name: "2025 Season",
      status: "ACTIVE",
      league: {
        members: [owner]
      },
      teamOwnerships: [
        { nflTeamId: "team-a1", leagueMemberId: owner.id, nflTeam: createTeam("team-a1", "AAA", "Alpha 1"), leagueMember: owner },
        { nflTeamId: "team-a2", leagueMemberId: owner.id, nflTeam: createTeam("team-a2", "AAB", "Alpha 2"), leagueMember: owner },
        { nflTeamId: "team-a3", leagueMemberId: owner.id, nflTeam: createTeam("team-a3", "AAC", "Alpha 3"), leagueMember: owner }
      ]
    });
    mockPrisma.seasonNflTeamResult.findMany.mockResolvedValueOnce([
      { id: "r1", seasonId: "season-1", seasonYear: 2025, weekNumber: 1, phase: "REGULAR_SEASON", nflTeamId: "team-a1", result: "WIN", pointsFor: 17, pointsAgainst: 14 }
    ]);
    mockPrisma.seasonNflImportRun.findMany.mockResolvedValueOnce([
      {
        id: "run-1",
        seasonId: "season-1",
        seasonYear: 2025,
        provider: "NFLVERSE",
        mode: "SINGLE_WEEK",
        weekNumber: 1,
        status: "COMPLETED",
        actingUserId: "commissioner-1",
        importedResultCount: 1,
        warnings: null,
        errorMessage: null,
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        completedAt: new Date("2026-01-01T01:00:00.000Z")
      }
    ]);
    mockPrisma.ledgerEntry.findMany.mockResolvedValueOnce([]);

    const preview = await nflPerformanceService.getSeasonNflLedgerPostingPreview("season-1", "user-a");

    expect(preview.isReadyToPost).toBe(false);
    expect(preview.coverageStatus).toBe("PARTIAL");
    expect(preview.warnings).toContain("NFL result coverage is not yet marked as a completed full-season import.");
    expect(preview.readiness.hasMissingOwnedTeamResults).toBe(true);
  });

  it("posts by replacing only season-scoped NFL ledger entries from the deterministic preview", async () => {
    const owner = createMember("member-a", "user-a", "Alpha");
    const seasonContext = {
      id: "season-1",
      leagueId: "league-1",
      year: 2025,
      name: "2025 Season",
      status: "COMPLETED",
      league: {
        members: [owner]
      },
      teamOwnerships: [
        { nflTeamId: "team-a1", leagueMemberId: owner.id, nflTeam: createTeam("team-a1", "AAA", "Alpha 1"), leagueMember: owner },
        { nflTeamId: "team-a2", leagueMemberId: owner.id, nflTeam: createTeam("team-a2", "AAB", "Alpha 2"), leagueMember: owner },
        { nflTeamId: "team-a3", leagueMemberId: owner.id, nflTeam: createTeam("team-a3", "AAC", "Alpha 3"), leagueMember: owner }
      ]
    };
    const results = [
      { id: "r1", seasonId: "season-1", seasonYear: 2025, weekNumber: 1, phase: "REGULAR_SEASON", nflTeamId: "team-a1", result: "WIN", pointsFor: 17, pointsAgainst: 14 },
      { id: "r2", seasonId: "season-1", seasonYear: 2025, weekNumber: 20, phase: "DIVISIONAL", nflTeamId: "team-a2", result: "WIN", pointsFor: 27, pointsAgainst: 17 },
      { id: "r3", seasonId: "season-1", seasonYear: 2025, weekNumber: 2, phase: "REGULAR_SEASON", nflTeamId: "team-a3", result: "LOSS", pointsFor: 10, pointsAgainst: 13 }
    ];
    const importRuns = [
      {
        id: "run-1",
        seasonId: "season-1",
        seasonYear: 2025,
        provider: "NFLVERSE",
        mode: "FULL_SEASON",
        weekNumber: null,
        status: "COMPLETED",
        actingUserId: "commissioner-1",
        importedResultCount: 3,
        warnings: null,
        errorMessage: null,
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        completedAt: new Date("2026-01-02T00:00:00.000Z")
      }
    ];

    mockAssertCommissionerAccess.mockResolvedValueOnce(undefined);
    mockPrisma.season.findUnique.mockResolvedValueOnce(seasonContext);
    mockPrisma.seasonNflTeamResult.findMany.mockResolvedValueOnce(results);
    mockPrisma.seasonNflImportRun.findMany.mockResolvedValueOnce(importRuns);
    mockPrisma.ledgerEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "ledger-1",
          seasonId: "season-1",
          leagueId: "league-1",
          leagueMemberId: owner.id,
          category: "NFL_REGULAR_SEASON",
          amount: 1,
          description: "NFL regular season posting for Alpha",
          metadata: null,
          actingUserId: "commissioner-1",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
          leagueMember: {
            ...owner,
            user: owner.user
          }
        }
      ]);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "commissioner-1",
      displayName: "Commissioner",
      email: "commish@example.com"
    });

    const preview = await nflPerformanceService.postSeasonNflResultsToLedger("season-1", "commissioner-1");

    expect(mockReplaceSeasonNflLedgerEntriesForSeasonTx).toHaveBeenCalledWith(mockPrisma, {
      seasonId: "season-1",
      leagueId: "league-1",
      actingUserId: "commissioner-1",
      ownerEntries: [
        expect.objectContaining({
          leagueMemberId: owner.id,
          regularSeasonAmount: 1,
          playoffAmount: 1
        })
      ]
    });
    expect(preview.postingStatus).toBe("POSTED");
    expect(preview.alreadyPosted).toBe(true);
    expect(preview.lastPostedBy?.displayName).toBe("Commissioner");
  });
});
