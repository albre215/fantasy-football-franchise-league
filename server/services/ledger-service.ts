import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { seasonService } from "@/server/services/season-service";
import type { FantasyPayoutConfigEntry } from "@/types/results";
import type {
  CreateManualAdjustmentInput,
  LedgerEntrySummary,
  LedgerOwnerBalance,
  LedgerOwnerSummary,
  LeagueMemberSeasonLedger,
  SeasonLedgerSummary
} from "@/types/ledger";

class LedgerServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "LedgerServiceError";
  }
}

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

interface ReplaceFantasyPayoutEntriesInput {
  seasonId: string;
  leagueId: string;
  actingUserId: string;
  payoutConfig: FantasyPayoutConfigEntry[];
  standings: Array<{
    leagueMemberId: string;
    rank: number;
    displayName: string;
  }>;
}

interface ReplaceSeasonNflLedgerEntriesInput {
  seasonId: string;
  leagueId: string;
  actingUserId: string;
  ownerEntries: Array<{
    leagueMemberId: string;
    displayName: string;
    regularSeasonAmount: number;
    playoffAmount: number;
    regularSeasonWins: number;
    playoffWins: number;
    ownedTeamIds: string[];
  }>;
}

function decimalToNumber(value: Prisma.Decimal | number | string) {
  return Number(new Prisma.Decimal(value).toFixed(2));
}

function normalizeAmount(value: number) {
  if (!Number.isFinite(value)) {
    throw new LedgerServiceError("A valid numeric amount is required.", 400);
  }

  const normalized = Number(value.toFixed(2));

  if (normalized === 0) {
    throw new LedgerServiceError("Manual adjustments must be greater than zero or less than zero.", 400);
  }

  return normalized;
}

function mapSeason(season: {
  id: string;
  leagueId: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
}): SeasonLedgerSummary["season"] {
  return {
    id: season.id,
    leagueId: season.leagueId,
    year: season.year,
    name: season.name,
    status: season.status
  };
}

function mapOwner(member: {
  id: string;
  userId: string;
  role: "COMMISSIONER" | "OWNER";
  user: {
    displayName: string;
    email: string;
  };
}): LedgerOwnerSummary {
  return {
    leagueMemberId: member.id,
    userId: member.userId,
    displayName: member.user.displayName,
    email: member.user.email,
    role: member.role
  };
}

function mapEntry(entry: {
  id: string;
  leagueId: string;
  seasonId: string;
  leagueMemberId: string;
  category: "MANUAL_ADJUSTMENT" | "FANTASY_PAYOUT" | "NFL_REGULAR_SEASON" | "NFL_PLAYOFF" | "UNUSED_TEAM_ALLOCATION";
  amount: Prisma.Decimal;
  description: string;
  metadata: Prisma.JsonValue | null;
  actingUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  leagueMember: {
    id: string;
    userId: string;
    role: "COMMISSIONER" | "OWNER";
    user: {
      displayName: string;
      email: string;
    };
  };
}): LedgerEntrySummary {
  return {
    id: entry.id,
    leagueId: entry.leagueId,
    seasonId: entry.seasonId,
    leagueMemberId: entry.leagueMemberId,
    owner: mapOwner(entry.leagueMember),
    category: entry.category,
    amount: decimalToNumber(entry.amount),
    description: entry.description,
    metadata: (entry.metadata as Record<string, unknown> | null) ?? null,
    actingUserId: entry.actingUserId,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

async function getSeasonContextOrThrow(tx: PrismaClientLike, seasonId: string) {
  const normalizedSeasonId = seasonId.trim();

  if (!normalizedSeasonId) {
    throw new LedgerServiceError("seasonId is required.", 400);
  }

  const season = await tx.season.findUnique({
    where: {
      id: normalizedSeasonId
    },
    select: {
      id: true,
      leagueId: true,
      year: true,
      name: true,
      status: true,
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
  });

  if (!season) {
    throw new LedgerServiceError("Season not found.", 404);
  }

  return season;
}

async function assertViewerMembershipForSeason(tx: PrismaClientLike, seasonId: string, actingUserId: string) {
  const season = await getSeasonContextOrThrow(tx, seasonId);
  const normalizedActingUserId = actingUserId.trim();

  if (!normalizedActingUserId) {
    throw new LedgerServiceError("actingUserId is required.", 400);
  }

  const membership = season.league.members.find((member) => member.userId === normalizedActingUserId) ?? null;

  if (!membership) {
    throw new LedgerServiceError("Only league members can view this season ledger.", 403);
  }

  return {
    season,
    membership
  };
}

async function getSeasonEntries(
  tx: PrismaClientLike,
  seasonId: string,
  leagueMemberId?: string
) {
  return tx.ledgerEntry.findMany({
    where: {
      seasonId,
      ...(leagueMemberId ? { leagueMemberId } : {})
    },
    include: {
      leagueMember: {
        include: {
          user: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

function buildBalances(
  members: Array<{
    id: string;
    userId: string;
    role: "COMMISSIONER" | "OWNER";
    user: {
      displayName: string;
      email: string;
    };
  }>,
  entries: Awaited<ReturnType<typeof getSeasonEntries>>
): LedgerOwnerBalance[] {
  const totalsByMemberId = new Map<
    string,
    {
      totalBalance: number;
      totalPositive: number;
      totalNegative: number;
      entryCount: number;
    }
  >();

  for (const entry of entries) {
    const amount = decimalToNumber(entry.amount);
    const current = totalsByMemberId.get(entry.leagueMemberId) ?? {
      totalBalance: 0,
      totalPositive: 0,
      totalNegative: 0,
      entryCount: 0
    };

    totalsByMemberId.set(entry.leagueMemberId, {
      totalBalance: Number((current.totalBalance + amount).toFixed(2)),
      totalPositive: Number((current.totalPositive + (amount > 0 ? amount : 0)).toFixed(2)),
      totalNegative: Number((current.totalNegative + (amount < 0 ? amount : 0)).toFixed(2)),
      entryCount: current.entryCount + 1
    });
  }

  return members
    .map((member) => {
      const totals = totalsByMemberId.get(member.id) ?? {
        totalBalance: 0,
        totalPositive: 0,
        totalNegative: 0,
        entryCount: 0
      };

      return {
        ...mapOwner(member),
        ...totals
      };
    })
    .sort((left, right) => {
      if (right.totalBalance !== left.totalBalance) {
        return right.totalBalance - left.totalBalance;
      }

      return left.displayName.localeCompare(right.displayName);
    });
}

function buildSeasonTotals(entries: Awaited<ReturnType<typeof getSeasonEntries>>) {
  return entries.reduce(
    (totals, entry) => {
      const amount = decimalToNumber(entry.amount);

      return {
        entryCount: totals.entryCount + 1,
        totalPositive: Number((totals.totalPositive + (amount > 0 ? amount : 0)).toFixed(2)),
        totalNegative: Number((totals.totalNegative + (amount < 0 ? amount : 0)).toFixed(2)),
        net: Number((totals.net + amount).toFixed(2))
      };
    },
    {
      entryCount: 0,
      totalPositive: 0,
      totalNegative: 0,
      net: 0
    }
  );
}

async function replaceFantasyPayoutEntriesForSeasonTx(
  tx: PrismaClientLike,
  input: ReplaceFantasyPayoutEntriesInput
) {
  await tx.ledgerEntry.deleteMany({
    where: {
      seasonId: input.seasonId,
      category: "FANTASY_PAYOUT"
    }
  });

  const payoutsByRank = new Map(input.payoutConfig.map((entry) => [entry.rank, entry.amount] as const));
  const entriesToCreate = input.standings
    .map((standing) => {
      const configuredAmount = payoutsByRank.get(standing.rank) ?? 0;
      const amount = Number(configuredAmount.toFixed(2));

      if (amount === 0) {
        return null;
      }

      return {
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        leagueMemberId: standing.leagueMemberId,
        category: "FANTASY_PAYOUT" as const,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        description: `Fantasy payout for ${standing.rank}${standing.rank === 1 ? "st" : standing.rank === 2 ? "nd" : standing.rank === 3 ? "rd" : "th"} place`,
        metadata: {
          source: "FINAL_FANTASY_STANDINGS",
          rank: standing.rank
        } as Prisma.InputJsonValue,
        actingUserId: input.actingUserId
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (entriesToCreate.length > 0) {
    await tx.ledgerEntry.createMany({
      data: entriesToCreate
    });
  }
}

async function replaceSeasonNflLedgerEntriesForSeasonTx(
  tx: PrismaClientLike,
  input: ReplaceSeasonNflLedgerEntriesInput
) {
  await tx.ledgerEntry.deleteMany({
    where: {
      seasonId: input.seasonId,
      category: {
        in: ["NFL_REGULAR_SEASON", "NFL_PLAYOFF"]
      }
    }
  });

  const entriesToCreate = input.ownerEntries.flatMap((ownerEntry) => {
    const entries: Array<{
      leagueId: string;
      seasonId: string;
      leagueMemberId: string;
      category: "NFL_REGULAR_SEASON" | "NFL_PLAYOFF";
      amount: Prisma.Decimal;
      description: string;
      metadata: Prisma.InputJsonValue;
      actingUserId: string;
    }> = [];

    if (ownerEntry.regularSeasonAmount !== 0) {
      entries.push({
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        leagueMemberId: ownerEntry.leagueMemberId,
        category: "NFL_REGULAR_SEASON",
        amount: new Prisma.Decimal(ownerEntry.regularSeasonAmount.toFixed(2)),
        description: `NFL regular season posting for ${ownerEntry.displayName}`,
        metadata: {
          source: "SEASON_NFL_RESULTS",
          wins: ownerEntry.regularSeasonWins,
          ownedTeamIds: ownerEntry.ownedTeamIds
        } as Prisma.InputJsonValue,
        actingUserId: input.actingUserId
      });
    }

    if (ownerEntry.playoffAmount !== 0) {
      entries.push({
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        leagueMemberId: ownerEntry.leagueMemberId,
        category: "NFL_PLAYOFF",
        amount: new Prisma.Decimal(ownerEntry.playoffAmount.toFixed(2)),
        description: `NFL playoff posting for ${ownerEntry.displayName}`,
        metadata: {
          source: "SEASON_NFL_RESULTS",
          wins: ownerEntry.playoffWins,
          ownedTeamIds: ownerEntry.ownedTeamIds
        } as Prisma.InputJsonValue,
        actingUserId: input.actingUserId
      });
    }

    return entries;
  });

  if (entriesToCreate.length > 0) {
    await tx.ledgerEntry.createMany({
      data: entriesToCreate
    });
  }
}

export const ledgerService = {
  async getSeasonLedgerSummary(seasonId: string, actingUserId: string): Promise<SeasonLedgerSummary> {
    const { season } = await assertViewerMembershipForSeason(prisma, seasonId, actingUserId);
    const entries = await getSeasonEntries(prisma, season.id);
    const mappedEntries = entries.map(mapEntry);

    return {
      season: mapSeason(season),
      balances: buildBalances(season.league.members, entries),
      entries: mappedEntries,
      totals: buildSeasonTotals(entries)
    };
  },

  async getLeagueSeasonBalances(seasonId: string, actingUserId: string) {
    const summary = await this.getSeasonLedgerSummary(seasonId, actingUserId);
    return summary.balances;
  },

  async getSeasonLedgerTotalsForDraftOrder(seasonId: string) {
    const season = await getSeasonContextOrThrow(prisma, seasonId);
    const entries = await getSeasonEntries(prisma, season.id);
    const balances = buildBalances(season.league.members, entries);

    return {
      season: mapSeason(season),
      hasAnyEntries: entries.length > 0,
      totals: balances.map((balance) => ({
        leagueMemberId: balance.leagueMemberId,
        userId: balance.userId,
        displayName: balance.displayName,
        email: balance.email,
        role: balance.role,
        ledgerTotal: balance.totalBalance,
        entryCount: balance.entryCount
      }))
    };
  },

  async getOwnerFinancialHistory(userId: string) {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      throw new LedgerServiceError("userId is required.", 400);
    }

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        leagueMember: {
          userId: normalizedUserId
        }
      },
      select: {
        id: true,
        seasonId: true,
        amount: true,
        season: {
          select: {
            id: true,
            year: true,
            name: true,
            leagueId: true,
            league: {
              select: {
                name: true,
                leagueCode: true
              }
            }
          }
        }
      },
      orderBy: [{ season: { year: "desc" } }, { createdAt: "desc" }, { id: "desc" }]
    });

    const rollups = new Map<
      string,
      {
        leagueId: string;
        leagueCode: string | null;
        leagueName: string;
        seasonId: string;
        seasonYear: number;
        seasonName: string | null;
        entryCount: number;
        totalPositive: number;
        totalNegative: number;
        ledgerTotal: number;
      }
    >();

    for (const entry of entries) {
      const current = rollups.get(entry.seasonId) ?? {
        leagueId: entry.season.leagueId,
        leagueCode: entry.season.league.leagueCode,
        leagueName: entry.season.league.name,
        seasonId: entry.season.id,
        seasonYear: entry.season.year,
        seasonName: entry.season.name,
        entryCount: 0,
        totalPositive: 0,
        totalNegative: 0,
        ledgerTotal: 0
      };
      const amount = decimalToNumber(entry.amount);

      current.entryCount += 1;
      current.ledgerTotal = Number((current.ledgerTotal + amount).toFixed(2));
      current.totalPositive = Number((current.totalPositive + (amount > 0 ? amount : 0)).toFixed(2));
      current.totalNegative = Number((current.totalNegative + (amount < 0 ? amount : 0)).toFixed(2));

      rollups.set(entry.seasonId, current);
    }

    return Array.from(rollups.values()).sort((left, right) => {
      if (right.seasonYear !== left.seasonYear) {
        return right.seasonYear - left.seasonYear;
      }

      return left.leagueName.localeCompare(right.leagueName);
    });
  },

  async getLeagueMemberSeasonLedger(
    seasonId: string,
    leagueMemberId: string,
    actingUserId: string
  ): Promise<LeagueMemberSeasonLedger> {
    const { season } = await assertViewerMembershipForSeason(prisma, seasonId, actingUserId);
    const normalizedLeagueMemberId = leagueMemberId.trim();

    if (!normalizedLeagueMemberId) {
      throw new LedgerServiceError("leagueMemberId is required.", 400);
    }

    const member = season.league.members.find((entry) => entry.id === normalizedLeagueMemberId) ?? null;

    if (!member) {
      throw new LedgerServiceError("League member not found for this season.", 404);
    }

    const entries = await getSeasonEntries(prisma, season.id, normalizedLeagueMemberId);
    const balances = buildBalances([member], entries);

    return {
      season: mapSeason(season),
      member: balances[0],
      entries: entries.map(mapEntry),
      totals: buildSeasonTotals(entries)
    };
  },

  async createManualAdjustment(input: CreateManualAdjustmentInput) {
    const seasonId = input.seasonId.trim();
    const leagueMemberId = input.leagueMemberId.trim();
    const description = input.description.trim();
    const actingUserId = input.actingUserId.trim();
    const amount = normalizeAmount(input.amount);

    if (!seasonId || !leagueMemberId || !description || !actingUserId) {
      throw new LedgerServiceError("seasonId, leagueMemberId, description, and actingUserId are required.", 400);
    }

    await seasonService.assertCommissionerAccess(seasonId, actingUserId);

    return prisma.$transaction(async (tx) => {
      const season = await getSeasonContextOrThrow(tx, seasonId);
      const member = season.league.members.find((entry) => entry.id === leagueMemberId) ?? null;

      if (!member) {
        throw new LedgerServiceError("League member not found for this season.", 404);
      }

      const createdEntry = await tx.ledgerEntry.create({
        data: {
          leagueId: season.leagueId,
          seasonId: season.id,
          leagueMemberId,
          category: "MANUAL_ADJUSTMENT",
          amount: new Prisma.Decimal(amount.toFixed(2)),
          description,
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          actingUserId
        },
        include: {
          leagueMember: {
            include: {
              user: true
            }
          }
        }
      });

      const entries = await getSeasonEntries(tx, season.id);

      return {
        createdEntry: mapEntry(createdEntry),
        ledger: {
          season: mapSeason(season),
          balances: buildBalances(season.league.members, entries),
          entries: entries.map(mapEntry),
          totals: buildSeasonTotals(entries)
        }
      };
    });
  },

  async replaceFantasyPayoutEntriesForSeason(input: ReplaceFantasyPayoutEntriesInput) {
    const normalizedSeasonId = input.seasonId.trim();
    const normalizedLeagueId = input.leagueId.trim();
    const normalizedActingUserId = input.actingUserId.trim();

    if (!normalizedSeasonId || !normalizedLeagueId || !normalizedActingUserId) {
      throw new LedgerServiceError("seasonId, leagueId, and actingUserId are required.", 400);
    }

    return prisma.$transaction(async (tx) =>
      replaceFantasyPayoutEntriesForSeasonTx(tx, {
        ...input,
        seasonId: normalizedSeasonId,
        leagueId: normalizedLeagueId,
        actingUserId: normalizedActingUserId
      })
    );
  }
};

export { replaceFantasyPayoutEntriesForSeasonTx };
export { replaceSeasonNflLedgerEntriesForSeasonTx };
export { LedgerServiceError };
