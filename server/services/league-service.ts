import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { seasonService } from "@/server/services/season-service";
import type {
  AddLeagueMemberInput,
  CreateLeagueInput,
  JoinLeagueInput,
  LeagueBootstrapMember,
  LeagueBootstrapState,
  LeagueDashboard,
  LeagueListItem,
  LeagueMemberSummary,
  LeagueSeasonSummary,
  RemoveLeagueMemberInput
} from "@/types/league";

const MAX_LEAGUE_MEMBERS = 10;

class LeagueServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "LeagueServiceError";
  }
}

function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

async function generateLeagueSlug(name: string) {
  const baseSlug = toSlug(name);

  if (!baseSlug) {
    throw new LeagueServiceError("League name must contain letters or numbers.", 400);
  }

  const matchingLeagues = await prisma.league.findMany({
    where: {
      slug: {
        startsWith: baseSlug
      }
    },
    select: {
      slug: true
    }
  });

  const usedSlugs = new Set(matchingLeagues.map((league) => league.slug));

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

async function ensureExistingUser(userId: string) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new LeagueServiceError("A userId is required.", 400);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId
    }
  });

  if (!user) {
    throw new LeagueServiceError("Authenticated user not found.", 401);
  }

  return user;
}

async function assertCommissionerAccessForLeague(
  tx: Prisma.TransactionClient | typeof prisma,
  leagueId: string,
  actingUserId: string
) {
  const normalizedLeagueId = leagueId.trim();
  const normalizedActingUserId = actingUserId.trim();

  if (!normalizedLeagueId || !normalizedActingUserId) {
    throw new LeagueServiceError("leagueId and actingUserId are required.", 400);
  }

  const membership = await tx.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId: normalizedLeagueId,
        userId: normalizedActingUserId
      }
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!membership || membership.role !== "COMMISSIONER") {
    throw new LeagueServiceError("Only the commissioner can perform this action.", 403);
  }

  return membership;
}

function createMockUserIdSeed(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function generateMockUserId(displayName: string, email: string, mockUserKey?: string) {
  const baseId =
    createMockUserIdSeed(mockUserKey ?? "") ||
    createMockUserIdSeed(email.split("@")[0] ?? "") ||
    createMockUserIdSeed(displayName) ||
    "league-member";

  let candidate = baseId;
  let suffix = 2;

  while (await prisma.user.findUnique({ where: { id: candidate }, select: { id: true } })) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function mapBootstrapMember(member: {
  id: string;
  role: "COMMISSIONER" | "OWNER";
  joinedAt: Date;
  userId: string;
  user: {
    displayName: string;
    email: string;
  };
  teamOwnerships?: Array<{ id: string }>;
}, canRemove: boolean): LeagueBootstrapMember {
  return {
    id: member.id,
    userId: member.userId,
    displayName: member.user.displayName,
    email: member.user.email,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    assignmentCount: member.teamOwnerships?.length ?? 0,
    canRemove
  };
}

function mapLeagueMember(member: {
  id: string;
  role: "COMMISSIONER" | "OWNER";
  joinedAt: Date;
  user: {
    id: string;
    displayName: string;
    email: string;
  };
}): LeagueMemberSummary {
  return {
    id: member.id,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    user: member.user
  };
}

function mapSeason(season: {
  id: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  isLocked: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}): LeagueSeasonSummary {
  return {
    ...season,
    startsAt: season.startsAt?.toISOString() ?? null,
    endsAt: season.endsAt?.toISOString() ?? null
  };
}

function mapLeagueDashboard(league: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  members: Array<{
    id: string;
    role: "COMMISSIONER" | "OWNER";
    joinedAt: Date;
    user: {
      id: string;
      displayName: string;
      email: string;
    };
  }>;
  seasons: Array<{
    id: string;
    year: number;
    name: string | null;
    status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
    isLocked: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
  }>;
}): LeagueDashboard {
  return {
    id: league.id,
    name: league.name,
    slug: league.slug,
    description: league.description,
    createdAt: league.createdAt.toISOString(),
    members: league.members.map(mapLeagueMember),
    seasons: league.seasons.map(mapSeason)
  };
}

async function getLeagueDashboard(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: {
      id: leagueId
    },
    include: {
      members: {
        include: {
          user: true
        },
        orderBy: [
          {
            role: "asc"
          },
          {
            joinedAt: "asc"
          }
        ]
      },
      seasons: {
        orderBy: {
          year: "desc"
        }
      }
    }
  });

  if (!league) {
    throw new LeagueServiceError("League not found.", 404);
  }

  return mapLeagueDashboard(league);
}

export const leagueService = {
  async createLeague(input: CreateLeagueInput) {
    const name = input.name.trim();

    if (!name) {
      throw new LeagueServiceError("League name is required.", 400);
    }

    const description = input.description?.trim() || null;
    const user = await ensureExistingUser(input.userId);
    const slug = await generateLeagueSlug(name);

    try {
      const league = await prisma.$transaction(async (tx) => {
        const createdLeague = await tx.league.create({
          data: {
            name,
            slug,
            description
          }
        });

        await tx.leagueMember.create({
          data: {
            leagueId: createdLeague.id,
            userId: user.id,
            role: "COMMISSIONER"
          }
        });

        return tx.league.findUniqueOrThrow({
          where: {
            id: createdLeague.id
          },
          include: {
            members: {
              include: {
                user: true
              }
            },
            seasons: {
              orderBy: {
                year: "desc"
              }
            }
          }
        });
      });

      return mapLeagueDashboard(league);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new LeagueServiceError("League with that identifier already exists.", 409);
      }

      throw error;
    }
  },

  async listLeagues(): Promise<LeagueListItem[]> {
    const leagues = await prisma.league.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        _count: {
          select: {
            members: true,
            seasons: true
          }
        }
      }
    });

    return leagues.map((league) => ({
      id: league.id,
      name: league.name,
      slug: league.slug,
      description: league.description,
      createdAt: league.createdAt.toISOString(),
      memberCount: league._count.members,
      seasonCount: league._count.seasons
    }));
  },

  async joinLeague(input: JoinLeagueInput) {
    const leagueId = input.leagueId.trim();

    if (!leagueId) {
      throw new LeagueServiceError("leagueId is required.", 400);
    }

    const user = await ensureExistingUser(input.userId);

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId
      },
      include: {
        members: true
      }
    });

    if (!league) {
      throw new LeagueServiceError("League not found.", 404);
    }

    if (league.members.some((member) => member.userId === user.id)) {
      return getLeagueDashboard(leagueId);
    }

    if (league.members.length >= MAX_LEAGUE_MEMBERS) {
      throw new LeagueServiceError("League already has the maximum number of owners.", 409);
    }

    try {
      await prisma.leagueMember.create({
        data: {
          leagueId,
          userId: user.id,
          role: "OWNER"
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return getLeagueDashboard(leagueId);
      }

      throw error;
    }

    return getLeagueDashboard(leagueId);
  },

  async getLeagueMembers(leagueId: string) {
    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId
      },
      include: {
        user: true
      },
      orderBy: [
        {
          role: "asc"
        },
        {
          joinedAt: "asc"
        }
      ]
    });

    return members.map(mapLeagueMember);
  },

  async addLeagueMember(input: AddLeagueMemberInput) {
    const leagueId = input.leagueId.trim();
    const displayName = input.displayName.trim();
    const email = input.email.trim().toLowerCase();

    if (!leagueId || !displayName || !email) {
      throw new LeagueServiceError("leagueId, displayName, and email are required.", 400);
    }

    await assertCommissionerAccessForLeague(prisma, leagueId, input.actingUserId);

    const activeSeason = await seasonService.getActiveSeason(leagueId);

    if (!activeSeason) {
      throw new LeagueServiceError("Create or activate a season before bootstrapping league members.", 409);
    }

    if (activeSeason.isLocked) {
      throw new LeagueServiceError("The active season is locked and league members can no longer be changed.", 409);
    }

    const league = await prisma.league.findUnique({
      where: {
        id: leagueId
      },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    });

    if (!league) {
      throw new LeagueServiceError("League not found.", 404);
    }

    if (league.members.length >= MAX_LEAGUE_MEMBERS) {
      throw new LeagueServiceError("League already has the maximum number of members.", 409);
    }

    if (league.members.some((member) => member.user.email.toLowerCase() === email)) {
      throw new LeagueServiceError("A league member with that email already exists.", 409);
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email
      }
    });

    const user =
      existingUser ??
      (await prisma.user.create({
        data: {
          id: await generateMockUserId(displayName, email, input.mockUserKey),
          displayName,
          email
        }
      }));

    try {
      const member = await prisma.leagueMember.create({
        data: {
          leagueId,
          userId: user.id,
          role: "OWNER"
        },
        include: {
          user: true,
          teamOwnerships: {
            where: {
              seasonId: activeSeason.id
            }
          }
        }
      });

      return mapBootstrapMember(member, true);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new LeagueServiceError("That member is already part of the league.", 409);
      }

      throw error;
    }
  },

  async getBootstrapMembers(leagueId: string) {
    const normalizedLeagueId = leagueId.trim();

    if (!normalizedLeagueId) {
      throw new LeagueServiceError("leagueId is required.", 400);
    }

    const activeSeason = await seasonService.getActiveSeason(normalizedLeagueId);

    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId: normalizedLeagueId
      },
      include: {
        user: true,
        teamOwnerships: activeSeason
          ? {
              where: {
                seasonId: activeSeason.id
              }
            }
          : {
              where: {
                id: {
                  in: []
                }
              }
            }
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
    });

    return members.map((member) =>
      mapBootstrapMember(
        member,
        member.role !== "COMMISSIONER" &&
          !activeSeason?.isLocked &&
          (member.teamOwnerships?.length ?? 0) === 0 &&
          Boolean(activeSeason)
      )
    );
  },

  async removeLeagueMember(input: RemoveLeagueMemberInput) {
    const leagueId = input.leagueId.trim();
    const leagueMemberId = input.leagueMemberId.trim();

    if (!leagueId || !leagueMemberId) {
      throw new LeagueServiceError("leagueId and leagueMemberId are required.", 400);
    }

    await assertCommissionerAccessForLeague(prisma, leagueId, input.actingUserId);

    const activeSeason = await seasonService.getActiveSeason(leagueId);

    if (!activeSeason) {
      throw new LeagueServiceError("Create or activate a season before modifying league members.", 409);
    }

    if (activeSeason.isLocked) {
      throw new LeagueServiceError("The active season is locked and members can no longer be removed.", 409);
    }

    const member = await prisma.leagueMember.findUnique({
      where: {
        id: leagueMemberId
      },
      include: {
        teamOwnerships: {
          where: {
            seasonId: activeSeason.id
          }
        }
      }
    });

    if (!member || member.leagueId !== leagueId) {
      throw new LeagueServiceError("League member not found.", 404);
    }

    if (member.role === "COMMISSIONER") {
      throw new LeagueServiceError("The commissioner cannot be removed from the league.", 409);
    }

    if (member.teamOwnerships.length > 0) {
      throw new LeagueServiceError("Remove this member's assigned NFL teams before removing them.", 409);
    }

    await prisma.leagueMember.delete({
      where: {
        id: leagueMemberId
      }
    });

    return {
      removedLeagueMemberId: leagueMemberId
    };
  },

  async getBootstrapState(leagueId: string): Promise<LeagueBootstrapState> {
    const normalizedLeagueId = leagueId.trim();

    if (!normalizedLeagueId) {
      throw new LeagueServiceError("leagueId is required.", 400);
    }

    const [league, activeSeason, members] = await Promise.all([
      prisma.league.findUnique({
        where: {
          id: normalizedLeagueId
        },
        include: {
          members: {
            include: {
              user: true
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
          }
        }
      }),
      seasonService.getActiveSeason(normalizedLeagueId),
      this.getBootstrapMembers(normalizedLeagueId)
    ]);

    if (!league) {
      throw new LeagueServiceError("League not found.", 404);
    }

    const commissionerRecord = league.members.find((member) => member.role === "COMMISSIONER") ?? null;
    const validationStatus = activeSeason ? await seasonService.getSeasonSetupStatus(activeSeason.id) : null;
    const assignedTeamCount = validationStatus?.assignedTeamCount ?? 0;
    const unassignedTeamCount = validationStatus?.unassignedTeamCount ?? 0;
    const everyMemberHasExactlyThreeTeams = validationStatus?.eachMemberHasThreeTeams ?? false;
    const hasActiveSeason = Boolean(activeSeason);
    const isReadyToLock = Boolean(activeSeason && validationStatus?.isValid && !activeSeason.isLocked);

    return {
      league: {
        id: league.id,
        name: league.name,
        slug: league.slug,
        description: league.description,
        commissioner: commissionerRecord
          ? {
              leagueMemberId: commissionerRecord.id,
              userId: commissionerRecord.userId,
              displayName: commissionerRecord.user.displayName,
              email: commissionerRecord.user.email
            }
          : null
      },
      memberCount: members.length,
      members,
      activeSeason,
      assignedTeamCount,
      unassignedTeamCount,
      everyMemberHasExactlyThreeTeams,
      validationStatus,
      lockReadiness: {
        hasActiveSeason,
        hasExactlyTenMembers: validationStatus?.hasExactlyTenMembers ?? false,
        hasThirtyAssignedTeams: validationStatus?.hasThirtyAssignedTeams ?? false,
        hasTwoUnassignedTeams: validationStatus?.hasTwoUnassignedTeams ?? false,
        everyMemberHasExactlyThreeTeams,
        isReadyToLock,
        state: activeSeason?.isLocked ? "LOCKED" : isReadyToLock ? "READY_TO_LOCK" : "NOT_READY"
      }
    };
  },

  async getLeagueSeasons(leagueId: string) {
    const seasons = await prisma.season.findMany({
      where: {
        leagueId
      },
      orderBy: {
        year: "desc"
      }
    });

    return seasons.map(mapSeason);
  },

  async assertCommissionerAccess(leagueId: string, actingUserId: string) {
    return assertCommissionerAccessForLeague(prisma, leagueId, actingUserId);
  },

  getLeagueDashboard
};

export { LeagueServiceError };
