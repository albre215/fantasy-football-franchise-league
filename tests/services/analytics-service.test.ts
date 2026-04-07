import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    league: {
      findUnique: vi.fn()
    },
    season: {
      findMany: vi.fn()
    },
    draft: {
      findMany: vi.fn()
    },
    nFLTeam: {
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

import { analyticsService } from "@/server/services/analytics-service";

function createLeague() {
  return {
    id: "league-1",
    name: "Alpha League",
    members: [
      {
        id: "member-a",
        userId: "user-a",
        role: "OWNER",
        user: {
          displayName: "Alpha",
          email: "alpha@example.com"
        }
      },
      {
        id: "member-b",
        userId: "user-b",
        role: "OWNER",
        user: {
          displayName: "Bravo",
          email: "bravo@example.com"
        }
      }
    ]
  };
}

function createTeams() {
  return [
    { id: "team-1", name: "Team One", abbreviation: "ONE", conference: "AFC", division: "East" },
    { id: "team-2", name: "Team Two", abbreviation: "TWO", conference: "AFC", division: "West" }
  ];
}

describe("analyticsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates owner earnings, finishes, and win rates without cross-owner leakage", async () => {
    mockPrisma.league.findUnique.mockResolvedValueOnce(createLeague());
    mockPrisma.season.findMany.mockResolvedValueOnce([
      {
        id: "season-2025",
        year: 2025,
        name: "2025 Season",
        teamOwnerships: [
          {
            nflTeamId: "team-1",
            nflTeam: createTeams()[0],
            leagueMember: {
              id: "member-a",
              userId: "user-a",
              user: { displayName: "Alpha", email: "alpha@example.com" }
            }
          }
        ],
        seasonStandings: [
          {
            leagueMemberId: "member-a",
            rank: 1,
            isChampion: true,
            wins: 10,
            losses: 4,
            ties: 0,
            leagueMember: {
              id: "member-a",
              userId: "user-a",
              user: { displayName: "Alpha", email: "alpha@example.com" }
            }
          },
          {
            leagueMemberId: "member-b",
            rank: 2,
            isChampion: false,
            wins: 8,
            losses: 6,
            ties: 0,
            leagueMember: {
              id: "member-b",
              userId: "user-b",
              user: { displayName: "Bravo", email: "bravo@example.com" }
            }
          }
        ],
        ledgerEntries: [
          { leagueMemberId: "member-a", category: "FANTASY_PAYOUT", amount: 100 },
          { leagueMemberId: "member-a", category: "NFL_REGULAR_SEASON", amount: 3 },
          { leagueMemberId: "member-b", category: "MANUAL_ADJUSTMENT", amount: -10 }
        ],
        nflTeamResults: [
          { nflTeamId: "team-1", leagueMemberId: "member-a", phase: "REGULAR_SEASON", result: "WIN" },
          { nflTeamId: "team-1", leagueMemberId: "member-a", phase: "REGULAR_SEASON", result: "LOSS" }
        ]
      }
    ]);
    mockPrisma.draft.findMany.mockResolvedValueOnce([]);
    mockPrisma.nFLTeam.findMany.mockResolvedValueOnce(createTeams());

    const analytics = await analyticsService.getOwnerAnalytics("league-1");

    expect(analytics.owners.find((owner) => owner.ownerUserId === "user-a")).toMatchObject({
      totalEarnings: 103,
      averageFinish: 1,
      fantasyWinRate: 0.714,
      nflWinRate: 0.5
    });
    expect(analytics.owners.find((owner) => owner.ownerUserId === "user-b")).toMatchObject({
      totalEarnings: -10,
      averageFinish: 2
    });
    expect(analytics.totalEarningsChart[0]?.label).toBe("Alpha");
  });

  it("computes team profitability and historical win totals from persisted NFL results", async () => {
    mockPrisma.league.findUnique.mockResolvedValueOnce(createLeague());
    mockPrisma.season.findMany.mockResolvedValueOnce([
      {
        id: "season-2025",
        year: 2025,
        name: "2025 Season",
        teamOwnerships: [
          {
            nflTeamId: "team-1",
            nflTeam: createTeams()[0],
            leagueMember: {
              id: "member-a",
              userId: "user-a",
              user: { displayName: "Alpha", email: "alpha@example.com" }
            }
          },
          {
            nflTeamId: "team-2",
            nflTeam: createTeams()[1],
            leagueMember: {
              id: "member-b",
              userId: "user-b",
              user: { displayName: "Bravo", email: "bravo@example.com" }
            }
          }
        ],
        seasonStandings: [],
        ledgerEntries: [],
        nflTeamResults: [
          { nflTeamId: "team-1", leagueMemberId: "member-a", phase: "REGULAR_SEASON", result: "WIN" },
          { nflTeamId: "team-1", leagueMemberId: "member-a", phase: "DIVISIONAL", result: "WIN" },
          { nflTeamId: "team-2", leagueMemberId: "member-b", phase: "REGULAR_SEASON", result: "LOSS" }
        ]
      }
    ]);
    mockPrisma.draft.findMany.mockResolvedValueOnce([]);
    mockPrisma.nFLTeam.findMany.mockResolvedValueOnce(createTeams());

    const analytics = await analyticsService.getFranchiseAnalytics("league-1");

    expect(analytics.mostProfitableTeams[0]).toMatchObject({
      team: { abbreviation: "ONE" },
      totalNflLedgerAmount: 2
    });
    expect(analytics.bestHistoricalTeams[0]).toMatchObject({
      team: { abbreviation: "ONE" },
      totalWins: 2
    });
  });

  it("returns deterministic replacement-draft outcome analytics by draft slot", async () => {
    mockPrisma.league.findUnique.mockResolvedValueOnce(createLeague());
    mockPrisma.season.findMany.mockResolvedValueOnce([
      {
        id: "season-2026",
        year: 2026,
        name: "2026 Season",
        teamOwnerships: [],
        seasonStandings: [
          {
            leagueMemberId: "member-a",
            rank: 2,
            isChampion: false,
            wins: 8,
            losses: 6,
            ties: 0,
            leagueMember: {
              id: "member-a",
              userId: "user-a",
              user: { displayName: "Alpha", email: "alpha@example.com" }
            }
          }
        ],
        ledgerEntries: [{ leagueMemberId: "member-a", category: "NFL_REGULAR_SEASON", amount: 5 }],
        nflTeamResults: [{ nflTeamId: "team-1", leagueMemberId: "member-a", phase: "REGULAR_SEASON", result: "WIN" }]
      }
    ]);
    mockPrisma.draft.findMany.mockResolvedValueOnce([
      {
        id: "draft-1",
        targetSeasonId: "season-2026",
        sourceSeasonId: "season-2025",
        status: "COMPLETED",
        targetSeason: { year: 2026, name: "2026 Season" },
        sourceSeason: { year: 2025, name: "2025 Season" },
        keeperSelections: [],
        picks: [
          {
            overallPickNumber: 1,
            selectingLeagueMemberId: "member-a",
            selectingLeagueMember: {
              userId: "user-a",
              user: { displayName: "Alpha", email: "alpha@example.com" }
            },
            selectedNflTeamId: "team-1",
            selectedNflTeam: createTeams()[0]
          }
        ]
      }
    ]);
    mockPrisma.nFLTeam.findMany.mockResolvedValueOnce(createTeams());

    const analytics = await analyticsService.getDraftAnalytics("league-1");

    expect(analytics.draftSlotOutcomes).toEqual([
      {
        draftSlot: 1,
        averageFinish: 2,
        averageLedgerTotal: 5,
        sampleSize: 1
      }
    ]);
    expect(analytics.replacementDraftEffectiveness[0].entries[0]).toMatchObject({
      draftSlot: 1,
      ownerDisplayName: "Alpha",
      selectedTeamRegularSeasonWins: 1,
      selectedTeamNflLedgerAmount: 1
    });
  });
});
