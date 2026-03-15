import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  AssignTeamInput,
  NFLTeamSummary,
  OwnerTeamGroup,
  SeasonOwnershipSummary,
  TeamOwnershipEntry
} from "@/types/team-ownership";

const MAX_TEAMS_PER_OWNER = 3;

class TeamOwnershipServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "TeamOwnershipServiceError";
  }
}

function mapNFLTeam(team: {
  id: string;
  name: string;
  abbreviation: string;
  conference: "AFC" | "NFC";
  division: string;
}): NFLTeamSummary {
  return {
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    conference: team.conference,
    division: team.division
  };
}

function mapOwnershipEntry(ownership: {
  id: string;
  slot: number;
  leagueMemberId: string;
  leagueMember: {
    userId: string;
    user: {
      displayName: string;
      email: string;
    };
  };
  nflTeam: {
    id: string;
    name: string;
    abbreviation: string;
    conference: "AFC" | "NFC";
    division: string;
  };
}): TeamOwnershipEntry {
  return {
    id: ownership.id,
    slot: ownership.slot,
    leagueMemberId: ownership.leagueMemberId,
    userId: ownership.leagueMember.userId,
    displayName: ownership.leagueMember.user.displayName,
    email: ownership.leagueMember.user.email,
    team: mapNFLTeam(ownership.nflTeam)
  };
}

async function listAllTeams(tx: Prisma.TransactionClient | typeof prisma) {
  const teams = await tx.nFLTeam.findMany({
    where: {
      isActive: true
    },
    orderBy: [
      { conference: "asc" },
      { division: "asc" },
      { name: "asc" }
    ]
  });

  return teams.map(mapNFLTeam);
}

async function getSeasonContext(tx: Prisma.TransactionClient | typeof prisma, seasonId: string) {
  const season = await tx.season.findUnique({
    where: {
      id: seasonId
    },
    include: {
      league: {
        include: {
          members: {
            include: {
              user: true
            },
            orderBy: [
              { role: "asc" },
              { joinedAt: "asc" }
            ]
          }
        }
      },
      teamOwnerships: {
        include: {
          nflTeam: true,
          leagueMember: {
            include: {
              user: true
            }
          }
        },
        orderBy: [
          { leagueMember: { role: "asc" } },
          { slot: "asc" }
        ]
      }
    }
  });

  if (!season) {
    throw new TeamOwnershipServiceError("Season not found.", 404);
  }

  return season;
}

function buildOwnerGroups(
  members: Array<{
    id: string;
    role: "COMMISSIONER" | "OWNER";
    userId: string;
    user: {
      displayName: string;
      email: string;
    };
  }>,
  ownerships: Array<{
    id: string;
    slot: number;
    leagueMemberId: string;
    nflTeam: {
      id: string;
      name: string;
      abbreviation: string;
      conference: "AFC" | "NFC";
      division: string;
    };
  }>
): OwnerTeamGroup[] {
  return members.map((member) => {
    const memberOwnerships = ownerships
      .filter((ownership) => ownership.leagueMemberId === member.id)
      .sort((left, right) => left.slot - right.slot);

    return {
      leagueMemberId: member.id,
      userId: member.userId,
      displayName: member.user.displayName,
      email: member.user.email,
      role: member.role,
      teamCount: memberOwnerships.length,
      teams: memberOwnerships.map((ownership) => ({
        ownershipId: ownership.id,
        slot: ownership.slot,
        team: mapNFLTeam(ownership.nflTeam)
      }))
    };
  });
}

async function buildSeasonOwnershipSummary(
  tx: Prisma.TransactionClient | typeof prisma,
  seasonId: string
): Promise<SeasonOwnershipSummary> {
  const [season, activeTeams] = await Promise.all([getSeasonContext(tx, seasonId), listAllTeams(tx)]);

  const takenTeamIds = new Set(season.teamOwnerships.map((ownership) => ownership.nflTeamId));
  const owners = buildOwnerGroups(season.league.members, season.teamOwnerships);

  return {
    seasonId: season.id,
    leagueId: season.leagueId,
    seasonName: season.name,
    seasonYear: season.year,
    owners,
    availableTeams: activeTeams.filter((team) => !takenTeamIds.has(team.id))
  };
}

async function resolveLeagueMemberForSeason(
  tx: Prisma.TransactionClient | typeof prisma,
  seasonId: string,
  userId: string
) {
  const season = await tx.season.findUnique({
    where: {
      id: seasonId
    },
    select: {
      id: true,
      leagueId: true
    }
  });

  if (!season) {
    throw new TeamOwnershipServiceError("Season not found.", 404);
  }

  const leagueMember = await tx.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId: season.leagueId,
        userId
      }
    },
    include: {
      user: true
    }
  });

  if (!leagueMember) {
    throw new TeamOwnershipServiceError("User is not a member of this league.", 404);
  }

  return {
    season,
    leagueMember
  };
}

async function validateTeamAssignmentInternal(
  tx: Prisma.TransactionClient | typeof prisma,
  seasonId: string,
  userId: string,
  nflTeamId: string
) {
  const [{ leagueMember }, existingOwnershipByMember, existingOwnershipByTeam, team] = await Promise.all([
    resolveLeagueMemberForSeason(tx, seasonId, userId),
    tx.teamOwnership.findMany({
      where: {
        seasonId,
        leagueMember: {
          userId
        }
      },
      orderBy: {
        slot: "asc"
      }
    }),
    tx.teamOwnership.findUnique({
      where: {
        seasonId_nflTeamId: {
          seasonId,
          nflTeamId
        }
      }
    }),
    tx.nFLTeam.findUnique({
      where: {
        id: nflTeamId
      }
    })
  ]);

  if (!team || !team.isActive) {
    throw new TeamOwnershipServiceError("NFL team not found.", 404);
  }

  if (existingOwnershipByTeam) {
    throw new TeamOwnershipServiceError("That team is already assigned in this season.", 409);
  }

  if (existingOwnershipByMember.length >= MAX_TEAMS_PER_OWNER) {
    throw new TeamOwnershipServiceError("A league member cannot own more than 3 teams in a season.", 409);
  }

  return {
    leagueMemberId: leagueMember.id,
    nextSlot: existingOwnershipByMember.length + 1,
    team: mapNFLTeam(team)
  };
}

export const teamOwnershipService = {
  async getAllTeams() {
    return listAllTeams(prisma);
  },

  async getSeasonOwnership(seasonId: string) {
    if (!seasonId.trim()) {
      throw new TeamOwnershipServiceError("seasonId is required.", 400);
    }

    return buildSeasonOwnershipSummary(prisma, seasonId.trim());
  },

  async getUserTeamsForSeason(seasonId: string, userId: string) {
    if (!seasonId.trim() || !userId.trim()) {
      throw new TeamOwnershipServiceError("seasonId and userId are required.", 400);
    }

    const normalizedSeasonId = seasonId.trim();
    const normalizedUserId = userId.trim();
    const { leagueMember } = await resolveLeagueMemberForSeason(prisma, normalizedSeasonId, normalizedUserId);

    const ownerships = await prisma.teamOwnership.findMany({
      where: {
        seasonId: normalizedSeasonId,
        leagueMemberId: leagueMember.id
      },
      include: {
        nflTeam: true,
        leagueMember: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        slot: "asc"
      }
    });

    return ownerships.map(mapOwnershipEntry);
  },

  async getTeamsByOwner(seasonId: string) {
    if (!seasonId.trim()) {
      throw new TeamOwnershipServiceError("seasonId is required.", 400);
    }

    const summary = await buildSeasonOwnershipSummary(prisma, seasonId.trim());
    return summary.owners;
  },

  async getAvailableTeams(seasonId: string) {
    if (!seasonId.trim()) {
      throw new TeamOwnershipServiceError("seasonId is required.", 400);
    }

    const summary = await buildSeasonOwnershipSummary(prisma, seasonId.trim());
    return summary.availableTeams;
  },

  async validateTeamAssignment(seasonId: string, userId: string, nflTeamId: string) {
    if (!seasonId.trim() || !userId.trim() || !nflTeamId.trim()) {
      throw new TeamOwnershipServiceError("seasonId, userId, and nflTeamId are required.", 400);
    }

    return validateTeamAssignmentInternal(prisma, seasonId.trim(), userId.trim(), nflTeamId.trim());
  },

  async assignTeamToUser(input: AssignTeamInput) {
    const seasonId = input.seasonId.trim();
    const userId = input.userId.trim();
    const nflTeamId = input.nflTeamId.trim();

    if (!seasonId || !userId || !nflTeamId) {
      throw new TeamOwnershipServiceError("seasonId, userId, and nflTeamId are required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const validation = await validateTeamAssignmentInternal(tx, seasonId, userId, nflTeamId);

      try {
        const ownership = await tx.teamOwnership.create({
          data: {
            seasonId,
            leagueMemberId: validation.leagueMemberId,
            nflTeamId,
            slot: validation.nextSlot
          },
          include: {
            nflTeam: true,
            leagueMember: {
              include: {
                user: true
              }
            }
          }
        });

        return {
          ownership: mapOwnershipEntry(ownership),
          seasonOwnership: await buildSeasonOwnershipSummary(tx, seasonId)
        };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new TeamOwnershipServiceError("That team assignment already exists.", 409);
        }

        throw error;
      }
    });
  }
};

export { TeamOwnershipServiceError };
