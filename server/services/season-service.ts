import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  CreateSeasonInput,
  SeasonSetupStatus,
  SeasonActorInput,
  SeasonSummary,
  SetActiveSeasonInput,
  UpdateSeasonYearInput
} from "@/types/season";

class SeasonServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "SeasonServiceError";
  }
}

function mapSeason(season: {
  id: string;
  leagueId: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  leaguePhase: "IN_SEASON" | "POST_SEASON" | "DROP_PHASE" | "DRAFT_PHASE";
  isLocked: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
}): SeasonSummary {
  return {
    id: season.id,
    leagueId: season.leagueId,
    year: season.year,
    name: season.name,
    status: season.status,
    leaguePhase: season.leaguePhase,
    isLocked: season.isLocked,
    startsAt: season.startsAt?.toISOString() ?? null,
    endsAt: season.endsAt?.toISOString() ?? null,
    createdAt: season.createdAt.toISOString()
  };
}

async function getLeagueOrThrow(tx: Prisma.TransactionClient | typeof prisma, leagueId: string) {
  const league = await tx.league.findUnique({
    where: {
      id: leagueId
    }
  });

  if (!league) {
    throw new SeasonServiceError("League not found.", 404);
  }

  return league;
}

async function assertActingCommissionerForLeague(
  tx: Prisma.TransactionClient | typeof prisma,
  leagueId: string,
  actingUserId: string
) {
  const normalizedActingUserId = actingUserId.trim();

  if (!normalizedActingUserId) {
    throw new SeasonServiceError("actingUserId is required.", 400);
  }

  const commissioner = await tx.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId,
        userId: normalizedActingUserId
      }
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!commissioner || commissioner.role !== "COMMISSIONER") {
    throw new SeasonServiceError("Only the commissioner can perform this action.", 403);
  }

  return commissioner;
}

async function getSeasonOrThrow(tx: Prisma.TransactionClient | typeof prisma, seasonId: string) {
  const season = await tx.season.findUnique({
    where: {
      id: seasonId
    }
  });

  if (!season) {
    throw new SeasonServiceError("Season not found.", 404);
  }

  return season;
}

async function assertActingCommissionerForSeason(
  tx: Prisma.TransactionClient | typeof prisma,
  seasonId: string,
  actingUserId: string
) {
  const normalizedActingUserId = actingUserId.trim();

  if (!normalizedActingUserId) {
    throw new SeasonServiceError("actingUserId is required.", 400);
  }

  const season = await tx.season.findUnique({
    where: {
      id: seasonId
    },
    select: {
      id: true,
      leagueId: true,
      year: true,
      isLocked: true
    }
  });

  if (!season) {
    throw new SeasonServiceError("Season not found.", 404);
  }

  const commissioner = await tx.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId: season.leagueId,
        userId: normalizedActingUserId
      }
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!commissioner || commissioner.role !== "COMMISSIONER") {
    throw new SeasonServiceError("Only the commissioner can perform this action.", 403);
  }

  return {
    season,
    commissioner
  };
}

async function getSeasonSetupStatusInternal(
  tx: Prisma.TransactionClient | typeof prisma,
  seasonId: string
): Promise<SeasonSetupStatus> {
  const season = await tx.season.findUnique({
    where: {
      id: seasonId
    },
    include: {
      league: {
        include: {
          members: {
            include: {
              user: true,
              teamOwnerships: {
                where: {
                  seasonId
                }
              }
            },
            orderBy: [
              { role: "asc" },
              { joinedAt: "asc" }
            ]
          }
        }
      },
      teamOwnerships: true
    }
  });

  if (!season) {
    throw new SeasonServiceError("Season not found.", 404);
  }

  const memberCount = season.league.members.length;
  const assignedTeamCount = season.teamOwnerships.length;
  const unassignedTeamCount = 32 - assignedTeamCount;
  const ownerStatuses = season.league.members.map((member) => {
    const assignedCount = member.teamOwnerships.length;

    return {
      leagueMemberId: member.id,
      userId: member.userId,
      displayName: member.user.displayName,
      role: member.role,
      assignedTeamCount: assignedCount,
      isValid: assignedCount === 3
    };
  });

  const hasExactlyTenMembers = memberCount === 10;
  const eachMemberHasThreeTeams = ownerStatuses.every((owner) => owner.assignedTeamCount === 3);
  const hasThirtyAssignedTeams = assignedTeamCount === 30;
  const hasTwoUnassignedTeams = unassignedTeamCount === 2;

  return {
    seasonId: season.id,
    leagueId: season.leagueId,
    memberCount,
    assignedTeamCount,
    unassignedTeamCount,
    hasExactlyTenMembers,
    eachMemberHasThreeTeams,
    hasThirtyAssignedTeams,
    hasTwoUnassignedTeams,
    isValid:
      hasExactlyTenMembers && eachMemberHasThreeTeams && hasThirtyAssignedTeams && hasTwoUnassignedTeams,
    ownerStatuses
  };
}

export const seasonService = {
  async createSeason(input: CreateSeasonInput) {
    const leagueId = input.leagueId.trim();

    if (!leagueId) {
      throw new SeasonServiceError("leagueId is required.", 400);
    }

    if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 3000) {
      throw new SeasonServiceError("A valid season year is required.", 400);
    }

    const name = input.name?.trim() || null;

    await getLeagueOrThrow(prisma, leagueId);
    await assertActingCommissionerForLeague(prisma, leagueId, input.actingUserId);

    try {
      const season = await prisma.season.create({
        data: {
          leagueId,
          year: input.year,
          name,
          status: "PLANNING",
          leaguePhase: "IN_SEASON"
        }
      });

      return mapSeason(season);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new SeasonServiceError("A season for that league year already exists.", 409);
      }

      throw error;
    }
  },

  async getLeagueSeasons(leagueId: string) {
    const normalizedLeagueId = leagueId.trim();

    if (!normalizedLeagueId) {
      throw new SeasonServiceError("leagueId is required.", 400);
    }

    await getLeagueOrThrow(prisma, normalizedLeagueId);

    const seasons = await prisma.season.findMany({
      where: {
        leagueId: normalizedLeagueId
      },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }]
    });

    return seasons.map(mapSeason);
  },

  async getActiveSeason(leagueId: string) {
    const normalizedLeagueId = leagueId.trim();

    if (!normalizedLeagueId) {
      throw new SeasonServiceError("leagueId is required.", 400);
    }

    await getLeagueOrThrow(prisma, normalizedLeagueId);

    const season = await prisma.season.findFirst({
      where: {
        leagueId: normalizedLeagueId,
        status: "ACTIVE"
      },
      orderBy: {
        year: "desc"
      }
    });

    return season ? mapSeason(season) : null;
  },

  async setActiveSeason(input: SetActiveSeasonInput) {
    const leagueId = input.leagueId.trim();
    const seasonId = input.seasonId.trim();

    if (!leagueId || !seasonId) {
      throw new SeasonServiceError("leagueId and seasonId are required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      await getLeagueOrThrow(tx, leagueId);
      await assertActingCommissionerForLeague(tx, leagueId, input.actingUserId);
      const season = await getSeasonOrThrow(tx, seasonId);

      if (season.leagueId !== leagueId) {
        throw new SeasonServiceError("Season does not belong to this league.", 400);
      }

      await tx.season.updateMany({
        where: {
          leagueId,
          status: "ACTIVE",
          NOT: {
            id: seasonId
          }
        },
        data: {
          status: "PLANNING"
        }
      });

      const updatedSeason = await tx.season.update({
        where: {
          id: seasonId
        },
        data: {
          status: "ACTIVE",
          leaguePhase: "IN_SEASON"
        }
      });

      return mapSeason(updatedSeason);
    });
  },

  async getSeasonSetupStatus(seasonId: string) {
    const normalizedSeasonId = seasonId.trim();

    if (!normalizedSeasonId) {
      throw new SeasonServiceError("seasonId is required.", 400);
    }

    return getSeasonSetupStatusInternal(prisma, normalizedSeasonId);
  },

  async assertCommissionerAccess(seasonId: string, actingUserId: string) {
    const normalizedSeasonId = seasonId.trim();

    if (!normalizedSeasonId) {
      throw new SeasonServiceError("seasonId is required.", 400);
    }

    return assertActingCommissionerForSeason(prisma, normalizedSeasonId, actingUserId);
  },

  async lockSeasonWithActor(input: SeasonActorInput) {
    const normalizedSeasonId = input.seasonId.trim();

    if (!normalizedSeasonId) {
      throw new SeasonServiceError("seasonId is required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const { season } = await assertActingCommissionerForSeason(tx, normalizedSeasonId, input.actingUserId);
      const status = await getSeasonSetupStatusInternal(tx, normalizedSeasonId);

      if (!status.isValid) {
        throw new SeasonServiceError("Season setup is incomplete and cannot be locked.", 409);
      }

      const lockedSeason = await tx.season.update({
        where: {
          id: season.id
        },
        data: {
          isLocked: true
        }
      });

      return {
        season: mapSeason(lockedSeason),
        status
      };
    });
  },

  async unlockSeason(input: SeasonActorInput) {
    const normalizedSeasonId = input.seasonId.trim();

    if (!normalizedSeasonId) {
      throw new SeasonServiceError("seasonId is required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const { season } = await assertActingCommissionerForSeason(tx, normalizedSeasonId, input.actingUserId);

      if (!season.isLocked) {
        throw new SeasonServiceError("Season is already unlocked.", 409);
      }

      const unlockedSeason = await tx.season.update({
        where: {
          id: season.id
        },
        data: {
          isLocked: false
        }
      });

      return mapSeason(unlockedSeason);
    });
  },

  async updateSeasonYear(input: UpdateSeasonYearInput) {
    const normalizedSeasonId = input.seasonId.trim();

    if (!normalizedSeasonId) {
      throw new SeasonServiceError("seasonId is required.", 400);
    }

    if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 3000) {
      throw new SeasonServiceError("A valid season year is required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const { season } = await assertActingCommissionerForSeason(tx, normalizedSeasonId, input.actingUserId);

      if (season.year === input.year) {
        throw new SeasonServiceError("Season is already using that year.", 409);
      }

      try {
        const updatedSeason = await tx.season.update({
          where: {
            id: season.id
          },
          data: {
            year: input.year
          }
        });

        return mapSeason(updatedSeason);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new SeasonServiceError("A season for that league year already exists.", 409);
        }

        throw error;
      }
    });
  }
};

export { SeasonServiceError };
