import { describe, expect, it, vi } from "vitest";

import { replaceSeasonNflLedgerEntriesForSeasonTx } from "@/server/services/ledger-service";

describe("replaceSeasonNflLedgerEntriesForSeasonTx", () => {
  it("replaces only season-scoped NFL ledger categories and skips zero-amount entries", async () => {
    const tx = {
      ledgerEntry: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        createMany: vi.fn().mockResolvedValue(undefined)
      }
    } as const;

    await replaceSeasonNflLedgerEntriesForSeasonTx(tx as never, {
      seasonId: "season-1",
      leagueId: "league-1",
      actingUserId: "commissioner-1",
      ownerEntries: [
        {
          leagueMemberId: "member-a",
          displayName: "Alpha",
          regularSeasonAmount: 2,
          playoffAmount: 1,
          regularSeasonWins: 2,
          playoffWins: 1,
          ownedTeamIds: ["team-1", "team-2", "team-3"]
        },
        {
          leagueMemberId: "member-b",
          displayName: "Bravo",
          regularSeasonAmount: 0,
          playoffAmount: 0,
          regularSeasonWins: 0,
          playoffWins: 0,
          ownedTeamIds: ["team-4", "team-5", "team-6"]
        }
      ]
    });

    expect(tx.ledgerEntry.deleteMany).toHaveBeenCalledWith({
      where: {
        seasonId: "season-1",
        category: {
          in: ["NFL_REGULAR_SEASON", "NFL_PLAYOFF"]
        }
      }
    });
    expect(tx.ledgerEntry.createMany).toHaveBeenCalledTimes(1);
    expect(tx.ledgerEntry.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(tx.ledgerEntry.createMany.mock.calls[0][0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leagueMemberId: "member-a",
          category: "NFL_REGULAR_SEASON",
          description: "NFL regular season posting for Alpha",
          actingUserId: "commissioner-1"
        }),
        expect.objectContaining({
          leagueMemberId: "member-a",
          category: "NFL_PLAYOFF",
          description: "NFL playoff posting for Alpha",
          actingUserId: "commissioner-1"
        })
      ])
    );
  });
});
