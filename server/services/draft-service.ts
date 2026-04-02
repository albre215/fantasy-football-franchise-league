import { DraftStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resultsService } from "@/server/services/results-service";
import { seasonPhaseService, SeasonPhaseServiceError } from "@/server/services/season-phase-service";
import { seasonService } from "@/server/services/season-service";
import type {
  DraftKeeperSelection,
  DraftMemberSummary,
  DraftPickSummary,
  DraftState,
  DraftSummary,
  DraftTeamSummary,
  FinalizeDraftInput,
  InitializeDraftInput,
  MakeDraftPickInput,
  OverrideDraftOrderInput,
  ResetDraftInput,
  ResetDraftResponse,
  SaveKeepersInput,
  StartDraftInput
} from "@/types/draft";

const DRAFT_OWNER_COUNT = 10;
const KEEPERS_PER_OWNER = 2;
const OFFSEASON_DRAFT_PICK_COUNT = 10;
const TOTAL_NFL_TEAMS = 32;

class DraftServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "DraftServiceError";
  }
}

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

type DraftWithContext = Awaited<ReturnType<typeof getDraftWithContextOrThrow>>;

function mapDraftTeam(team: {
  id: string;
  name: string;
  abbreviation: string;
  conference: "AFC" | "NFC";
  division: string;
}): DraftTeamSummary {
  return {
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    conference: team.conference,
    division: team.division
  };
}

function mapDraftSummary(draft: DraftWithContext): DraftSummary {
  return {
    id: draft.id,
    leagueId: draft.leagueId,
    targetSeasonId: draft.targetSeasonId,
    sourceSeasonId: draft.sourceSeasonId,
    targetSeasonName: draft.targetSeason.name,
    targetSeasonYear: draft.targetSeason.year,
    sourceSeasonName: draft.sourceSeason.name,
    sourceSeasonYear: draft.sourceSeason.year,
    status: draft.status,
    currentPick: draft.currentPick,
    completedAt: draft.completedAt?.toISOString() ?? null,
    keeperCount: draft.keeperSelections.length,
    picksCompleted: draft.picks.filter((pick) => Boolean(pick.selectedNflTeamId)).length,
    totalPicks: draft.picks.length,
    isTargetSeasonLocked: draft.targetSeason.isLocked
  };
}

function mapDraftPick(pick: DraftWithContext["picks"][number]): DraftPickSummary {
  return {
    id: pick.id,
    overallPickNumber: pick.overallPickNumber,
    roundNumber: pick.roundNumber,
    roundPickNumber: pick.roundPickNumber,
    selectingLeagueMemberId: pick.selectingLeagueMemberId,
    selectingDisplayName: pick.selectingLeagueMember.user.displayName,
    selectedNflTeam: pick.selectedNflTeam ? mapDraftTeam(pick.selectedNflTeam) : null,
    pickedAt: pick.pickedAt?.toISOString() ?? null
  };
}

function buildDraftOrderEntries(orderLeagueMemberIds: string[]) {
  return orderLeagueMemberIds.map((leagueMemberId, index) => ({
    overallPickNumber: index + 1,
    roundNumber: 1,
    roundPickNumber: index + 1,
    selectingLeagueMemberId: leagueMemberId
  }));
}

async function getActiveTeams(tx: PrismaClientLike) {
  return tx.nFLTeam.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ conference: "asc" }, { division: "asc" }, { name: "asc" }]
  });
}

async function getDraftWithContextOrThrow(tx: PrismaClientLike, draftId: string) {
  const draft = await tx.draft.findUnique({
    where: {
      id: draftId
    },
    include: {
      targetSeason: {
        select: {
          id: true,
          leagueId: true,
          year: true,
          name: true,
          isLocked: true,
          league: {
            select: {
              members: {
                select: {
                  id: true,
                  userId: true,
                  role: true,
                  user: true
                },
                orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
              }
            }
          },
          teamOwnerships: {
            select: {
              id: true,
              nflTeamId: true,
              leagueMemberId: true,
              nflTeam: true,
              leagueMember: {
                select: {
                  id: true,
                  userId: true,
                  user: true
                }
              }
            }
          }
        }
      },
      sourceSeason: {
        select: {
          id: true,
          leagueId: true,
          year: true,
          name: true,
          teamOwnerships: {
            select: {
              id: true,
              nflTeamId: true,
              leagueMemberId: true,
              slot: true,
              nflTeam: true,
              leagueMember: {
                select: {
                  id: true,
                  userId: true,
                  user: true
                }
              }
            }
          }
        }
      },
      keeperSelections: {
        include: {
          nflTeam: true,
          leagueMember: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ leagueMemberId: "asc" }, { createdAt: "asc" }]
      },
      picks: {
        include: {
          selectedNflTeam: true,
          selectingLeagueMember: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          overallPickNumber: "asc"
        }
      }
    }
  });

  if (!draft) {
    throw new DraftServiceError("Draft not found.", 404);
  }

  return draft;
}

async function assertCommissionerAccessForDraft(tx: PrismaClientLike, draftId: string, actingUserId: string) {
  const normalizedActingUserId = actingUserId.trim();

  if (!normalizedActingUserId) {
    throw new DraftServiceError("actingUserId is required.", 400);
  }

  const draft = await tx.draft.findUnique({
    where: {
      id: draftId
    },
    select: {
      id: true,
      leagueId: true,
      targetSeasonId: true
    }
  });

  if (!draft) {
    throw new DraftServiceError("Draft not found.", 404);
  }

  const commissioner = await tx.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId: draft.leagueId,
        userId: normalizedActingUserId
      }
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!commissioner || commissioner.role !== "COMMISSIONER") {
    throw new DraftServiceError("Only the commissioner can perform this draft action.", 403);
  }

  return draft;
}

async function getDraftByTargetSeasonOrThrow(tx: PrismaClientLike, targetSeasonId: string) {
  const draft = await tx.draft.findUnique({
    where: {
      targetSeasonId
    },
    select: {
      id: true,
      leagueId: true,
      targetSeasonId: true,
      sourceSeasonId: true,
      status: true,
      targetSeason: {
        select: {
          id: true,
          isLocked: true,
          teamOwnerships: {
            select: {
              id: true
            }
          },
          league: {
            select: {
              members: {
                select: {
                  id: true,
                  userId: true,
                  role: true,
                  user: true
                },
                orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
              }
            }
          }
        }
      }
    }
  });

  if (!draft) {
    throw new DraftServiceError("Draft not found for this target season.", 404);
  }

  return draft;
}

function assertSeasonIsEditable(isLocked: boolean) {
  if (isLocked) {
    throw new DraftServiceError("Target season is locked. Unlock it before changing the offseason draft.", 409);
  }
}

async function assertDraftPreparationPhase(seasonId: string) {
  try {
    await seasonPhaseService.assertPhaseAllowsDraftPreparation(seasonId);
  } catch (error) {
    if (error instanceof SeasonPhaseServiceError) {
      throw new DraftServiceError(error.message, error.statusCode);
    }

    throw error;
  }
}

async function assertDraftExecutionPhase(seasonId: string) {
  try {
    await seasonPhaseService.assertPhaseAllowsDraftExecution(seasonId);
  } catch (error) {
    if (error instanceof SeasonPhaseServiceError) {
      throw new DraftServiceError(error.message, error.statusCode);
    }

    throw error;
  }
}

function getKeeperLockReason(status: DraftStatus, isTargetSeasonLocked: boolean) {
  if (isTargetSeasonLocked) {
    return "Keeper selections can only be changed while the target season is unlocked.";
  }

  if (status === "PLANNING") {
    return null;
  }

  if (status === "COMPLETED") {
    return "Keepers are locked because the draft has already been completed.";
  }

  if (status === "CANCELLED") {
    return "Keepers are locked because this draft is no longer active.";
  }

  return "Keeper selections can only be changed before the draft begins.";
}

async function buildDraftState(tx: PrismaClientLike, draftId: string): Promise<DraftState> {
  const [draft, activeTeams] = await Promise.all([getDraftWithContextOrThrow(tx, draftId), getActiveTeams(tx)]);

  const keepersByMemberId = new Map<string, DraftKeeperSelection[]>();

  for (const keeper of draft.keeperSelections) {
    const entry: DraftKeeperSelection = {
      id: keeper.id,
      leagueMemberId: keeper.leagueMemberId,
      userId: keeper.leagueMember.userId,
      displayName: keeper.leagueMember.user.displayName,
      nflTeam: mapDraftTeam(keeper.nflTeam)
    };

    const bucket = keepersByMemberId.get(keeper.leagueMemberId) ?? [];
    bucket.push(entry);
    keepersByMemberId.set(keeper.leagueMemberId, bucket);
  }

  const draftedTeamsByMemberId = new Map<string, DraftTeamSummary>();

  for (const pick of draft.picks) {
    if (pick.selectedNflTeam) {
      draftedTeamsByMemberId.set(pick.selectingLeagueMemberId, mapDraftTeam(pick.selectedNflTeam));
    }
  }

  const previousSeasonTeamsByUserId = new Map<string, DraftTeamSummary[]>();

  for (const ownership of draft.sourceSeason.teamOwnerships) {
    const bucket = previousSeasonTeamsByUserId.get(ownership.leagueMember.userId) ?? [];
    bucket.push(mapDraftTeam(ownership.nflTeam));
    previousSeasonTeamsByUserId.set(ownership.leagueMember.userId, bucket);
  }

  const members: DraftMemberSummary[] = draft.targetSeason.league.members.map((member) => {
    const keepers = keepersByMemberId.get(member.id) ?? [];

    return {
      leagueMemberId: member.id,
      userId: member.userId,
      displayName: member.user.displayName,
      email: member.user.email,
      role: member.role,
      previousSeasonTeams: previousSeasonTeamsByUserId.get(member.userId) ?? [],
      keepers,
      draftedTeam: draftedTeamsByMemberId.get(member.id) ?? null,
      keeperCount: keepers.length,
      isKeeperComplete: keepers.length === KEEPERS_PER_OWNER
    };
  });

  const reservedTeamIds = new Set<string>();
  for (const keeper of draft.keeperSelections) {
    reservedTeamIds.add(keeper.nflTeamId);
  }
  for (const pick of draft.picks) {
    if (pick.selectedNflTeamId) {
      reservedTeamIds.add(pick.selectedNflTeamId);
    }
  }

  const picks = draft.picks.map(mapDraftPick);
  const picksCompleted = picks.filter((pick) => pick.selectedNflTeam !== null).length;
  const completeOwners = members.filter((member) => member.keeperCount === KEEPERS_PER_OWNER).length;
  const keeperLockReason = getKeeperLockReason(draft.status, draft.targetSeason.isLocked);
  const keeperProgress = {
    completeOwners,
    totalOwners: members.length,
    isComplete: completeOwners === DRAFT_OWNER_COUNT
  };
  const currentPick = picks.find((pick) => pick.overallPickNumber === draft.currentPick) ?? null;
  const canStart =
    draft.status === "PLANNING" &&
    !draft.targetSeason.isLocked &&
    keeperProgress.isComplete &&
    activeTeams.length - draft.keeperSelections.length === 12 &&
    draft.picks.length === OFFSEASON_DRAFT_PICK_COUNT;
  const canFinalize =
    (draft.status === "ACTIVE" || draft.status === "PAUSED") &&
    !draft.targetSeason.isLocked &&
    keeperProgress.isComplete &&
    picksCompleted === OFFSEASON_DRAFT_PICK_COUNT &&
    draft.targetSeason.teamOwnerships.length === 0;

  return {
    draft: mapDraftSummary(draft),
    members,
    draftPool: activeTeams.filter((team) => !reservedTeamIds.has(team.id)).map(mapDraftTeam),
    picks,
    currentPick,
    canFinalize,
    canStart,
    keeperEditing: {
      canEdit: keeperLockReason === null,
      isLocked: keeperLockReason !== null,
      lockReason: keeperLockReason
    },
    keeperProgress
  };
}

async function validateDraftInitialization(
  tx: PrismaClientLike,
  input: InitializeDraftInput
) {
  const targetSeasonId = input.targetSeasonId.trim();
  const sourceSeasonId = input.sourceSeasonId.trim();
  const normalizedOrderLeagueMemberIds = input.orderLeagueMemberIds.map((id) => id.trim()).filter(Boolean);

  if (!targetSeasonId || !sourceSeasonId) {
    throw new DraftServiceError("targetSeasonId and sourceSeasonId are required.", 400);
  }

  if (targetSeasonId === sourceSeasonId) {
    throw new DraftServiceError("Target season and source season must be different.", 400);
  }

  const [targetSeason, sourceSeason, existingDraft] = await Promise.all([
    tx.season.findUnique({
      where: {
        id: targetSeasonId
      },
      select: {
        id: true,
        leagueId: true,
        year: true,
        isLocked: true,
        league: {
          select: {
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
                user: true
              },
              orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
            }
          }
        },
        teamOwnerships: true
      }
    }),
    tx.season.findUnique({
      where: {
        id: sourceSeasonId
      },
      select: {
        id: true,
        leagueId: true,
        year: true,
        teamOwnerships: {
          select: {
            nflTeamId: true,
            nflTeam: true,
            leagueMember: {
              select: {
                id: true,
                userId: true,
                user: true
              }
            }
          }
        }
      }
    }),
    tx.draft.findUnique({
      where: {
        targetSeasonId
      },
      select: {
        id: true
      }
    })
  ]);

  if (!targetSeason || !sourceSeason) {
    throw new DraftServiceError("Source and target seasons must both exist.", 404);
  }

  if (targetSeason.leagueId !== sourceSeason.leagueId) {
    throw new DraftServiceError("Source and target seasons must belong to the same league.", 400);
  }

  if (sourceSeason.year !== targetSeason.year - 1) {
    throw new DraftServiceError(
      "The offseason draft must use the immediately previous season as its source season.",
      400
    );
  }

  if (targetSeason.league.members.length !== DRAFT_OWNER_COUNT) {
    throw new DraftServiceError("The offseason draft requires exactly 10 league members.", 409);
  }

  if (existingDraft) {
    throw new DraftServiceError("An offseason draft already exists for the target season.", 409);
  }

  assertSeasonIsEditable(targetSeason.isLocked);

  if (targetSeason.teamOwnerships.length > 0) {
    throw new DraftServiceError("Target season already has team ownership records. Use a fresh season for the draft.", 409);
  }

  const validLeagueMemberIds = new Set(targetSeason.league.members.map((member) => member.id));

  if (normalizedOrderLeagueMemberIds.length !== DRAFT_OWNER_COUNT) {
    throw new DraftServiceError("Draft order must include all 10 league members exactly once.", 400);
  }

  if (new Set(normalizedOrderLeagueMemberIds).size !== DRAFT_OWNER_COUNT) {
    throw new DraftServiceError("Draft order contains duplicate league members.", 400);
  }

  if (normalizedOrderLeagueMemberIds.some((leagueMemberId) => !validLeagueMemberIds.has(leagueMemberId))) {
    throw new DraftServiceError("Draft order contains a member who does not belong to this league.", 400);
  }

  const sourceOwnershipCounts = new Map<string, number>();
  for (const ownership of sourceSeason.teamOwnerships) {
    sourceOwnershipCounts.set(
      ownership.leagueMember.userId,
      (sourceOwnershipCounts.get(ownership.leagueMember.userId) ?? 0) + 1
    );
  }

  if (targetSeason.league.members.some((member) => (sourceOwnershipCounts.get(member.userId) ?? 0) !== 3)) {
    throw new DraftServiceError(
      "Each current league member must have exactly 3 teams in the source season before starting the offseason draft.",
      409
    );
  }

  const recommendedOrder = await resultsService.getRecommendedOffseasonDraftOrder(sourceSeasonId, targetSeasonId);
  const recommendedLeagueMemberIds = recommendedOrder.entries
    .map((entry) => entry.targetLeagueMemberId)
    .filter((leagueMemberId): leagueMemberId is string => Boolean(leagueMemberId));

  if (!recommendedOrder.readiness.isReady) {
    throw new DraftServiceError(
      recommendedOrder.warnings[0] ??
        "Source-season ledger totals are not ready to generate the offseason draft order yet.",
      409
    );
  }

  if (recommendedLeagueMemberIds.length !== DRAFT_OWNER_COUNT) {
    throw new DraftServiceError(
      "Ledger-based draft order must map all 10 owners into the target season before initializing the offseason draft.",
      409
    );
  }

  return {
    targetSeason,
    sourceSeason,
    orderLeagueMemberIds: normalizedOrderLeagueMemberIds,
    recommendedOrderLeagueMemberIds: recommendedLeagueMemberIds
  };
}

async function validateKeeperSave(
  tx: PrismaClientLike,
  input: SaveKeepersInput
) {
  const draftId = input.draftId.trim();
  const leagueMemberId = input.leagueMemberId.trim();
  const nflTeamIds = input.nflTeamIds.map((id) => id.trim()).filter(Boolean);

  if (!draftId || !leagueMemberId) {
    throw new DraftServiceError("draftId and leagueMemberId are required.", 400);
  }

  if (nflTeamIds.length !== KEEPERS_PER_OWNER) {
    throw new DraftServiceError("Each owner must keep exactly 2 teams.", 400);
  }

  if (new Set(nflTeamIds).size !== KEEPERS_PER_OWNER) {
    throw new DraftServiceError("Keeper teams must be unique.", 400);
  }

  const draft = await getDraftWithContextOrThrow(tx, draftId);

  if (draft.status !== "PLANNING") {
    throw new DraftServiceError("Keeper selections cannot be changed after the draft has started.", 409);
  }

  assertSeasonIsEditable(draft.targetSeason.isLocked);

  const member = draft.targetSeason.league.members.find((leagueMember) => leagueMember.id === leagueMemberId);

  if (!member) {
    throw new DraftServiceError("League member not found for this draft.", 404);
  }

  const sourceTeams = draft.sourceSeason.teamOwnerships.filter((ownership) => ownership.leagueMemberId === leagueMemberId);
  const memberSourceTeams = draft.sourceSeason.teamOwnerships.filter(
    (ownership) => ownership.leagueMember.userId === member.userId
  );

  if (memberSourceTeams.length !== 3) {
    throw new DraftServiceError("That owner does not have exactly 3 teams in the source season.", 409);
  }

  const validSourceTeamIds = new Set(memberSourceTeams.map((ownership) => ownership.nflTeamId));

  if (nflTeamIds.some((nflTeamId) => !validSourceTeamIds.has(nflTeamId))) {
    throw new DraftServiceError("Keepers must come from that owner's previous-season teams.", 400);
  }

  const otherKeepers = draft.keeperSelections.filter((keeper) => keeper.leagueMemberId !== leagueMemberId);
  const takenTeamIds = new Set(otherKeepers.map((keeper) => keeper.nflTeamId));

  if (nflTeamIds.some((nflTeamId) => takenTeamIds.has(nflTeamId))) {
    throw new DraftServiceError("A keeper team has already been assigned to another owner.", 409);
  }

  return {
    draft,
    leagueMemberId,
    nflTeamIds
  };
}

async function validateDraftStart(tx: PrismaClientLike, draftId: string) {
  const draftState = await buildDraftState(tx, draftId);

  if (draftState.draft.status !== "PLANNING") {
    throw new DraftServiceError("Only a planning draft can be started.", 409);
  }

  if (draftState.draft.isTargetSeasonLocked) {
    throw new DraftServiceError("Target season is locked. Unlock it before starting the draft.", 409);
  }

  if (!draftState.canStart) {
    throw new DraftServiceError("Complete all keeper selections before starting the draft.", 409);
  }

  if (draftState.draftPool.length !== TOTAL_NFL_TEAMS - DRAFT_OWNER_COUNT * KEEPERS_PER_OWNER) {
    throw new DraftServiceError("The draft pool must contain exactly 12 teams before the draft can start.", 409);
  }
}

async function validateDraftPick(tx: PrismaClientLike, input: MakeDraftPickInput) {
  const draftId = input.draftId.trim();
  const nflTeamId = input.nflTeamId.trim();

  if (!draftId || !nflTeamId) {
    throw new DraftServiceError("draftId and nflTeamId are required.", 400);
  }

  const draft = await getDraftWithContextOrThrow(tx, draftId);

  if (draft.status !== "ACTIVE") {
    throw new DraftServiceError("Draft picks can only be made while the draft is active.", 409);
  }

  assertSeasonIsEditable(draft.targetSeason.isLocked);

  const currentPick = draft.picks.find((pick) => pick.overallPickNumber === draft.currentPick);

  if (!currentPick) {
    throw new DraftServiceError("Current pick not found.", 409);
  }

  if (currentPick.selectedNflTeamId) {
    throw new DraftServiceError("Current pick has already been made.", 409);
  }

  const state = await buildDraftState(tx, draftId);

  if (state.draftPool.every((team) => team.id !== nflTeamId)) {
    throw new DraftServiceError("Selected team is not available in the draft pool.", 409);
  }

  return {
    draft,
    currentPick
  };
}

async function validateDraftFinalization(tx: PrismaClientLike, draftId: string) {
  const draft = await getDraftWithContextOrThrow(tx, draftId);
  const state = await buildDraftState(tx, draftId);

  if (draft.status !== "ACTIVE" && draft.status !== "PAUSED") {
    throw new DraftServiceError("Only an active or paused draft can be finalized.", 409);
  }

  assertSeasonIsEditable(draft.targetSeason.isLocked);

  if (!state.canFinalize) {
    throw new DraftServiceError("Draft is not ready to finalize yet.", 409);
  }

  return {
    draft,
    state
  };
}

export const draftService = {
  async getDraftStateByTargetSeason(targetSeasonId: string) {
    const normalizedTargetSeasonId = targetSeasonId.trim();

    if (!normalizedTargetSeasonId) {
      throw new DraftServiceError("targetSeasonId is required.", 400);
    }

    const draft = await prisma.draft.findUnique({
      where: {
        targetSeasonId: normalizedTargetSeasonId
      },
      select: {
        id: true
      }
    });

    return draft ? buildDraftState(prisma, draft.id) : null;
  },

  async initializeDraft(input: InitializeDraftInput) {
    const targetSeasonId = input.targetSeasonId.trim();

    await assertDraftPreparationPhase(targetSeasonId);

    return prisma.$transaction(async (tx) => {
      const { targetSeason, sourceSeason, orderLeagueMemberIds } = await validateDraftInitialization(tx, input);
      const commissioner = await tx.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId: targetSeason.leagueId,
            userId: input.actingUserId.trim()
          }
        },
        select: {
          role: true
        }
      });

      if (!commissioner || commissioner.role !== "COMMISSIONER") {
        throw new DraftServiceError("Only the commissioner can initialize the offseason draft.", 403);
      }

      const draft = await tx.draft.create({
        data: {
          leagueId: targetSeason.leagueId,
          targetSeasonId,
          sourceSeasonId: sourceSeason.id,
          status: "PLANNING",
          currentPick: 1,
          picks: {
            create: buildDraftOrderEntries(orderLeagueMemberIds)
          }
        },
        select: {
          id: true
        }
      });

      return buildDraftState(tx, draft.id);
    });
  },

  async overrideDraftOrder(input: OverrideDraftOrderInput): Promise<DraftState> {
    const targetSeasonId = input.targetSeasonId.trim();
    const normalizedOrderLeagueMemberIds = input.orderLeagueMemberIds.map((id) => id.trim()).filter(Boolean);

    if (!targetSeasonId) {
      throw new DraftServiceError("targetSeasonId is required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      await seasonService.assertCommissionerAccess(targetSeasonId, input.actingUserId);
      await assertDraftPreparationPhase(targetSeasonId);
      const draft = await getDraftByTargetSeasonOrThrow(tx, targetSeasonId);

      if (draft.status !== "PLANNING") {
        throw new DraftServiceError("Draft order can only be overridden while the draft is still planning.", 409);
      }

      assertSeasonIsEditable(draft.targetSeason.isLocked);

      const validLeagueMemberIds = new Set(draft.targetSeason.league.members.map((member) => member.id));

      if (normalizedOrderLeagueMemberIds.length !== DRAFT_OWNER_COUNT) {
        throw new DraftServiceError("Draft order must include all 10 league members exactly once.", 400);
      }

      if (new Set(normalizedOrderLeagueMemberIds).size !== DRAFT_OWNER_COUNT) {
        throw new DraftServiceError("Draft order contains duplicate league members.", 400);
      }

      if (normalizedOrderLeagueMemberIds.some((leagueMemberId) => !validLeagueMemberIds.has(leagueMemberId))) {
        throw new DraftServiceError("Draft order contains a member who does not belong to this league.", 400);
      }

      const picks = await tx.draftPick.findMany({
        where: {
          draftId: draft.id
        },
        orderBy: {
          overallPickNumber: "asc"
        },
        select: {
          id: true,
          selectedNflTeamId: true
        }
      });

      if (picks.length !== OFFSEASON_DRAFT_PICK_COUNT) {
        throw new DraftServiceError("Draft order override requires all 10 draft picks to exist.", 409);
      }

      if (picks.some((pick) => pick.selectedNflTeamId)) {
        throw new DraftServiceError("Draft order cannot be overridden after picks have been recorded.", 409);
      }

      await Promise.all(
        picks.map((pick, index) =>
          tx.draftPick.update({
            where: {
              id: pick.id
            },
            data: {
              selectingLeagueMemberId: normalizedOrderLeagueMemberIds[index]
            }
          })
        )
      );

      await tx.draft.update({
        where: {
          id: draft.id
        },
        data: {
          currentPick: 1
        }
      });

      return buildDraftState(tx, draft.id);
    });
  },

  async resetDraft(input: ResetDraftInput): Promise<ResetDraftResponse> {
    const targetSeasonId = input.targetSeasonId.trim();

    if (!targetSeasonId) {
      throw new DraftServiceError("targetSeasonId is required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      await seasonService.assertCommissionerAccess(targetSeasonId, input.actingUserId);
      await assertDraftPreparationPhase(targetSeasonId);
      const draft = await getDraftByTargetSeasonOrThrow(tx, targetSeasonId);

      const targetSeasonOwnershipCount = draft.targetSeason.teamOwnerships.length;
      const requiresForce = draft.status === "COMPLETED" || targetSeasonOwnershipCount > 0;

      if (requiresForce && !input.force) {
        throw new DraftServiceError(
          "This draft has already been finalized into target-season ownership. Force reset confirmation is required.",
          409
        );
      }

      if (!requiresForce) {
        assertSeasonIsEditable(draft.targetSeason.isLocked);
      }

      if (input.force && targetSeasonOwnershipCount > 0) {
        await tx.teamOwnership.deleteMany({
          where: {
            seasonId: targetSeasonId
          }
        });
      }

      await tx.draft.delete({
        where: {
          id: draft.id
        }
      });

      return {
        removedDraftId: draft.id,
        removedTargetSeasonOwnershipCount: input.force ? targetSeasonOwnershipCount : 0
      };
    });
  },

  async saveKeepers(input: SaveKeepersInput) {
    return prisma.$transaction(async (tx) => {
      const draftRecord = await assertCommissionerAccessForDraft(tx, input.draftId, input.actingUserId);
      await assertDraftPreparationPhase(draftRecord.targetSeasonId);
      const { draft, leagueMemberId, nflTeamIds } = await validateKeeperSave(tx, input);

      if (draftRecord.id !== draft.id) {
        throw new DraftServiceError("Draft context mismatch.", 409);
      }

      await tx.keeperSelection.deleteMany({
        where: {
          draftId: draft.id,
          leagueMemberId
        }
      });

      await tx.keeperSelection.createMany({
        data: nflTeamIds.map((nflTeamId) => ({
          draftId: draft.id,
          leagueMemberId,
          nflTeamId,
          sourceSeasonId: draft.sourceSeasonId,
          actingUserId: input.actingUserId.trim()
        }))
      });

      return buildDraftState(tx, draft.id);
    });
  },

  async startDraft(input: StartDraftInput) {
    const draftId = input.draftId.trim();

    if (!draftId) {
      throw new DraftServiceError("draftId is required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const draftContext = await assertCommissionerAccessForDraft(tx, draftId, input.actingUserId);
      await assertDraftExecutionPhase(draftContext.targetSeasonId);
      await validateDraftStart(tx, draftId);

      await tx.draft.update({
        where: {
          id: draftId
        },
        data: {
          status: "ACTIVE",
          currentPick: 1
        }
      });

      return buildDraftState(tx, draftId);
    });
  },

  async pauseDraft(input: StartDraftInput) {
    const draftId = input.draftId.trim();

    if (!draftId) {
      throw new DraftServiceError("draftId is required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const draft = await assertCommissionerAccessForDraft(tx, draftId, input.actingUserId);
      await assertDraftExecutionPhase(draft.targetSeasonId);
      const current = await tx.draft.findUniqueOrThrow({
        where: {
          id: draft.id
        },
        select: {
          status: true
        }
      });

      if (current.status !== "ACTIVE") {
        throw new DraftServiceError("Only an active draft can be paused.", 409);
      }

      await tx.draft.update({
        where: {
          id: draft.id
        },
        data: {
          status: "PAUSED"
        }
      });

      return buildDraftState(tx, draft.id);
    });
  },

  async resumeDraft(input: StartDraftInput) {
    const draftId = input.draftId.trim();

    if (!draftId) {
      throw new DraftServiceError("draftId is required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const draft = await assertCommissionerAccessForDraft(tx, draftId, input.actingUserId);
      await assertDraftExecutionPhase(draft.targetSeasonId);
      const current = await tx.draft.findUniqueOrThrow({
        where: {
          id: draft.id
        },
        select: {
          status: true
        }
      });

      if (current.status !== "PAUSED") {
        throw new DraftServiceError("Only a paused draft can be resumed.", 409);
      }

      await tx.draft.update({
        where: {
          id: draft.id
        },
        data: {
          status: "ACTIVE"
        }
      });

      return buildDraftState(tx, draft.id);
    });
  },

  async makeDraftPick(input: MakeDraftPickInput) {
    return prisma.$transaction(async (tx) => {
      const draftRecord = await assertCommissionerAccessForDraft(tx, input.draftId, input.actingUserId);
      await assertDraftExecutionPhase(draftRecord.targetSeasonId);
      const { draft, currentPick } = await validateDraftPick(tx, input);

      if (draftRecord.id !== draft.id) {
        throw new DraftServiceError("Draft context mismatch.", 409);
      }

      await tx.draftPick.update({
        where: {
          id: currentPick.id
        },
        data: {
          selectedNflTeamId: input.nflTeamId.trim(),
          actingUserId: input.actingUserId.trim(),
          pickedAt: new Date()
        }
      });

      const nextPickNumber = Math.min(draft.currentPick + 1, OFFSEASON_DRAFT_PICK_COUNT + 1);

      await tx.draft.update({
        where: {
          id: draft.id
        },
        data: {
          currentPick: nextPickNumber
        }
      });

      return buildDraftState(tx, draft.id);
    });
  },

  async finalizeDraft(input: FinalizeDraftInput) {
    return prisma.$transaction(async (tx) => {
      const draftRecord = await assertCommissionerAccessForDraft(tx, input.draftId, input.actingUserId);
      await assertDraftExecutionPhase(draftRecord.targetSeasonId);
      const { draft } = await validateDraftFinalization(tx, input.draftId);

      if (draftRecord.id !== draft.id) {
        throw new DraftServiceError("Draft context mismatch.", 409);
      }

      if (draft.targetSeason.teamOwnerships.length > 0) {
        throw new DraftServiceError("Target season already has team ownership records.", 409);
      }

      const finalTeamsByMemberId = new Map<string, string[]>();

      for (const member of draft.targetSeason.league.members) {
        const previousOwnerships = draft.sourceSeason.teamOwnerships
          .filter((ownership) => ownership.leagueMember.userId === member.userId)
          .sort((left, right) => left.slot - right.slot);
        const keeperIds = draft.keeperSelections
          .filter((keeper) => keeper.leagueMemberId === member.id)
          .sort(
            (left, right) =>
              previousOwnerships.findIndex((ownership) => ownership.nflTeamId === left.nflTeamId) -
              previousOwnerships.findIndex((ownership) => ownership.nflTeamId === right.nflTeamId)
          )
          .map((keeper) => keeper.nflTeamId);
        const draftedTeamId =
          draft.picks.find((pick) => pick.selectingLeagueMemberId === member.id)?.selectedNflTeamId ?? null;

        const finalTeamIds = draftedTeamId ? [...keeperIds, draftedTeamId] : keeperIds;

        if (finalTeamIds.length !== 3) {
          throw new DraftServiceError("Each owner must end the draft with exactly 3 teams.", 409);
        }

        finalTeamsByMemberId.set(member.id, finalTeamIds);
      }

      await tx.teamOwnership.createMany({
        data: Array.from(finalTeamsByMemberId.entries()).flatMap(([leagueMemberId, nflTeamIds]) =>
          nflTeamIds.map((nflTeamId, index) => ({
            seasonId: draft.targetSeasonId,
            leagueMemberId,
            nflTeamId,
            slot: index + 1
          }))
        )
      });

      await tx.draft.update({
        where: {
          id: draft.id
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          currentPick: OFFSEASON_DRAFT_PICK_COUNT + 1
        }
      });

      return buildDraftState(tx, draft.id);
    });
  }
};

export { DraftServiceError };
