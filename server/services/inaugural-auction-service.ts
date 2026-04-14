import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { seasonService } from "@/server/services/season-service";
import type {
  InauguralAuctionBidSummary,
  InauguralAuctionFinalSummary,
  InauguralAuctionOrderMethod,
  InauguralAuctionOwnerSummary,
  InauguralAuctionState,
  ConfigureInauguralAuctionInput,
  StartInauguralAuctionInput,
  SubmitInauguralBidInput
} from "@/types/inaugural-auction";

const AUCTION_BUDGET = 100;
const REQUIRED_TEAMS_PER_OWNER = 3;
const REQUIRED_OWNER_COUNT = 10;
const REQUIRED_AWARDED_TEAMS = 30;
const MAX_SINGLE_BID = 98;
const NOMINATION_CLOCK_SECONDS = 60;
const FINAL_TEN_SECONDS_EXTENSION = 10;
const AWARD_CELEBRATION_SECONDS = 7;

class InauguralAuctionServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "InauguralAuctionServiceError";
  }
}

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function mapDraftTeam(team: {
  id: string;
  name: string;
  abbreviation: string;
  conference: "AFC" | "NFC";
  division: string;
}) {
  return {
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    conference: team.conference,
    division: team.division
  };
}

function getDivisionKey(team: { conference: "AFC" | "NFC"; division: string }) {
  return `${team.conference} ${team.division}`;
}

function getMaxAllowedBid(teamCount: number, budgetRemaining: number) {
  if (teamCount >= REQUIRED_TEAMS_PER_OWNER) {
    return 0;
  }

  const remainingRequiredSlotsAfterPurchase = REQUIRED_TEAMS_PER_OWNER - (teamCount + 1);
  const affordableCap = budgetRemaining - remainingRequiredSlotsAfterPurchase;

  return Math.max(0, Math.min(MAX_SINGLE_BID, affordableCap));
}

function resolveWinningBid<T extends { amount: number; createdAt: Date; id: string }>(bids: T[]) {
  return [...bids].sort((left, right) => {
    if (right.amount !== left.amount) {
      return right.amount - left.amount;
    }

    if (right.createdAt.getTime() !== left.createdAt.getTime()) {
      return right.createdAt.getTime() - left.createdAt.getTime();
    }

    return right.id.localeCompare(left.id);
  })[0] ?? null;
}

async function assertInauguralAuctionSeason(tx: PrismaClientLike, seasonId: string) {
  const season = await tx.season.findUnique({
    where: {
      id: seasonId
    },
    select: {
      id: true,
      leagueId: true,
      year: true,
      name: true,
      status: true,
      leaguePhase: true,
      draftMode: true,
      isLocked: true,
      league: {
        select: {
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              joinedAt: true,
              user: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  profileImageUrl: true
                }
              }
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
          }
        }
      },
      teamOwnerships: {
        select: {
          id: true
        }
      }
    }
  });

  if (!season) {
    throw new InauguralAuctionServiceError("Season not found.", 404);
  }

  if (season.draftMode !== "INAUGURAL_AUCTION") {
    throw new InauguralAuctionServiceError("This season is not configured for the inaugural auction flow.", 409);
  }

  return season;
}

async function getAuctionWithContext(tx: PrismaClientLike, seasonId: string) {
  return tx.inauguralAuction.findUnique({
    where: {
      seasonId
    },
    include: {
      season: {
        select: {
          id: true,
          leagueId: true,
          year: true,
          name: true,
          status: true,
          leaguePhase: true,
          draftMode: true,
          isLocked: true,
          teamOwnerships: {
            select: {
              id: true,
              nflTeamId: true,
              leagueMemberId: true,
              slot: true
            }
          },
          league: {
            select: {
              members: {
                select: {
                  id: true,
                  userId: true,
                  role: true,
                  joinedAt: true,
                  user: {
                    select: {
                      displayName: true,
                      email: true,
                      profileImageUrl: true
                    }
                  }
                },
                orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
              }
            }
          }
        }
      },
      nominationEntries: {
        include: {
          nflTeam: true,
          bids: {
            include: {
              leagueMember: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ amount: "desc" }, { createdAt: "desc" }]
          },
          award: {
            include: {
              leagueMember: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy: {
          orderIndex: "asc"
        }
      },
      awards: {
        include: {
          nomination: {
            include: {
              nflTeam: true
            }
          },
          leagueMember: {
            include: {
              user: true
            }
          }
        },
        orderBy: [{ awardedAt: "asc" }, { createdAt: "asc" }]
      }
    }
  });
}

async function buildOrder(
  tx: PrismaClientLike,
  seasonYear: number,
  orderMethod: InauguralAuctionOrderMethod,
  divisionOrder: string[] | undefined
) {
  const teams = await tx.nFLTeam.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ conference: "asc" }, { division: "asc" }, { name: "asc" }]
  });

  if (teams.length !== 32) {
    throw new InauguralAuctionServiceError("The inaugural auction requires exactly 32 active NFL teams.", 409);
  }

  if (orderMethod === "ALPHABETICAL") {
    return {
      teams: [...teams].sort((left, right) => left.name.localeCompare(right.name)),
      notes: ["Alphabetical nomination order is active."]
    };
  }

  if (orderMethod === "DIVISION") {
    const availableDivisions = Array.from(new Set(teams.map(getDivisionKey))).sort((left, right) =>
      left.localeCompare(right)
    );

    if (!divisionOrder || divisionOrder.length !== availableDivisions.length) {
      throw new InauguralAuctionServiceError("Division order must include each NFL division exactly once.", 400);
    }

    if (new Set(divisionOrder).size !== availableDivisions.length) {
      throw new InauguralAuctionServiceError("Division order contains duplicate divisions.", 400);
    }

    if (divisionOrder.some((division) => !availableDivisions.includes(division))) {
      throw new InauguralAuctionServiceError("Division order contains an unknown NFL division.", 400);
    }

    const groupedTeams = new Map<string, typeof teams>();

    for (const team of teams) {
      const divisionKey = getDivisionKey(team);
      const bucket = groupedTeams.get(divisionKey) ?? [];
      bucket.push(team);
      groupedTeams.set(divisionKey, bucket);
    }

    return {
      teams: divisionOrder.flatMap((division) =>
        [...(groupedTeams.get(division) ?? [])].sort((left, right) => left.name.localeCompare(right.name))
      ),
      notes: [`Division nomination order is active: ${divisionOrder.join(" -> ")}.`]
    };
  }

  const priorYearResults = await tx.seasonNflTeamResult.findMany({
    where: {
      seasonYear: seasonYear - 1,
      phase: "REGULAR_SEASON"
    },
    select: {
      nflTeamId: true,
      result: true
    }
  });

  const recordMap = new Map<string, { wins: number; losses: number; ties: number }>();

  for (const result of priorYearResults) {
    const current = recordMap.get(result.nflTeamId) ?? { wins: 0, losses: 0, ties: 0 };

    if (result.result === "WIN") {
      current.wins += 1;
    } else if (result.result === "LOSS") {
      current.losses += 1;
    } else {
      current.ties += 1;
    }

    recordMap.set(result.nflTeamId, current);
  }

  if (recordMap.size !== teams.length) {
    return {
      teams: [...teams].sort((left, right) => left.name.localeCompare(right.name)),
      notes: [
        "Previous-year NFL results were incomplete, so the inaugural auction fell back to alphabetical nomination order."
      ]
    };
  }

  return {
    teams: [...teams].sort((left, right) => {
      const leftRecord = recordMap.get(left.id)!;
      const rightRecord = recordMap.get(right.id)!;

      if (rightRecord.wins !== leftRecord.wins) {
        return rightRecord.wins - leftRecord.wins;
      }

      if (leftRecord.losses !== rightRecord.losses) {
        return leftRecord.losses - rightRecord.losses;
      }

      if (rightRecord.ties !== leftRecord.ties) {
        return rightRecord.ties - leftRecord.ties;
      }

      return left.name.localeCompare(right.name);
    }),
    notes: [
      "Previous-year NFL nomination order is active, sorted by regular-season wins descending, losses ascending, ties descending, then team name."
    ]
  };
}

function buildOwnerSummaries(auction: NonNullable<Awaited<ReturnType<typeof getAuctionWithContext>>>) {
  const awardedTeamsByMemberId = new Map<string, ReturnType<typeof mapDraftTeam>[]>();
  const spentByMemberId = new Map<string, number>();

  for (const award of auction.awards) {
    const bucket = awardedTeamsByMemberId.get(award.leagueMemberId) ?? [];
    bucket.push(mapDraftTeam(award.nomination.nflTeam));
    awardedTeamsByMemberId.set(award.leagueMemberId, bucket);
    spentByMemberId.set(award.leagueMemberId, (spentByMemberId.get(award.leagueMemberId) ?? 0) + award.amount);
  }

  const owners: InauguralAuctionOwnerSummary[] = auction.season.league.members.map((member) => {
    const awardedTeams = awardedTeamsByMemberId.get(member.id) ?? [];
    const budgetSpent = spentByMemberId.get(member.id) ?? 0;
    const budgetRemaining = AUCTION_BUDGET - budgetSpent;
    const maxAllowedBid = getMaxAllowedBid(awardedTeams.length, budgetRemaining);

    return {
      leagueMemberId: member.id,
      userId: member.userId,
      displayName: member.user.displayName,
      email: member.user.email,
      profileImageUrl: member.user.profileImageUrl ?? null,
      role: member.role,
      teamCount: awardedTeams.length,
      budgetSpent,
      budgetRemaining,
      isComplete: awardedTeams.length >= REQUIRED_TEAMS_PER_OWNER,
      awardedTeams,
      maxAllowedBid,
      canBid:
        auction.status === "ACTIVE" &&
        !auction.announcementEndsAt &&
        awardedTeams.length < REQUIRED_TEAMS_PER_OWNER &&
        maxAllowedBid >= 1
    };
  });

  return owners;
}

async function finalizeAuctionIfComplete(
  tx: PrismaClientLike,
  auction: NonNullable<Awaited<ReturnType<typeof getAuctionWithContext>>>,
  finalAwardId: string | null,
  now: Date
) {
  const owners = buildOwnerSummaries(auction);

  if (auction.awards.length !== REQUIRED_AWARDED_TEAMS) {
    throw new InauguralAuctionServiceError("The inaugural auction cannot finalize until 30 teams have been awarded.", 409);
  }

  if (owners.some((owner) => owner.teamCount !== REQUIRED_TEAMS_PER_OWNER)) {
    throw new InauguralAuctionServiceError("Every owner must finish the inaugural auction with exactly 3 teams.", 409);
  }

  const allActiveTeams = await tx.nFLTeam.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true
    }
  });

  if (allActiveTeams.length !== 32) {
    throw new InauguralAuctionServiceError("The inaugural auction requires exactly 32 active NFL teams.", 409);
  }

  const awardedTeamIds = new Set(auction.awards.map((award) => award.nomination.nflTeamId));

  if (allActiveTeams.length - awardedTeamIds.size !== 2) {
    throw new InauguralAuctionServiceError("Exactly 2 NFL teams must remain unassigned when the inaugural auction completes.", 409);
  }

  if (auction.season.teamOwnerships.length > 0) {
    throw new InauguralAuctionServiceError("Target season already has ownership records.", 409);
  }

  await tx.teamOwnership.createMany({
    data: owners.flatMap((owner) =>
      owner.awardedTeams.map((team, index) => ({
        seasonId: auction.seasonId,
        leagueMemberId: owner.leagueMemberId,
        nflTeamId: team.id,
        slot: index + 1
      }))
    )
  });

  await tx.inauguralAuction.update({
    where: {
      id: auction.id
    },
    data: {
      status: "COMPLETED",
      completedAt: now,
      announcementAwardId: finalAwardId,
      announcementEndsAt: finalAwardId ? addSeconds(now, AWARD_CELEBRATION_SECONDS) : null,
      clockStartedAt: null,
      clockExpiresAt: null
    }
  });
}

async function awardNomination(
  tx: PrismaClientLike,
  auction: NonNullable<Awaited<ReturnType<typeof getAuctionWithContext>>>,
  nominationId: string,
  leagueMemberId: string,
  amount: number,
  now: Date
) {
  const award = await tx.inauguralAuctionAward.create({
    data: {
      auctionId: auction.id,
      nominationId,
      leagueMemberId,
      amount,
      awardedAt: now
    },
    select: {
      id: true
    }
  });

  const auctionAfterAward = await getAuctionWithContext(tx, auction.seasonId);

  if (!auctionAfterAward) {
    throw new InauguralAuctionServiceError("Auction not found after award.", 404);
  }

  if (auctionAfterAward.awards.length >= REQUIRED_AWARDED_TEAMS) {
    await finalizeAuctionIfComplete(tx, auctionAfterAward, award.id, now);
    return;
  }

  await tx.inauguralAuction.update({
    where: {
      id: auction.id
    },
    data: {
      announcementAwardId: award.id,
      announcementEndsAt: addSeconds(now, AWARD_CELEBRATION_SECONDS),
      clockStartedAt: null,
      clockExpiresAt: null
    }
  });
}

async function syncAuctionProgress(tx: PrismaClientLike, seasonId: string) {
  const auction = await getAuctionWithContext(tx, seasonId);

  if (!auction || auction.status !== "ACTIVE") {
    return;
  }

  const now = new Date();

  if (auction.announcementEndsAt) {
    if (auction.announcementEndsAt > now) {
      return;
    }

    const nextNominationIndex = auction.currentNominationIndex + 1;

    await tx.inauguralAuction.update({
      where: {
        id: auction.id
      },
      data: {
        currentNominationIndex: nextNominationIndex,
        announcementAwardId: null,
        announcementEndsAt: null,
        clockStartedAt: now,
        clockExpiresAt: addSeconds(now, NOMINATION_CLOCK_SECONDS)
      }
    });

    return;
  }

  if (!auction.clockExpiresAt || auction.clockExpiresAt > now) {
    return;
  }

  const activeNomination = auction.nominationEntries.find((entry) => entry.orderIndex === auction.currentNominationIndex) ?? null;

  if (!activeNomination || activeNomination.award) {
    return;
  }

  const winningBid = resolveWinningBid(
    activeNomination.bids.filter((bid) => bid.createdAt.getTime() <= auction.clockExpiresAt!.getTime())
  );

  if (!winningBid) {
    await tx.inauguralAuction.update({
      where: {
        id: auction.id
      },
      data: {
        clockStartedAt: now,
        clockExpiresAt: addSeconds(now, NOMINATION_CLOCK_SECONDS)
      }
    });

    return;
  }

  await awardNomination(tx, auction, activeNomination.id, winningBid.leagueMemberId, winningBid.amount, now);
}

async function buildAuctionState(
  tx: PrismaClientLike,
  seasonId: string,
  actingUserId: string
): Promise<InauguralAuctionState | null> {
  const auction = await getAuctionWithContext(tx, seasonId);

  if (!auction) {
    return null;
  }

  const owners = buildOwnerSummaries(auction);
  const viewerMembership = auction.season.league.members.find((member) => member.userId === actingUserId) ?? null;
  const viewerOwner = viewerMembership ? owners.find((owner) => owner.leagueMemberId === viewerMembership.id) ?? null : null;
  const activeNomination =
    !auction.announcementEndsAt && auction.status === "ACTIVE"
      ? auction.nominationEntries.find((entry) => entry.orderIndex === auction.currentNominationIndex && !entry.award) ?? null
      : null;
  const currentHighBid = activeNomination
    ? resolveWinningBid(
        activeNomination.bids.map((bid) => ({
          id: bid.id,
          amount: bid.amount,
          createdAt: bid.createdAt,
          leagueMemberId: bid.leagueMemberId,
          displayName: bid.leagueMember.user.displayName,
          profileImageUrl: bid.leagueMember.user.profileImageUrl ?? null
        }))
      )
    : null;
  const recentBids: InauguralAuctionBidSummary[] = activeNomination
    ? [...activeNomination.bids]
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, 10)
        .map((bid) => ({
          id: bid.id,
          leagueMemberId: bid.leagueMemberId,
          displayName: bid.leagueMember.user.displayName,
          profileImageUrl: bid.leagueMember.user.profileImageUrl ?? null,
          amount: bid.amount,
          createdAt: bid.createdAt.toISOString()
        }))
    : [];
  const announcementIsVisible =
    Boolean(auction.announcementEndsAt && auction.announcementEndsAt.getTime() > Date.now());
  const activeAward =
    auction.announcementAwardId && announcementIsVisible
      ? auction.awards.find((award) => award.id === auction.announcementAwardId) ?? null
      : null;
  const allAwardedTeamIds = new Set(auction.awards.map((award) => award.nomination.nflTeamId));
  const biggestSpenderOwner =
    owners.length > 0
      ? [...owners].sort((left, right) => right.budgetSpent - left.budgetSpent || left.displayName.localeCompare(right.displayName))[0]
      : null;
  const lowestSpenderOwner =
    owners.length > 0
      ? [...owners].sort((left, right) => left.budgetSpent - right.budgetSpent || left.displayName.localeCompare(right.displayName))[0]
      : null;
  const finalSummary: InauguralAuctionFinalSummary | null =
    auction.status === "COMPLETED"
      ? {
          biggestSpender: biggestSpenderOwner
            ? {
                leagueMemberId: biggestSpenderOwner.leagueMemberId,
                displayName: biggestSpenderOwner.displayName,
                amount: biggestSpenderOwner.budgetSpent
              }
            : null,
          lowestSpender: lowestSpenderOwner
            ? {
                leagueMemberId: lowestSpenderOwner.leagueMemberId,
                displayName: lowestSpenderOwner.displayName,
                amount: lowestSpenderOwner.budgetSpent
              }
            : null,
          remainingBudgets: owners
            .map((owner) => ({
              leagueMemberId: owner.leagueMemberId,
              displayName: owner.displayName,
              budgetRemaining: owner.budgetRemaining
            }))
            .sort((left, right) => right.budgetRemaining - left.budgetRemaining || left.displayName.localeCompare(right.displayName)),
          owners: owners.map((owner) => ({
            leagueMemberId: owner.leagueMemberId,
            displayName: owner.displayName,
            budgetSpent: owner.budgetSpent,
            budgetRemaining: owner.budgetRemaining,
            teams: owner.awardedTeams
          })),
          unassignedTeams: auction.nominationEntries
            .filter((entry) => !allAwardedTeamIds.has(entry.nflTeamId))
            .map((entry) => mapDraftTeam(entry.nflTeam))
            .sort((left, right) => left.name.localeCompare(right.name)),
          awardsByDivision: Array.from(
            auction.awards.reduce((map, award) => {
              const key = getDivisionKey(award.nomination.nflTeam);
              map.set(key, (map.get(key) ?? 0) + 1);
              return map;
            }, new Map<string, number>())
          )
            .map(([division, awardedCount]) => ({ division, awardedCount }))
            .sort((left, right) => right.awardedCount - left.awardedCount || left.division.localeCompare(right.division))
        }
      : null;

  return {
    auction: {
      id: auction.id,
      seasonId: auction.seasonId,
      leagueId: auction.leagueId,
      status: auction.status,
      orderMethod: auction.orderMethod,
      currentNominationIndex: auction.currentNominationIndex,
      nominationCount: auction.nominationEntries.length,
      awardedCount: auction.awards.length,
      announcementEndsAt: auction.announcementEndsAt?.toISOString() ?? null,
      completedAt: auction.completedAt?.toISOString() ?? null
    },
    orderNotes:
      auction.orderMethod === "DIVISION"
        ? ["Division-mode ordering is active. Teams inside each division run alphabetically by NFL team name."]
        : [],
    currentNomination: activeNomination
      ? {
          id: activeNomination.id,
          nflTeam: mapDraftTeam(activeNomination.nflTeam),
          orderIndex: activeNomination.orderIndex,
          isAwarded: Boolean(activeNomination.award),
          awardedToLeagueMemberId: activeNomination.award?.leagueMemberId ?? null
        }
      : null,
    currentHighBid: currentHighBid
      ? {
          id: currentHighBid.id,
          leagueMemberId: currentHighBid.leagueMemberId,
          displayName: currentHighBid.displayName,
          profileImageUrl: currentHighBid.profileImageUrl,
          amount: currentHighBid.amount,
          createdAt: currentHighBid.createdAt.toISOString()
        }
      : null,
    recentBids,
    nominations: auction.nominationEntries.map((entry) => ({
      id: entry.id,
      nflTeam: mapDraftTeam(entry.nflTeam),
      orderIndex: entry.orderIndex,
      isAwarded: Boolean(entry.award),
      awardedToLeagueMemberId: entry.award?.leagueMemberId ?? null
    })),
    owners,
    countdown:
      auction.status === "ACTIVE" && !auction.announcementEndsAt
        ? {
            startedAt: auction.clockStartedAt?.toISOString() ?? null,
            expiresAt: auction.clockExpiresAt?.toISOString() ?? null,
            secondsRemaining: auction.clockExpiresAt
              ? Math.max(0, Math.ceil((auction.clockExpiresAt.getTime() - Date.now()) / 1000))
              : 0,
            isExtendedWindow:
              Boolean(auction.clockStartedAt && auction.clockExpiresAt) &&
              auction.clockExpiresAt!.getTime() - auction.clockStartedAt!.getTime() > NOMINATION_CLOCK_SECONDS * 1000
          }
        : null,
    activeAward: activeAward
      ? {
          id: activeAward.id,
          nominationId: activeAward.nominationId,
          leagueMemberId: activeAward.leagueMemberId,
          displayName: activeAward.leagueMember.user.displayName,
          profileImageUrl: activeAward.leagueMember.user.profileImageUrl ?? null,
          nflTeam: mapDraftTeam(activeAward.nomination.nflTeam),
          amount: activeAward.amount,
          awardedAt: activeAward.awardedAt.toISOString()
        }
      : null,
    finalSummary,
    viewer: {
      leagueMemberId: viewerMembership?.id ?? null,
      role: viewerMembership?.role ?? null,
      canManageAuction: viewerMembership?.role === "COMMISSIONER",
      canBid:
        Boolean(viewerOwner) &&
        auction.status === "ACTIVE" &&
        !auction.announcementEndsAt &&
        viewerOwner!.teamCount < REQUIRED_TEAMS_PER_OWNER &&
        viewerOwner!.maxAllowedBid >= 1,
      budgetRemaining: viewerOwner?.budgetRemaining ?? null,
      teamCount: viewerOwner?.teamCount ?? null,
      maxAllowedBid: viewerOwner?.maxAllowedBid ?? null
    }
  };
}

export const inauguralAuctionService = {
  async getAuctionStateBySeason(seasonId: string, actingUserId: string) {
    const normalizedSeasonId = seasonId.trim();
    const normalizedActingUserId = actingUserId.trim();

    if (!normalizedSeasonId || !normalizedActingUserId) {
      throw new InauguralAuctionServiceError("seasonId and actingUserId are required.", 400);
    }

    await assertInauguralAuctionSeason(prisma, normalizedSeasonId);

    return prisma.$transaction(async (tx) => {
      await syncAuctionProgress(tx, normalizedSeasonId);
      return buildAuctionState(tx, normalizedSeasonId, normalizedActingUserId);
    });
  },

  async configureAuction(input: ConfigureInauguralAuctionInput) {
    const seasonId = input.seasonId.trim();
    const actingUserId = input.actingUserId.trim();

    if (!seasonId || !actingUserId) {
      throw new InauguralAuctionServiceError("seasonId and actingUserId are required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      await seasonService.assertCommissionerAccess(seasonId, actingUserId);
      const season = await assertInauguralAuctionSeason(tx, seasonId);

      if (season.isLocked) {
        throw new InauguralAuctionServiceError("Unlock the season before configuring the inaugural auction.", 409);
      }

      if (season.leaguePhase !== "DRAFT_PHASE") {
        throw new InauguralAuctionServiceError(
          `Inaugural auction setup is only available during DRAFT_PHASE. Current phase: ${season.leaguePhase}.`,
          409
        );
      }

      if (season.league.members.length !== REQUIRED_OWNER_COUNT) {
        throw new InauguralAuctionServiceError("The inaugural auction requires exactly 10 league members.", 409);
      }

      if (season.teamOwnerships.length > 0) {
        throw new InauguralAuctionServiceError("This season already has ownership records and can no longer run the inaugural auction.", 409);
      }

      const existingAuction = await tx.inauguralAuction.findUnique({
        where: {
          seasonId
        },
        include: {
          awards: {
            select: {
              id: true
            }
          }
        }
      });

      if (existingAuction && existingAuction.status !== "PLANNING") {
        throw new InauguralAuctionServiceError("The inaugural auction order can only be reconfigured before the auction starts.", 409);
      }

      if (existingAuction && existingAuction.awards.length > 0) {
        throw new InauguralAuctionServiceError("The inaugural auction order cannot change after teams have already been awarded.", 409);
      }

      const builtOrder = await buildOrder(tx, season.year, input.orderMethod, input.divisionOrder);

      if (existingAuction) {
        await tx.inauguralAuction.delete({
          where: {
            id: existingAuction.id
          }
        });
      }

      await tx.inauguralAuction.create({
        data: {
          leagueId: season.leagueId,
          seasonId: season.id,
          orderMethod: input.orderMethod,
          status: "PLANNING",
          currentNominationIndex: 0,
          nominationEntries: {
            create: builtOrder.teams.map((team, index) => ({
              nflTeamId: team.id,
              orderIndex: index
            }))
          }
        }
      });

      return (await buildAuctionState(tx, season.id, actingUserId))!;
    });
  },

  async startAuction(input: StartInauguralAuctionInput) {
    const seasonId = input.seasonId.trim();
    const actingUserId = input.actingUserId.trim();

    if (!seasonId || !actingUserId) {
      throw new InauguralAuctionServiceError("seasonId and actingUserId are required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      await seasonService.assertCommissionerAccess(seasonId, actingUserId);
      const season = await assertInauguralAuctionSeason(tx, seasonId);
      const auction = await getAuctionWithContext(tx, seasonId);

      if (!auction) {
        throw new InauguralAuctionServiceError("Configure the inaugural auction order before starting.", 409);
      }

      if (auction.status !== "PLANNING") {
        throw new InauguralAuctionServiceError("Only a planning inaugural auction can be started.", 409);
      }

      if (season.isLocked) {
        throw new InauguralAuctionServiceError("Unlock the season before starting the inaugural auction.", 409);
      }

      const now = new Date();

      await tx.inauguralAuction.update({
        where: {
          id: auction.id
        },
        data: {
          status: "ACTIVE",
          currentNominationIndex: 0,
          clockStartedAt: now,
          clockExpiresAt: addSeconds(now, NOMINATION_CLOCK_SECONDS),
          announcementAwardId: null,
          announcementEndsAt: null
        }
      });

      return (await buildAuctionState(tx, seasonId, actingUserId))!;
    });
  },

  async submitBid(input: SubmitInauguralBidInput) {
    const seasonId = input.seasonId.trim();
    const actingUserId = input.actingUserId.trim();

    if (!seasonId || !actingUserId) {
      throw new InauguralAuctionServiceError("seasonId and actingUserId are required.", 400);
    }

    return prisma.$transaction(async (tx) => {
      await assertInauguralAuctionSeason(tx, seasonId);
      await syncAuctionProgress(tx, seasonId);
      const auction = await getAuctionWithContext(tx, seasonId);

      if (!auction) {
        throw new InauguralAuctionServiceError("Configure the inaugural auction before bidding.", 409);
      }

      if (auction.status !== "ACTIVE") {
        throw new InauguralAuctionServiceError("Bids can only be submitted while the inaugural auction is active.", 409);
      }

      if (auction.announcementEndsAt) {
        throw new InauguralAuctionServiceError("Wait for the current team award to finish before bidding on the next team.", 409);
      }

      const viewerMembership = auction.season.league.members.find((member) => member.userId === actingUserId) ?? null;

      if (!viewerMembership) {
        throw new InauguralAuctionServiceError("Only league members for this season can bid in the inaugural auction.", 403);
      }

      const owners = buildOwnerSummaries(auction);
      const owner = owners.find((entry) => entry.leagueMemberId === viewerMembership.id) ?? null;

      if (!owner) {
        throw new InauguralAuctionServiceError("Auction owner context not found.", 404);
      }

      if (owner.teamCount >= REQUIRED_TEAMS_PER_OWNER) {
        throw new InauguralAuctionServiceError("Owners with 3 awarded teams are done bidding for the inaugural auction.", 409);
      }

      const amount = Math.floor(Number(input.amount));

      if (!Number.isFinite(amount) || amount < 1) {
        throw new InauguralAuctionServiceError("Inaugural auction bids must be at least $1.", 400);
      }

      if (amount > MAX_SINGLE_BID) {
        throw new InauguralAuctionServiceError("A single inaugural auction bid cannot exceed $98.", 400);
      }

      if (amount > owner.maxAllowedBid) {
        throw new InauguralAuctionServiceError(
          "That bid would leave too little budget to finish with exactly 3 teams.",
          409
        );
      }

      const activeNomination = auction.nominationEntries.find((entry) => entry.orderIndex === auction.currentNominationIndex && !entry.award) ?? null;

      if (!activeNomination) {
        throw new InauguralAuctionServiceError("No active inaugural auction team is currently on the clock.", 409);
      }

      const currentHighBid = resolveWinningBid(activeNomination.bids);
      const minimumNextBid = Math.max(1, (currentHighBid?.amount ?? 0) + 1);

      if (amount < minimumNextBid) {
        throw new InauguralAuctionServiceError(`Bids must be at least $${minimumNextBid}.`, 409);
      }

      const now = new Date();

      await tx.inauguralAuctionBid.create({
        data: {
          auctionId: auction.id,
          nominationId: activeNomination.id,
          leagueMemberId: viewerMembership.id,
          amount
        }
      });

      if (amount === MAX_SINGLE_BID) {
        const refreshedAuction = await getAuctionWithContext(tx, seasonId);

        if (!refreshedAuction) {
          throw new InauguralAuctionServiceError("Auction not found after recording the bid.", 404);
        }

        await awardNomination(tx, refreshedAuction, activeNomination.id, viewerMembership.id, amount, now);

        return (await buildAuctionState(tx, seasonId, actingUserId))!;
      }

      if (
        auction.clockExpiresAt &&
        auction.clockExpiresAt.getTime() - now.getTime() <= FINAL_TEN_SECONDS_EXTENSION * 1000
      ) {
        await tx.inauguralAuction.update({
          where: {
            id: auction.id
          },
          data: {
            clockExpiresAt: addSeconds(auction.clockExpiresAt, FINAL_TEN_SECONDS_EXTENSION)
          }
        });
      }

      return (await buildAuctionState(tx, seasonId, actingUserId))!;
    });
  }
};

export { InauguralAuctionServiceError };
