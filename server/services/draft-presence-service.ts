import { prisma } from "@/lib/prisma";

export class DraftPresenceServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = "DraftPresenceServiceError";
  }
}

async function resolveMembership(seasonId: string, actingUserId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { leagueId: true, inauguralAuction: { select: { id: true } } }
  });
  if (!season) throw new DraftPresenceServiceError("Season not found.", 404);
  if (!season.inauguralAuction) {
    throw new DraftPresenceServiceError("No inaugural auction for this season.", 404);
  }
  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: season.leagueId, userId: actingUserId } }
  });
  if (!membership) throw new DraftPresenceServiceError("You are not a member of this league.", 403);
  return { auctionId: season.inauguralAuction.id, membershipId: membership.id };
}

export const draftPresenceService = {
  async join(seasonId: string, actingUserId: string): Promise<string[]> {
    const { auctionId, membershipId } = await resolveMembership(seasonId, actingUserId);
    await prisma.inauguralAuctionPresence.upsert({
      where: { auctionId_leagueMemberId: { auctionId, leagueMemberId: membershipId } },
      create: { auctionId, leagueMemberId: membershipId },
      update: { lastSeenAt: new Date() }
    });
    return this.listPresentMemberIds(auctionId);
  },

  async leave(seasonId: string, actingUserId: string): Promise<string[]> {
    const { auctionId, membershipId } = await resolveMembership(seasonId, actingUserId);
    await prisma.inauguralAuctionPresence.deleteMany({
      where: { auctionId, leagueMemberId: membershipId }
    });
    return this.listPresentMemberIds(auctionId);
  },

  async listPresentMemberIds(auctionId: string): Promise<string[]> {
    const rows = await prisma.inauguralAuctionPresence.findMany({
      where: { auctionId },
      select: { leagueMemberId: true }
    });
    return rows.map((row) => row.leagueMemberId);
  },

  async listPresentMemberIdsBySeason(seasonId: string): Promise<string[]> {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { inauguralAuction: { select: { id: true } } }
    });
    if (!season?.inauguralAuction) return [];
    return this.listPresentMemberIds(season.inauguralAuction.id);
  }
};
