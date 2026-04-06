import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockSeasonPhaseService } = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    draft: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    draftPick: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    leagueMember: {
      findUnique: vi.fn()
    },
    season: {
      findUnique: vi.fn()
    },
    keeperSelection: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    teamOwnership: {
      createMany: vi.fn()
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

function createTeam(id: string, name: string) {
  return {
    id,
    name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    conference: "AFC" as const,
    division: "East"
  };
}

function createSourceOwnership(member: ReturnType<typeof createMember>, slot: number, teamId: string, teamName: string) {
  return {
    id: `ownership-${member.id}-${slot}`,
    nflTeamId: teamId,
    leagueMemberId: `source-${member.id}`,
    slot,
    nflTeam: createTeam(teamId, teamName),
    leagueMember: {
      id: `source-${member.id}`,
      userId: member.userId,
      user: member.user
    }
  };
}

function createKeeper(member: ReturnType<typeof createMember>, teamId: string, teamName: string) {
  return {
    id: `keeper-${member.id}-${teamId}`,
    leagueMemberId: member.id,
    nflTeamId: teamId,
    nflTeam: createTeam(teamId, teamName),
    leagueMember: {
      id: member.id,
      userId: member.userId,
      user: member.user
    }
  };
}

function createDraftPick(
  member: ReturnType<typeof createMember>,
  overallPickNumber: number,
  selectedTeam: ReturnType<typeof createTeam> | null = null
) {
  return {
    id: `pick-${overallPickNumber}`,
    overallPickNumber,
    roundNumber: 1,
    roundPickNumber: overallPickNumber,
    selectingLeagueMemberId: member.id,
    selectedNflTeamId: selectedTeam?.id ?? null,
    selectedNflTeam: selectedTeam,
    pickedAt: selectedTeam ? new Date("2026-02-01T00:00:00.000Z") : null,
    selectingLeagueMember: {
      id: member.id,
      userId: member.userId,
      user: member.user
    }
  };
}

function createDraftContext(options?: {
  status?: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED";
  currentPick?: number;
  keeperSelections?: ReturnType<typeof createKeeper>[];
  picks?: ReturnType<typeof createDraftPick>[];
}) {
  const alpha = createMember("member-alpha", "user-alpha", "Alpha");
  const bravo = createMember("member-bravo", "user-bravo", "Bravo");
  const members = [alpha, bravo];
  const keeperSelections =
    options?.keeperSelections ??
    [
      createKeeper(alpha, "team-a1", "Alpha One"),
      createKeeper(alpha, "team-a2", "Alpha Two"),
      createKeeper(bravo, "team-b1", "Bravo One"),
      createKeeper(bravo, "team-b2", "Bravo Two")
    ];
  const picks =
    options?.picks ??
    [
      createDraftPick(alpha, 1),
      createDraftPick(bravo, 2)
    ];

  return {
    id: "draft-1",
    leagueId: "league-1",
    targetSeasonId: "target-season",
    sourceSeasonId: "source-season",
    status: options?.status ?? "PLANNING",
    currentPick: options?.currentPick ?? 1,
    completedAt: null,
    targetSeason: {
      id: "target-season",
      leagueId: "league-1",
      year: 2026,
      name: "2026 Season",
      leaguePhase: "DRAFT_PHASE" as const,
      isLocked: false,
      league: {
        members
      },
      teamOwnerships: []
    },
    sourceSeason: {
      id: "source-season",
      leagueId: "league-1",
      year: 2025,
      name: "2025 Season",
      teamOwnerships: [
        createSourceOwnership(alpha, 1, "team-a1", "Alpha One"),
        createSourceOwnership(alpha, 2, "team-a2", "Alpha Two"),
        createSourceOwnership(alpha, 3, "team-a3", "Alpha Three"),
        createSourceOwnership(bravo, 1, "team-b1", "Bravo One"),
        createSourceOwnership(bravo, 2, "team-b2", "Bravo Two"),
        createSourceOwnership(bravo, 3, "team-b3", "Bravo Three")
      ]
    },
    keeperSelections,
    picks
  };
}

function mockDraftFindUnique(fullDraft: ReturnType<typeof createDraftContext>) {
  mockPrisma.draft.findUnique.mockImplementation(async (args: { where?: { id?: string; targetSeasonId?: string }; include?: unknown; select?: Record<string, unknown> }) => {
    if (args.where?.targetSeasonId) {
      return { id: fullDraft.id };
    }

    if (args.select && "targetSeasonId" in args.select) {
      return {
        id: fullDraft.id,
        leagueId: fullDraft.leagueId,
        targetSeasonId: fullDraft.targetSeasonId
      };
    }

    return fullDraft;
  });
}

describe("draftService replacement draft workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeasonPhaseService.assertPhaseAllowsDraftExecution.mockResolvedValue(undefined);
  });

  it("derives the replacement draft pool from released teams only", async () => {
    const fullDraft = createDraftContext();
    mockDraftFindUnique(fullDraft);

    const state = await draftService.getDraftStateByTargetSeason("target-season");

    expect(state).not.toBeNull();
    expect(state?.releasedTeamPool.map((team) => team.id)).toEqual(["team-a3", "team-b3"]);
    expect(state?.draftPool.map((team) => team.id)).toEqual(["team-a3", "team-b3"]);
    expect(state?.remainingTeams.map((team) => team.id)).toEqual(["team-a3", "team-b3"]);
    expect(state?.replacementDraftOrder.map((entry) => entry.leagueMemberId)).toEqual(["member-alpha", "member-bravo"]);
    expect(state?.currentDrafter?.leagueMemberId).toBe("member-alpha");
    expect(state?.draftPool.some((team) => team.id === "team-a1")).toBe(false);
    expect(state?.draftPool.some((team) => team.id === "team-b2")).toBe(false);
  });

  it("blocks replacement draft start until DROP_PHASE keeper and release work is complete", async () => {
    const fullDraft = createDraftContext({
      keeperSelections: [
        createKeeper(createMember("member-alpha", "user-alpha", "Alpha"), "team-a1", "Alpha One"),
        createKeeper(createMember("member-alpha", "user-alpha", "Alpha"), "team-a2", "Alpha Two"),
        createKeeper(createMember("member-bravo", "user-bravo", "Bravo"), "team-b1", "Bravo One")
      ]
    });

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma));
    mockDraftFindUnique(fullDraft);
    mockPrisma.leagueMember.findUnique.mockResolvedValue({ id: "commissioner-1", role: "COMMISSIONER" });

    await expect(
      draftService.startDraft({
        draftId: "draft-1",
        actingUserId: "commissioner-user"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Every owner must keep exactly 2 teams and release exactly 1 team before the replacement draft can run."
    });
  });

  it("rejects picks for teams outside the released-team pool", async () => {
    const fullDraft = createDraftContext({
      status: "ACTIVE",
      currentPick: 1
    });

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma));
    mockDraftFindUnique(fullDraft);
    mockPrisma.leagueMember.findUnique.mockResolvedValue({ id: "commissioner-1", role: "COMMISSIONER" });

    await expect(
      draftService.makeDraftPick({
        draftId: "draft-1",
        nflTeamId: "team-a1",
        actingUserId: "commissioner-user"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Selected team is not available in the draft pool."
    });

    expect(mockPrisma.draftPick.update).not.toHaveBeenCalled();
  });

  it("records exactly one replacement pick for the current drafter and advances the board", async () => {
    const fullDraft = createDraftContext({
      status: "ACTIVE",
      currentPick: 1
    });

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma));
    mockDraftFindUnique(fullDraft);
    mockPrisma.leagueMember.findUnique.mockResolvedValue({ id: "commissioner-1", role: "COMMISSIONER" });
    mockPrisma.draftPick.update.mockResolvedValue({});
    mockPrisma.draft.update.mockResolvedValue({});

    await draftService.makeDraftPick({
      draftId: "draft-1",
      nflTeamId: "team-a3",
      actingUserId: "commissioner-user"
    });

    expect(mockPrisma.draftPick.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pick-1" },
        data: expect.objectContaining({
          selectedNflTeamId: "team-a3"
        })
      })
    );
    expect(mockPrisma.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "draft-1" },
        data: { currentPick: 2 }
      })
    );
  });

  it("finalizes the replacement draft into exactly three target-season ownership rows per owner", async () => {
    const fullDraft = createDraftContext({
      status: "ACTIVE",
      currentPick: 3,
      picks: [
        createDraftPick(createMember("member-alpha", "user-alpha", "Alpha"), 1, createTeam("team-a3", "Alpha Three")),
        createDraftPick(createMember("member-bravo", "user-bravo", "Bravo"), 2, createTeam("team-b3", "Bravo Three"))
      ]
    });

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma));
    mockDraftFindUnique(fullDraft);
    mockPrisma.leagueMember.findUnique.mockResolvedValue({ id: "commissioner-1", role: "COMMISSIONER" });
    mockPrisma.teamOwnership.createMany.mockResolvedValue({ count: 6 });
    mockPrisma.draft.update.mockResolvedValue({});

    await draftService.finalizeDraft({
      draftId: "draft-1",
      actingUserId: "commissioner-user"
    });

    expect(mockPrisma.teamOwnership.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { seasonId: "target-season", leagueMemberId: "member-alpha", nflTeamId: "team-a1", slot: 1 },
          { seasonId: "target-season", leagueMemberId: "member-alpha", nflTeamId: "team-a2", slot: 2 },
          { seasonId: "target-season", leagueMemberId: "member-alpha", nflTeamId: "team-a3", slot: 3 },
          { seasonId: "target-season", leagueMemberId: "member-bravo", nflTeamId: "team-b1", slot: 1 },
          { seasonId: "target-season", leagueMemberId: "member-bravo", nflTeamId: "team-b2", slot: 2 },
          { seasonId: "target-season", leagueMemberId: "member-bravo", nflTeamId: "team-b3", slot: 3 }
        ]
      })
    );
    expect(mockPrisma.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "draft-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          currentPick: 3
        })
      })
    );
  });
});
