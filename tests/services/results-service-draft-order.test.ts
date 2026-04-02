import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetSeasonLedgerTotalsForDraftOrder } = vi.hoisted(() => ({
  mockPrisma: {
    season: {
      findUnique: vi.fn(),
      count: vi.fn()
    }
  },
  mockGetSeasonLedgerTotalsForDraftOrder: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/ledger-service", () => ({
  ledgerService: {
    getSeasonLedgerTotalsForDraftOrder: mockGetSeasonLedgerTotalsForDraftOrder
  },
  replaceFantasyPayoutEntriesForSeasonTx: vi.fn()
}));

vi.mock("@/server/services/season-service", () => ({
  seasonService: {
    assertCommissionerAccess: vi.fn()
  }
}));

import { resultsService } from "@/server/services/results-service";

function createSourceSeasonStanding(userId: string, rank: number | null, displayName = userId) {
  return {
    leagueMemberId: `source-${userId}`,
    rank,
    leagueMember: {
      userId,
      user: {
        displayName,
        email: `${userId}@example.com`
      }
    }
  };
}

function createLeagueMember(userId: string, displayName = userId) {
  return {
    id: `target-${userId}`,
    userId,
    role: "OWNER" as const,
    user: {
      displayName,
      email: `${userId}@example.com`
    },
    joinedAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

describe("resultsService.getRecommendedOffseasonDraftOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes zero-ledger owners and orders by lowest ledger total first", async () => {
    mockPrisma.season.findUnique
      .mockResolvedValueOnce({
        id: "source-season",
        leagueId: "league-1",
        year: 2025,
        league: {
          members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
        },
        seasonStandings: [createSourceSeasonStanding("user-a", 2, "Alpha"), createSourceSeasonStanding("user-b", 1, "Bravo")]
      })
      .mockResolvedValueOnce({
        id: "target-season",
        leagueId: "league-1",
        year: 2026,
        league: {
          members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
        }
      });

    mockGetSeasonLedgerTotalsForDraftOrder.mockResolvedValueOnce({
      season: { id: "source-season", leagueId: "league-1", year: 2025, name: null, status: "COMPLETED" },
      hasAnyEntries: true,
      totals: [
        {
          leagueMemberId: "source-user-a",
          userId: "user-a",
          displayName: "Alpha",
          email: "user-a@example.com",
          role: "OWNER",
          ledgerTotal: 50,
          entryCount: 2
        },
        {
          leagueMemberId: "source-user-b",
          userId: "user-b",
          displayName: "Bravo",
          email: "user-b@example.com",
          role: "OWNER",
          ledgerTotal: 0,
          entryCount: 0
        }
      ]
    });

    const recommendation = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");

    expect(recommendation.entries.map((entry) => [entry.displayName, entry.ledgerTotal])).toEqual([
      ["Bravo", 0],
      ["Alpha", 50]
    ]);
    expect(recommendation.entries[0].warnings).toContain("No season ledger entries were recorded for this owner.");
    expect(recommendation.readiness.zeroLedgerOwnerCount).toBe(1);
    expect(recommendation.readiness.ledgerCoverageStatus).toBe("PARTIAL");
  });

  it("keeps totals strictly scoped to the source season data returned by the ledger service", async () => {
    mockPrisma.season.findUnique
      .mockResolvedValueOnce({
        id: "source-season",
        leagueId: "league-1",
        year: 2025,
        league: {
          members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
        },
        seasonStandings: [createSourceSeasonStanding("user-a", 2, "Alpha"), createSourceSeasonStanding("user-b", 1, "Bravo")]
      })
      .mockResolvedValueOnce({
        id: "target-season",
        leagueId: "league-1",
        year: 2026,
        league: {
          members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
        }
      });

    mockGetSeasonLedgerTotalsForDraftOrder.mockResolvedValueOnce({
      season: { id: "source-season", leagueId: "league-1", year: 2025, name: null, status: "COMPLETED" },
      hasAnyEntries: true,
      totals: [
        {
          leagueMemberId: "source-user-a",
          userId: "user-a",
          displayName: "Alpha",
          email: "user-a@example.com",
          role: "OWNER",
          ledgerTotal: -10,
          entryCount: 1
        },
        {
          leagueMemberId: "source-user-b",
          userId: "user-b",
          displayName: "Bravo",
          email: "user-b@example.com",
          role: "OWNER",
          ledgerTotal: 25,
          entryCount: 1
        }
      ]
    });

    const recommendation = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");

    expect(recommendation.entries[0].displayName).toBe("Alpha");
    expect(recommendation.entries[0].ledgerTotal).toBe(-10);
    expect(mockGetSeasonLedgerTotalsForDraftOrder).toHaveBeenCalledWith("source-season");
  });

  it("maps source owners into the target season by userId instead of leagueMemberId", async () => {
    mockPrisma.season.findUnique
      .mockResolvedValueOnce({
        id: "source-season",
        leagueId: "league-1",
        year: 2025,
        league: {
          members: [createLeagueMember("user-a", "Alpha")]
        },
        seasonStandings: [createSourceSeasonStanding("user-a", 1, "Alpha")]
      })
      .mockResolvedValueOnce({
        id: "target-season",
        leagueId: "league-1",
        year: 2026,
        league: {
          members: [
            {
              ...createLeagueMember("user-a", "Alpha"),
              id: "different-target-member-id"
            }
          ]
        }
      });

    mockGetSeasonLedgerTotalsForDraftOrder.mockResolvedValueOnce({
      season: { id: "source-season", leagueId: "league-1", year: 2025, name: null, status: "COMPLETED" },
      hasAnyEntries: true,
      totals: [
        {
          leagueMemberId: "source-user-a",
          userId: "user-a",
          displayName: "Alpha",
          email: "user-a@example.com",
          role: "OWNER",
          ledgerTotal: 10,
          entryCount: 1
        }
      ]
    });

    const recommendation = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");

    expect(recommendation.entries[0].sourceLeagueMemberId).toBe("source-user-a");
    expect(recommendation.entries[0].targetLeagueMemberId).toBe("different-target-member-id");
  });

  it("surfaces missing target-season membership clearly instead of silently dropping it", async () => {
    mockPrisma.season.findUnique
      .mockResolvedValueOnce({
        id: "source-season",
        leagueId: "league-1",
        year: 2025,
        league: {
          members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
        },
        seasonStandings: [createSourceSeasonStanding("user-a", 2, "Alpha"), createSourceSeasonStanding("user-b", 1, "Bravo")]
      })
      .mockResolvedValueOnce({
        id: "target-season",
        leagueId: "league-1",
        year: 2026,
        league: {
          members: [createLeagueMember("user-a", "Alpha")]
        }
      });

    mockGetSeasonLedgerTotalsForDraftOrder.mockResolvedValueOnce({
      season: { id: "source-season", leagueId: "league-1", year: 2025, name: null, status: "COMPLETED" },
      hasAnyEntries: true,
      totals: [
        {
          leagueMemberId: "source-user-a",
          userId: "user-a",
          displayName: "Alpha",
          email: "user-a@example.com",
          role: "OWNER",
          ledgerTotal: 10,
          entryCount: 1
        },
        {
          leagueMemberId: "source-user-b",
          userId: "user-b",
          displayName: "Bravo",
          email: "user-b@example.com",
          role: "OWNER",
          ledgerTotal: 20,
          entryCount: 1
        }
      ]
    });

    const recommendation = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");

    expect(recommendation.readiness.allTargetMappingsComplete).toBe(false);
    expect(recommendation.readiness.isReady).toBe(false);
    expect(recommendation.warnings).toContain(
      "One or more source-season owners could not be mapped into the target season by userId."
    );
    expect(recommendation.entries.find((entry) => entry.userId === "user-b")).toMatchObject({
      targetLeagueMemberId: null,
      mappingStatus: "MISSING_TARGET_MEMBER"
    });
  });

  it("uses fantasy rank as the secondary tie-break and display name as the tertiary fallback", async () => {
    mockPrisma.season.findUnique
      .mockResolvedValueOnce({
        id: "source-season",
        leagueId: "league-1",
        year: 2025,
        league: {
          members: [
            createLeagueMember("user-a", "Charlie"),
            createLeagueMember("user-b", "Bravo"),
            createLeagueMember("user-c", "Alpha"),
            createLeagueMember("user-d", "Delta")
          ]
        },
        seasonStandings: [
          createSourceSeasonStanding("user-a", 10, "Charlie"),
          createSourceSeasonStanding("user-b", 9, "Bravo"),
          createSourceSeasonStanding("user-c", null, "Alpha"),
          createSourceSeasonStanding("user-d", null, "Delta")
        ]
      })
      .mockResolvedValueOnce({
        id: "target-season",
        leagueId: "league-1",
        year: 2026,
        league: {
          members: [
            createLeagueMember("user-a", "Charlie"),
            createLeagueMember("user-b", "Bravo"),
            createLeagueMember("user-c", "Alpha"),
            createLeagueMember("user-d", "Delta")
          ]
        }
      });

    mockGetSeasonLedgerTotalsForDraftOrder.mockResolvedValueOnce({
      season: { id: "source-season", leagueId: "league-1", year: 2025, name: null, status: "COMPLETED" },
      hasAnyEntries: true,
      totals: [
        {
          leagueMemberId: "source-user-a",
          userId: "user-a",
          displayName: "Charlie",
          email: "user-a@example.com",
          role: "OWNER",
          ledgerTotal: 0,
          entryCount: 1
        },
        {
          leagueMemberId: "source-user-b",
          userId: "user-b",
          displayName: "Bravo",
          email: "user-b@example.com",
          role: "OWNER",
          ledgerTotal: 0,
          entryCount: 1
        },
        {
          leagueMemberId: "source-user-c",
          userId: "user-c",
          displayName: "Alpha",
          email: "user-c@example.com",
          role: "OWNER",
          ledgerTotal: 0,
          entryCount: 1
        },
        {
          leagueMemberId: "source-user-d",
          userId: "user-d",
          displayName: "Delta",
          email: "user-d@example.com",
          role: "OWNER",
          ledgerTotal: 0,
          entryCount: 1
        }
      ]
    });

    const recommendation = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");

    expect(recommendation.entries.map((entry) => entry.displayName)).toEqual(["Charlie", "Bravo", "Alpha", "Delta"]);
    expect(recommendation.entries[1].tieBreakReason).toBe("FANTASY_RANK");
    expect(recommendation.entries[3].tieBreakReason).toBe("DISPLAY_NAME");
  });

  it("returns the same recommendation on repeated runs with unchanged data", async () => {
    const sourceSeason = {
      id: "source-season",
      leagueId: "league-1",
      year: 2025,
      league: {
        members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
      },
      seasonStandings: [createSourceSeasonStanding("user-a", 2, "Alpha"), createSourceSeasonStanding("user-b", 1, "Bravo")]
    };
    const targetSeason = {
      id: "target-season",
      leagueId: "league-1",
      year: 2026,
      league: {
        members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
      }
    };
    const ledgerTotals = {
      season: { id: "source-season", leagueId: "league-1", year: 2025, name: null, status: "COMPLETED" },
      hasAnyEntries: true,
      totals: [
        {
          leagueMemberId: "source-user-a",
          userId: "user-a",
          displayName: "Alpha",
          email: "user-a@example.com",
          role: "OWNER",
          ledgerTotal: 5,
          entryCount: 1
        },
        {
          leagueMemberId: "source-user-b",
          userId: "user-b",
          displayName: "Bravo",
          email: "user-b@example.com",
          role: "OWNER",
          ledgerTotal: 10,
          entryCount: 1
        }
      ]
    };

    mockPrisma.season.findUnique
      .mockResolvedValueOnce(sourceSeason)
      .mockResolvedValueOnce(targetSeason)
      .mockResolvedValueOnce(sourceSeason)
      .mockResolvedValueOnce(targetSeason);
    mockGetSeasonLedgerTotalsForDraftOrder
      .mockResolvedValueOnce(ledgerTotals)
      .mockResolvedValueOnce(ledgerTotals);

    const first = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");
    const second = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");

    expect(second).toEqual(first);
  });

  it("only changes ordering from standings when standings are needed as an explicit tie-break fallback", async () => {
    const targetSeason = {
      id: "target-season",
      leagueId: "league-1",
      year: 2026,
      league: {
        members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
      }
    };
    const ledgerTotals = {
      season: { id: "source-season", leagueId: "league-1", year: 2025, name: null, status: "COMPLETED" },
      hasAnyEntries: true,
      totals: [
        {
          leagueMemberId: "source-user-a",
          userId: "user-a",
          displayName: "Alpha",
          email: "user-a@example.com",
          role: "OWNER",
          ledgerTotal: 5,
          entryCount: 2
        },
        {
          leagueMemberId: "source-user-b",
          userId: "user-b",
          displayName: "Bravo",
          email: "user-b@example.com",
          role: "OWNER",
          ledgerTotal: 10,
          entryCount: 2
        }
      ]
    };

    mockPrisma.season.findUnique
      .mockResolvedValueOnce({
        id: "source-season",
        leagueId: "league-1",
        year: 2025,
        league: { members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")] },
        seasonStandings: [createSourceSeasonStanding("user-a", 1, "Alpha"), createSourceSeasonStanding("user-b", 2, "Bravo")]
      })
      .mockResolvedValueOnce(targetSeason)
      .mockResolvedValueOnce({
        id: "source-season",
        leagueId: "league-1",
        year: 2025,
        league: { members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")] },
        seasonStandings: [createSourceSeasonStanding("user-a", 2, "Alpha"), createSourceSeasonStanding("user-b", 1, "Bravo")]
      })
      .mockResolvedValueOnce(targetSeason);
    mockGetSeasonLedgerTotalsForDraftOrder
      .mockResolvedValueOnce(ledgerTotals)
      .mockResolvedValueOnce(ledgerTotals);

    const first = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");
    const second = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");

    expect(first.entries.map((entry) => entry.displayName)).toEqual(["Alpha", "Bravo"]);
    expect(second.entries.map((entry) => entry.displayName)).toEqual(["Alpha", "Bravo"]);
  });

  it("reflects commissioner ledger adjustments in the final recommendation totals", async () => {
    mockPrisma.season.findUnique
      .mockResolvedValueOnce({
        id: "source-season",
        leagueId: "league-1",
        year: 2025,
        league: {
          members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
        },
        seasonStandings: [createSourceSeasonStanding("user-a", 2, "Alpha"), createSourceSeasonStanding("user-b", 1, "Bravo")]
      })
      .mockResolvedValueOnce({
        id: "target-season",
        leagueId: "league-1",
        year: 2026,
        league: {
          members: [createLeagueMember("user-a", "Alpha"), createLeagueMember("user-b", "Bravo")]
        }
      });

    mockGetSeasonLedgerTotalsForDraftOrder.mockResolvedValueOnce({
      season: { id: "source-season", leagueId: "league-1", year: 2025, name: null, status: "COMPLETED" },
      hasAnyEntries: true,
      totals: [
        {
          leagueMemberId: "source-user-a",
          userId: "user-a",
          displayName: "Alpha",
          email: "user-a@example.com",
          role: "OWNER",
          ledgerTotal: 30,
          entryCount: 3
        },
        {
          leagueMemberId: "source-user-b",
          userId: "user-b",
          displayName: "Bravo",
          email: "user-b@example.com",
          role: "OWNER",
          ledgerTotal: -15,
          entryCount: 2
        }
      ]
    });

    const recommendation = await resultsService.getRecommendedOffseasonDraftOrder("source-season", "target-season");

    expect(recommendation.entries[0]).toMatchObject({
      displayName: "Bravo",
      ledgerTotal: -15
    });
  });
});
