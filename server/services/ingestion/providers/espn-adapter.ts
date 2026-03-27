import type { IngestionProviderAdapter } from "@/server/services/ingestion/providers/types";

function buildEspnHeaders(config: Record<string, string | number | boolean | null>) {
  const headers: HeadersInit = {
    Accept: "application/json"
  };

  const espnS2 = typeof config.espnS2 === "string" ? config.espnS2 : null;
  const swid = typeof config.swid === "string" ? config.swid : null;

  if (espnS2 && swid) {
    headers.Cookie = `espn_s2=${espnS2}; SWID=${swid}`;
  }

  return headers;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function readTeamName(team: Record<string, unknown>) {
  const location = typeof team.location === "string" ? team.location : "";
  const nickname = typeof team.nickname === "string" ? team.nickname : "";
  return `${location} ${nickname}`.trim() || `ESPN Team ${String(team.id ?? "")}`;
}

export const espnAdapter: IngestionProviderAdapter = {
  provider: "ESPN",
  async preview(context) {
    if (!context.externalLeagueId) {
      throw new Error("ESPN imports require an external league ID.");
    }

    const seasonKey = context.externalSeasonKey || String(new Date().getFullYear());
    const baseUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${seasonKey}/segments/0/leagues/${context.externalLeagueId}`;
    const headers = buildEspnHeaders(context.config);
    const providerNotes = [
      "ESPN fantasy league access is unofficial and may be less stable than Sleeper or CSV.",
      "If ESPN data is unavailable, use CSV fallback for the same season."
    ];

    if (context.importType === "SEASON_STANDINGS") {
      const response = await fetch(`${baseUrl}?view=mTeam&view=mStandings`, {
        cache: "no-store",
        headers
      });

      if (!response.ok) {
        throw new Error("Unable to load ESPN season standings. Verify league ID, season key, and cookies or use CSV fallback.");
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const teams = Array.isArray(payload.teams) ? (payload.teams as Array<Record<string, unknown>>) : [];

      return {
        provider: "ESPN",
        importType: context.importType,
        seasonId: context.seasonId,
        seasonLabel: context.seasonLabel,
        weekNumber: null,
        records: {
          seasonStandings: teams.map((team) => {
            const record = (Array.isArray(team.record) ? team.record[0] : null) as Record<string, unknown> | null;

            return {
              externalEntityId: String(team.id ?? ""),
              externalDisplayName: readTeamName(team),
              rank: asNumber(team.rankCalculatedFinal),
              wins: record ? asNumber(record.wins) : null,
              losses: record ? asNumber(record.losses) : null,
              ties: record ? asNumber(record.ties) : null,
              pointsFor: record ? asNumber(record.pointsFor) : null,
              pointsAgainst: record ? asNumber(record.pointsAgainst) : null,
              playoffFinish: null,
              isChampion: null,
              metadata: {
                source: "ESPN",
                teamAbbrev: typeof team.abbrev === "string" ? team.abbrev : null
              }
            };
          }),
          weeklyStandings: []
        },
        warnings: [],
        missingFields: ["playoffFinish", "isChampion"],
        sourceSummary: {
          recordCount: teams.length,
          supportsSeasonStandings: true,
          supportsWeeklyStandings: true,
          providerNotes
        }
      };
    }

    if (!context.weekNumber) {
      throw new Error("ESPN weekly imports require a week number.");
    }

    const response = await fetch(`${baseUrl}?view=mTeam&view=mMatchup&scoringPeriodId=${context.weekNumber}`, {
      cache: "no-store",
      headers
    });

    if (!response.ok) {
      throw new Error("Unable to load ESPN weekly matchup data. Verify config or use CSV fallback.");
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const teams = Array.isArray(payload.teams) ? (payload.teams as Array<Record<string, unknown>>) : [];

    return {
      provider: "ESPN",
      importType: context.importType,
      seasonId: context.seasonId,
      seasonLabel: context.seasonLabel,
      weekNumber: context.weekNumber,
      records: {
        seasonStandings: [],
        weeklyStandings: teams.map((team) => ({
          externalEntityId: String(team.id ?? ""),
          externalDisplayName: readTeamName(team),
          weekNumber: context.weekNumber!,
          rank: null,
          pointsFor: null,
          pointsAgainst: null,
          result: null,
          opponentExternalEntityId: null,
          opponentDisplayName: null,
          metadata: {
            source: "ESPN",
            note: "Weekly matchup extraction is partial and may require CSV fallback."
          }
        }))
      },
      warnings: ["ESPN weekly import is partial. Use CSV fallback if matchup scoring data is incomplete."],
      missingFields: ["pointsFor", "pointsAgainst", "result", "opponentDisplayName", "rank"],
      sourceSummary: {
        recordCount: teams.length,
        supportsSeasonStandings: true,
        supportsWeeklyStandings: true,
        providerNotes
      }
    };
  }
};
