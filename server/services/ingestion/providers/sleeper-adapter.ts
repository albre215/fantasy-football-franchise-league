import type { IngestionProviderAdapter } from "@/server/services/ingestion/providers/types";

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractSleeperPoints(settings: Record<string, unknown> | null | undefined, statKey: string) {
  if (!settings) {
    return null;
  }

  return asNumber(settings[statKey]);
}

export const sleeperAdapter: IngestionProviderAdapter = {
  provider: "SLEEPER",
  async preview(context) {
    if (!context.externalLeagueId) {
      throw new Error("Sleeper imports require an external league ID.");
    }

    const [usersResponse, rostersResponse] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${context.externalLeagueId}/users`, {
        cache: "no-store"
      }),
      fetch(`https://api.sleeper.app/v1/league/${context.externalLeagueId}/rosters`, {
        cache: "no-store"
      })
    ]);

    if (!usersResponse.ok || !rostersResponse.ok) {
      throw new Error("Unable to load Sleeper league users/rosters. Check the league ID and try CSV fallback if needed.");
    }

    const users = (await usersResponse.json()) as Array<Record<string, unknown>>;
    const rosters = (await rostersResponse.json()) as Array<Record<string, unknown>>;
    const usersById = new Map(
      users.map((user) => {
        const metadata =
          user.metadata && typeof user.metadata === "object"
            ? (user.metadata as Record<string, unknown>)
            : null;

        return [
          String(user.user_id ?? ""),
          String(user.display_name ?? user.username ?? metadata?.team_name ?? "Unknown Sleeper Owner")
        ] as const;
      })
    );
    const providerNotes = [
      "Sleeper is the cleanest supported read-only API path for standings imports.",
      "Weekly imports use the matchups endpoint and may not include every standings field."
    ];

    if (context.importType === "SEASON_STANDINGS") {
      return {
        provider: "SLEEPER",
        importType: context.importType,
        seasonId: context.seasonId,
        seasonLabel: context.seasonLabel,
        weekNumber: null,
        records: {
          seasonStandings: rosters.map((roster) => {
            const ownerId = String(roster.owner_id ?? roster.roster_id ?? "");
            const settings = (roster.settings ?? null) as Record<string, unknown> | null;

            return {
              externalEntityId: ownerId,
              externalDisplayName: usersById.get(ownerId) ?? `Sleeper roster ${ownerId}`,
              rank: asNumber(roster.settings ? (roster.settings as Record<string, unknown>).rank : null),
              wins: extractSleeperPoints(settings, "wins"),
              losses: extractSleeperPoints(settings, "losses"),
              ties: extractSleeperPoints(settings, "ties"),
              pointsFor:
                extractSleeperPoints(settings, "fpts") !== null
                  ? Number(
                      `${extractSleeperPoints(settings, "fpts")}.${String(
                        extractSleeperPoints(settings, "fpts_decimal") ?? 0
                      ).padStart(2, "0")}`
                    )
                  : null,
              pointsAgainst: extractSleeperPoints(settings, "fpts_against"),
              playoffFinish: null,
              isChampion: null,
              metadata: {
                source: "SLEEPER",
                rosterId: String(roster.roster_id ?? ownerId)
              }
            };
          }),
          weeklyStandings: []
        },
        warnings: [],
        missingFields: ["playoffFinish", "isChampion"],
        sourceSummary: {
          recordCount: rosters.length,
          supportsSeasonStandings: true,
          supportsWeeklyStandings: true,
          providerNotes
        }
      };
    }

    if (!context.weekNumber) {
      throw new Error("Sleeper weekly imports require a week number.");
    }

    const matchupsResponse = await fetch(
      `https://api.sleeper.app/v1/league/${context.externalLeagueId}/matchups/${context.weekNumber}`,
      {
        cache: "no-store"
      }
    );

    if (!matchupsResponse.ok) {
      throw new Error("Unable to load Sleeper weekly matchup data. Try CSV fallback if needed.");
    }

    const matchups = (await matchupsResponse.json()) as Array<Record<string, unknown>>;
    const rosterIdToOwnerId = new Map(
      rosters.map((roster) => [String(roster.roster_id ?? ""), String(roster.owner_id ?? "")])
    );
    const groupedMatchups = new Map<number, Array<Record<string, unknown>>>();

    for (const matchup of matchups) {
      const matchupId = Number(matchup.matchup_id ?? 0);
      const bucket = groupedMatchups.get(matchupId) ?? [];
      bucket.push(matchup);
      groupedMatchups.set(matchupId, bucket);
    }

    return {
      provider: "SLEEPER",
      importType: context.importType,
      seasonId: context.seasonId,
      seasonLabel: context.seasonLabel,
      weekNumber: context.weekNumber,
      records: {
        seasonStandings: [],
        weeklyStandings: matchups.map((matchup) => {
          const rosterId = String(matchup.roster_id ?? "");
          const ownerId = rosterIdToOwnerId.get(rosterId) ?? rosterId;
          const matchupId = Number(matchup.matchup_id ?? 0);
          const matchupPeers = groupedMatchups.get(matchupId) ?? [];
          const opponent = matchupPeers.find((entry) => String(entry.roster_id ?? "") !== rosterId);

          return {
            externalEntityId: ownerId,
            externalDisplayName: usersById.get(ownerId) ?? `Sleeper roster ${ownerId}`,
            weekNumber: context.weekNumber!,
            rank: null,
            pointsFor: asNumber(matchup.points),
            pointsAgainst: opponent ? asNumber(opponent.points) : null,
            result: null,
            opponentExternalEntityId: opponent
              ? rosterIdToOwnerId.get(String(opponent.roster_id ?? "")) ?? String(opponent.roster_id ?? "")
              : null,
            opponentDisplayName: opponent
              ? usersById.get(
                  rosterIdToOwnerId.get(String(opponent.roster_id ?? "")) ?? String(opponent.roster_id ?? "")
                ) ?? null
              : null,
            metadata: {
              source: "SLEEPER",
              matchupId
            }
          };
        })
      },
      warnings: ["Weekly result imports do not currently infer win/loss from Sleeper matchup payloads."],
      missingFields: ["rank", "result"],
      sourceSummary: {
        recordCount: matchups.length,
        supportsSeasonStandings: true,
        supportsWeeklyStandings: true,
        providerNotes
      }
    };
  }
};
