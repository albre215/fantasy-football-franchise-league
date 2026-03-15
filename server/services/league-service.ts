import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  CreateLeagueInput,
  JoinLeagueInput,
  LeagueDashboard,
  LeagueListItem,
  LeagueMemberSummary,
  LeagueSeasonSummary
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

async function ensureMockUser(userId: string) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new LeagueServiceError("A userId is required.", 400);
  }

  return prisma.user.upsert({
    where: {
      id: normalizedUserId
    },
    update: {},
    create: {
      id: normalizedUserId,
      email: `${normalizedUserId}@mock.local`,
      displayName: normalizedUserId
        .split(/[-_]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    }
  });
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
    const user = await ensureMockUser(input.userId);
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

    const user = await ensureMockUser(input.userId);

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

  getLeagueDashboard
};

export { LeagueServiceError };
