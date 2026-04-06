import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPrisma,
  mockDraftService,
  mockDropPhaseService,
  mockHistoryService,
  mockLedgerService,
  mockResultsService,
  mockSeasonPhaseService,
  mockTeamOwnershipService
} = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn()
    },
    leagueMember: {
      findMany: vi.fn()
    },
    season: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  },
  mockDraftService: {
    getDraftStateByTargetSeason: vi.fn()
  },
  mockDropPhaseService: {
    getDropPhaseContext: vi.fn()
  },
  mockHistoryService: {
    getOwnerHistory: vi.fn()
  },
  mockLedgerService: {
    getOwnerFinancialHistory: vi.fn(),
    getLeagueMemberSeasonLedger: vi.fn()
  },
  mockResultsService: {
    getSeasonResults: vi.fn()
  },
  mockSeasonPhaseService: {
    getSeasonPhaseContext: vi.fn()
  },
  mockTeamOwnershipService: {
    getUserTeamsForSeason: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/draft-service", () => ({
  draftService: mockDraftService
}));

vi.mock("@/server/services/drop-phase-service", () => ({
  dropPhaseService: mockDropPhaseService
}));

vi.mock("@/server/services/history-service", () => ({
  historyService: mockHistoryService
}));

vi.mock("@/server/services/ledger-service", () => ({
  ledgerService: mockLedgerService
}));

vi.mock("@/server/services/results-service", () => ({
  resultsService: mockResultsService
}));

vi.mock("@/server/services/season-phase-service", () => ({
  seasonPhaseService: mockSeasonPhaseService
}));

vi.mock("@/server/services/team-ownership-service", () => ({
  teamOwnershipService: mockTeamOwnershipService
}));

import { ownerService } from "@/server/services/owner-service";

describe("ownerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a read-only dashboard from the authenticated user's current seasons, finances, and history", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      displayName: "Owner One",
      email: "owner1@example.com"
    });
    mockPrisma.leagueMember.findMany.mockResolvedValueOnce([
      {
        leagueId: "league-1",
        role: "OWNER",
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        league: {
          leagueCode: "GMF-101",
          name: "Alpha League",
          slug: "alpha-league"
        }
      }
    ]);
    mockPrisma.season.findMany
      .mockResolvedValueOnce([
        {
          id: "season-2026",
          leagueId: "league-1",
          year: 2026,
          name: null,
          status: "ACTIVE",
          league: {
            name: "Alpha League",
            leagueCode: "GMF-101",
            members: [{ id: "member-1", role: "OWNER" }]
          }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "season-2025",
          year: 2025,
          name: null,
          leagueId: "league-1",
          league: {
            name: "Alpha League",
            leagueCode: "GMF-101"
          },
          seasonStandings: [{ rank: 2, isChampion: false }]
        }
      ]);
    mockTeamOwnershipService.getUserTeamsForSeason.mockResolvedValueOnce([
      {
        team: {
          id: "team-1",
          name: "Team One",
          abbreviation: "ONE",
          conference: "AFC",
          division: "East"
        }
      }
    ]);
    mockLedgerService.getLeagueMemberSeasonLedger.mockResolvedValueOnce({
      totals: {
        net: 25
      },
      entries: []
    });
    mockResultsService.getSeasonResults.mockResolvedValueOnce({
      seasonStandings: [
        { userId: "user-1", rank: 3, isChampion: false },
        { userId: "user-2", rank: 1, isChampion: true }
      ]
    });
    mockSeasonPhaseService.getSeasonPhaseContext.mockResolvedValueOnce({
      season: {
        leaguePhase: "IN_SEASON"
      }
    });
    mockDraftService.getDraftStateByTargetSeason.mockResolvedValueOnce({
      draft: {
        status: "PLANNING",
        picksCompleted: 0,
        totalPicks: 10
      },
      currentPick: null,
      picks: [{ selectingLeagueMemberId: "member-1", overallPickNumber: 4 }],
      members: [
        {
          userId: "user-1",
          leagueMemberId: "member-1",
          draftedTeam: null
        }
      ]
    });
    mockLedgerService.getOwnerFinancialHistory.mockResolvedValueOnce([
      {
        leagueId: "league-1",
        leagueCode: "GMF-101",
        leagueName: "Alpha League",
        seasonId: "season-2025",
        seasonYear: 2025,
        seasonName: null,
        entryCount: 2,
        totalPositive: 40,
        totalNegative: -15,
        ledgerTotal: 25
      }
    ]);
    mockHistoryService.getOwnerHistory.mockResolvedValueOnce({
      rows: [
        {
          seasonId: "season-2025",
          seasonYear: 2025,
          seasonName: null,
          teams: [
            {
              team: {
                id: "team-1",
                name: "Team One",
                abbreviation: "ONE",
                conference: "AFC",
                division: "East"
              },
              slot: 1,
              acquisitionType: "KEEPER",
              draftPickNumber: null
            }
          ]
        }
      ]
    });

    const dashboard = await ownerService.getOwnerDashboard("user-1");

    expect(dashboard.currentSeasons[0]).toMatchObject({
      leagueId: "league-1",
      seasonId: "season-2026",
      phase: "IN_SEASON",
      ledgerTotal: 25,
      standing: {
        rank: 3,
        isChampion: false
      }
    });
    expect(dashboard.currentSeasons[0].draftStatus).toMatchObject({
      draftPosition: 4,
      status: "PLANNING"
    });
    expect(dashboard.financialSummary.cumulativeEarnings).toBe(25);
    expect(dashboard.history[0]).toMatchObject({
      seasonId: "season-2025",
      finalPlacement: 2,
      ledgerTotal: 25
    });
  });

  it("returns only the authenticated owner's season data and no other owner's ledger entries", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      displayName: "Owner One",
      email: "owner1@example.com"
    });
    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "season-2026",
      leagueId: "league-1",
      year: 2026,
      name: null,
      status: "ACTIVE",
      league: {
        name: "Alpha League",
        leagueCode: "GMF-101",
        members: [{ id: "member-1", role: "OWNER" }]
      }
    });
    mockTeamOwnershipService.getUserTeamsForSeason.mockResolvedValueOnce([
      {
        team: {
          id: "team-1",
          name: "Team One",
          abbreviation: "ONE",
          conference: "AFC",
          division: "East"
        }
      }
    ]);
    mockLedgerService.getLeagueMemberSeasonLedger.mockResolvedValueOnce({
      totals: {
        net: 18
      },
      entries: [
        {
          id: "ledger-1",
          category: "NFL_REGULAR_SEASON",
          amount: 18,
          description: "Owner One weekly payout",
          createdAt: "2026-01-10T00:00:00.000Z",
          updatedAt: "2026-01-10T00:00:00.000Z",
          metadata: null
        }
      ]
    });
    mockResultsService.getSeasonResults.mockResolvedValueOnce({
      seasonStandings: [
        { userId: "user-1", rank: 1, isChampion: true },
        { userId: "user-2", rank: 5, isChampion: false }
      ]
    });
    mockSeasonPhaseService.getSeasonPhaseContext.mockResolvedValueOnce({
      season: {
        leaguePhase: "DRAFT_PHASE"
      }
    });
    mockDraftService.getDraftStateByTargetSeason.mockResolvedValueOnce({
      draft: {
        status: "ACTIVE",
        picksCompleted: 3,
        totalPicks: 10
      },
      currentPick: {
        overallPickNumber: 4,
        selectingLeagueMemberId: "member-1"
      },
      picks: [{ selectingLeagueMemberId: "member-1", overallPickNumber: 7 }],
      members: [
        {
          userId: "user-1",
          leagueMemberId: "member-1",
          draftedTeam: {
            id: "team-9",
            name: "Team Nine",
            abbreviation: "NIN",
            conference: "NFC",
            division: "West"
          }
        },
        {
          userId: "user-2",
          leagueMemberId: "member-2",
          draftedTeam: null
        }
      ]
    });

    const season = await ownerService.getOwnerSeasonContext("user-1", "season-2026");

    expect(season.membership.leagueMemberId).toBe("member-1");
    expect(season.ledger.entries).toHaveLength(1);
    expect(season.ledger.entries[0].description).toBe("Owner One weekly payout");
    expect(season.standing).toEqual({
      rank: 1,
      isChampion: true
    });
    expect(season.draftPhase).toMatchObject({
      status: "ACTIVE",
      draftPosition: 7,
      currentPickNumber: 4,
      isOnClock: true
    });
  });

  it("rejects season access when the authenticated user is not a member of that league", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      displayName: "Owner One",
      email: "owner1@example.com"
    });
    mockPrisma.season.findUnique.mockResolvedValueOnce({
      id: "season-2026",
      leagueId: "league-1",
      year: 2026,
      name: null,
      status: "ACTIVE",
      league: {
        name: "Alpha League",
        leagueCode: "GMF-101",
        members: []
      }
    });

    await expect(ownerService.getOwnerSeasonContext("user-1", "season-2026")).rejects.toMatchObject({
      statusCode: 403,
      message: "You are not a member of this season's league."
    });
  });
});
