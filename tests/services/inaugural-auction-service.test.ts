import { beforeEach, describe, expect, it, vi } from "vitest";

type MockAuctionState = ReturnType<typeof createAuctionContext>;

const { mockPrisma, mockSeasonService, stateRef } = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    season: {
      findUnique: vi.fn()
    },
    inauguralAuction: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    },
    inauguralAuctionBid: {
      create: vi.fn()
    },
    inauguralAuctionAward: {
      create: vi.fn()
    },
    teamOwnership: {
      createMany: vi.fn()
    },
    nFLTeam: {
      findMany: vi.fn()
    },
    seasonNflTeamResult: {
      findMany: vi.fn()
    }
  },
  mockSeasonService: {
    assertCommissionerAccess: vi.fn()
  },
  stateRef: {
    current: null as MockAuctionState | null
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma
}));

vi.mock("@/server/services/season-service", () => ({
  seasonService: mockSeasonService
}));

import {
  inauguralAuctionService,
  InauguralAuctionServiceError
} from "@/server/services/inaugural-auction-service";

function createTeam(index: number) {
  const conference = index < 16 ? "AFC" : "NFC";
  const divisionPool = ["East", "North", "South", "West"];
  return {
    id: `team-${index + 1}`,
    name: `Team ${String(index + 1).padStart(2, "0")}`,
    abbreviation: `T${String(index + 1).padStart(2, "0")}`,
    conference: conference as "AFC" | "NFC",
    division: divisionPool[Math.floor((index % 16) / 4)]
  };
}

function createMember(index: number) {
  return {
    id: `member-${index + 1}`,
    userId: `user-${index + 1}`,
    role: index === 0 ? ("COMMISSIONER" as const) : ("OWNER" as const),
    joinedAt: new Date(`2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    user: {
      displayName: `Owner ${index + 1}`,
      email: `owner${index + 1}@example.com`,
      profileImageUrl: null
    }
  };
}

function createBid(id: string, member: ReturnType<typeof createMember>, amount: number, createdAt: Date) {
  return {
    id,
    amount,
    createdAt,
    leagueMemberId: member.id,
    leagueMember: {
      ...member
    }
  };
}

function createAuctionContext(options?: {
  clockExpiresAt?: Date | null;
  clockStartedAt?: Date | null;
  currentNominationIndex?: number;
  bidsByNominationIndex?: Record<number, Array<ReturnType<typeof createBid>>>;
  awardsByMemberIndex?: number[][];
  announcementEndsAt?: Date | null;
  status?: "PLANNING" | "ACTIVE" | "COMPLETED";
}) {
  const members = Array.from({ length: 10 }, (_, index) => createMember(index));
  const teams = Array.from({ length: 32 }, (_, index) => createTeam(index));
  const nominations = teams.map((team, index) => ({
    id: `nomination-${index + 1}`,
    nflTeamId: team.id,
    orderIndex: index,
    createdAt: new Date("2026-04-13T00:00:00.000Z"),
    updatedAt: new Date("2026-04-13T00:00:00.000Z"),
    nflTeam: team,
    bids: (options?.bidsByNominationIndex?.[index] ?? []).map((bid) => ({ ...bid })),
    award: null as null | {
      id: string;
      nominationId: string;
      leagueMemberId: string;
      amount: number;
      awardedAt: Date;
      createdAt: Date;
      updatedAt: Date;
      leagueMember: ReturnType<typeof createMember>;
    }
  }));
  const awards: Array<{
    id: string;
    auctionId: string;
    nominationId: string;
    leagueMemberId: string;
    amount: number;
    awardedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    nomination: { nflTeam: ReturnType<typeof createTeam>; nflTeamId: string };
    leagueMember: ReturnType<typeof createMember>;
  }> = [];

  for (const [memberIndex, nominationIndexes] of (options?.awardsByMemberIndex ?? []).entries()) {
    nominationIndexes.forEach((nominationIndex, awardOffset) => {
      const member = members[memberIndex];
      const nomination = nominations[nominationIndex];
      const award = {
        id: `award-${memberIndex + 1}-${awardOffset + 1}`,
        auctionId: "auction-1",
        nominationId: nomination.id,
        leagueMemberId: member.id,
        amount: awardOffset + 1,
        awardedAt: new Date(`2026-04-13T00:${String(memberIndex).padStart(2, "0")}:${String(awardOffset).padStart(2, "0")}Z`),
        createdAt: new Date(`2026-04-13T00:${String(memberIndex).padStart(2, "0")}:${String(awardOffset).padStart(2, "0")}Z`),
        updatedAt: new Date(`2026-04-13T00:${String(memberIndex).padStart(2, "0")}:${String(awardOffset).padStart(2, "0")}Z`),
        nomination: {
          nflTeam: nomination.nflTeam,
          nflTeamId: nomination.nflTeam.id
        },
        leagueMember: member
      };
      nomination.award = {
        id: award.id,
        nominationId: award.nominationId,
        leagueMemberId: award.leagueMemberId,
        amount: award.amount,
        awardedAt: award.awardedAt,
        createdAt: award.createdAt,
        updatedAt: award.updatedAt,
        leagueMember: member
      };
      awards.push(award);
    });
  }

  return {
    id: "auction-1",
    leagueId: "league-1",
    seasonId: "season-1",
    status: options?.status ?? "ACTIVE",
    orderMethod: "ALPHABETICAL" as const,
    currentNominationIndex: options?.currentNominationIndex ?? 0,
    clockStartedAt: options?.clockStartedAt ?? new Date("2026-04-13T00:00:00.000Z"),
    clockExpiresAt: options?.clockExpiresAt ?? new Date("2026-04-13T00:01:00.000Z"),
    announcementAwardId: null,
    announcementEndsAt: options?.announcementEndsAt ?? null,
    completedAt: null,
    createdAt: new Date("2026-04-13T00:00:00.000Z"),
    updatedAt: new Date("2026-04-13T00:00:00.000Z"),
    season: {
      id: "season-1",
      leagueId: "league-1",
      year: 2026,
      name: "2026 Season",
      status: "PLANNING" as const,
      leaguePhase: "DRAFT_PHASE" as const,
      draftMode: "INAUGURAL_AUCTION" as const,
      isLocked: false,
      teamOwnerships: [],
      league: {
        members
      }
    },
    nominationEntries: nominations,
    awards
  };
}

describe("inauguralAuctionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma));
    mockSeasonService.assertCommissionerAccess.mockResolvedValue(undefined);
    mockPrisma.season.findUnique.mockImplementation(async () => {
      const state = stateRef.current;

      if (!state) {
        return null;
      }

      return state.season;
    });
    mockPrisma.inauguralAuction.findUnique.mockImplementation(async () => stateRef.current);
    mockPrisma.inauguralAuction.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      if (!stateRef.current) {
        return null;
      }

      stateRef.current = {
        ...stateRef.current,
        ...data
      };

      return stateRef.current;
    });
    mockPrisma.inauguralAuctionBid.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const state = stateRef.current!;
      const nomination = state.nominationEntries.find((entry) => entry.id === data.nominationId)!;
      const member = state.season.league.members.find((entry) => entry.id === data.leagueMemberId)!;
      nomination.bids.push(
        createBid(
          `bid-${nomination.bids.length + 1}`,
          member,
          Number(data.amount),
          new Date("2026-04-13T00:00:55.000Z")
        )
      );

      return {};
    });
    mockPrisma.inauguralAuctionAward.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const state = stateRef.current!;
      const nomination = state.nominationEntries.find((entry) => entry.id === data.nominationId)!;
      const member = state.season.league.members.find((entry) => entry.id === data.leagueMemberId)!;
      const award = {
        id: `award-created-${state.awards.length + 1}`,
        auctionId: state.id,
        nominationId: nomination.id,
        leagueMemberId: member.id,
        amount: Number(data.amount),
        awardedAt: data.awardedAt as Date,
        createdAt: data.awardedAt as Date,
        updatedAt: data.awardedAt as Date,
        nomination: {
          nflTeam: nomination.nflTeam,
          nflTeamId: nomination.nflTeam.id
        },
        leagueMember: member
      };
      nomination.award = {
        id: award.id,
        nominationId: nomination.id,
        leagueMemberId: member.id,
        amount: award.amount,
        awardedAt: award.awardedAt,
        createdAt: award.createdAt,
        updatedAt: award.updatedAt,
        leagueMember: member
      };
      state.awards.push(award);
      stateRef.current = state;
      return { id: award.id };
    });
    mockPrisma.teamOwnership.createMany.mockResolvedValue({ count: 30 });
    mockPrisma.nFLTeam.findMany.mockImplementation(async ({ select }: { select?: { id?: boolean } }) => {
      const teams = stateRef.current?.nominationEntries.map((entry) => entry.nflTeam) ?? [];
      return select?.id ? teams.map((team) => ({ id: team.id })) : teams;
    });
    mockPrisma.seasonNflTeamResult.findMany.mockResolvedValue([]);
  });

  it("rejects bids that would leave too little budget to finish the required 3 teams", async () => {
    stateRef.current = createAuctionContext({
      currentNominationIndex: 2,
      awardsByMemberIndex: [[], [0, 1]]
    });

    await expect(
      inauguralAuctionService.submitBid({
        seasonId: "season-1",
        actingUserId: "user-2",
        amount: 99
      })
    ).rejects.toMatchObject<InauguralAuctionServiceError>({
      statusCode: 400,
      message: "A single inaugural auction bid cannot exceed $98."
    });
  });

  it("blocks owners from bidding after they already have 3 awarded teams", async () => {
    stateRef.current = createAuctionContext({
      currentNominationIndex: 3,
      awardsByMemberIndex: [[0, 1, 2]]
    });

    await expect(
      inauguralAuctionService.submitBid({
        seasonId: "season-1",
        actingUserId: "user-1",
        amount: 10
      })
    ).rejects.toMatchObject<InauguralAuctionServiceError>({
      statusCode: 409,
      message: "Owners with 3 awarded teams are done bidding for the inaugural auction."
    });
  });

  it("extends the clock by 10 seconds when a valid bid lands in the final 10 seconds", async () => {
    stateRef.current = createAuctionContext({
      clockStartedAt: new Date("2026-04-13T00:00:00.000Z"),
      clockExpiresAt: new Date(Date.now() + 9000)
    });

    await inauguralAuctionService.submitBid({
      seasonId: "season-1",
      actingUserId: "user-2",
      amount: 5
    });

    expect(mockPrisma.inauguralAuction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clockExpiresAt: expect.any(Date)
        })
      })
    );
  });

  it("awards immediately when an owner bids $98", async () => {
    stateRef.current = createAuctionContext();

    const state = await inauguralAuctionService.submitBid({
      seasonId: "season-1",
      actingUserId: "user-2",
      amount: 98
    });

    expect(mockPrisma.inauguralAuctionAward.create).toHaveBeenCalled();
    expect(state.activeAward?.leagueMemberId).toBe("member-2");
  });

  it("uses the latest highest bid to break ties when the timer expires", async () => {
    const ownerTwo = createMember(1);
    const ownerThree = createMember(2);
    stateRef.current = createAuctionContext({
      clockExpiresAt: new Date(Date.now() - 1000),
      bidsByNominationIndex: {
        0: [
          createBid("bid-1", ownerTwo, 25, new Date("2026-04-13T00:00:20.000Z")),
          createBid("bid-2", ownerThree, 25, new Date("2026-04-13T00:00:25.000Z"))
        ]
      }
    });

    const state = await inauguralAuctionService.getAuctionStateBySeason("season-1", "user-1");

    expect(mockPrisma.inauguralAuctionAward.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leagueMemberId: "member-3",
          amount: 25
        })
      })
    );
    expect(state?.activeAward?.leagueMemberId).toBe("member-3");
  });

  it("finalizes 30 awarded teams into TeamOwnership on the last award", async () => {
    stateRef.current = createAuctionContext({
      currentNominationIndex: 29,
      clockExpiresAt: new Date(Date.now() - 1000),
      awardsByMemberIndex: [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [9, 10, 11],
        [12, 13, 14],
        [15, 16, 17],
        [18, 19, 20],
        [21, 22, 23],
        [24, 25, 26],
        [27, 28]
      ],
      bidsByNominationIndex: {
        29: [createBid("bid-last", createMember(9), 12, new Date("2026-04-13T00:00:40.000Z"))]
      }
    });

    const state = await inauguralAuctionService.getAuctionStateBySeason("season-1", "user-1");

    expect(mockPrisma.teamOwnership.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            seasonId: "season-1",
            leagueMemberId: "member-10"
          })
        ])
      })
    );
    expect(state?.auction.status).toBe("COMPLETED");
    expect(state?.finalSummary).not.toBeNull();
  });
});
