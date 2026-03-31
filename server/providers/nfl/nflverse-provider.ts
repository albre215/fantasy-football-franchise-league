import type { NflResultsProviderAdapter, LoadNflResultsOptions, LoadNflResultsResult, NormalizedNflTeamResultRecord } from "@/server/providers/nfl/types";
import type { SeasonNflGameResult, SeasonNflResultPhase } from "@/types/nfl-performance";
import { normalizeNflTeamAbbreviation } from "@/lib/nfl-team-aliases";
import { getExpectedWeekForPhase, validateSeasonWeekPhase } from "@/server/services/nfl-performance-helpers";

const NFLVERSE_GAMES_CSV_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";

function parseInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let isQuoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === "\"") {
      if (isQuoted && content[index + 1] === "\"") {
        currentValue += "\"";
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (character === "," && !isQuoted) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !isQuoted) {
      if (character === "\r" && content[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());

  return dataRows
    .filter((row) => row.length === headers.length)
    .map((row) =>
      headers.reduce<Record<string, string>>((record, header, index) => {
        record[header] = row[index] ?? "";
        return record;
      }, {})
    );
}

function mapGameTypeToPhase(gameType: string): SeasonNflResultPhase | null {
  const normalized = gameType.trim().toUpperCase();

  switch (normalized) {
    case "REG":
      return "REGULAR_SEASON";
    case "WC":
      return "WILD_CARD";
    case "DIV":
      return "DIVISIONAL";
    case "CON":
      return "CONFERENCE";
    case "SB":
      return "SUPER_BOWL";
    default:
      return null;
  }
}

function mapScoresToResult(pointsFor: number | null, pointsAgainst: number | null): SeasonNflGameResult | null {
  if (pointsFor === null || pointsAgainst === null) {
    return null;
  }

  if (pointsFor > pointsAgainst) {
    return "WIN";
  }

  if (pointsFor < pointsAgainst) {
    return "LOSS";
  }

  return "TIE";
}

function mapGameRowToRecords(row: Record<string, string>, seasonYear: number): NormalizedNflTeamResultRecord[] {
  const rowSeason = parseInteger(row.season);
  const weekNumber = parseInteger(row.week);
  const phase = mapGameTypeToPhase(row.game_type);

  if (rowSeason !== seasonYear || weekNumber === null || phase === null) {
    return [];
  }

  const normalizedWeekNumber =
    phase === "REGULAR_SEASON" ? weekNumber : (getExpectedWeekForPhase(seasonYear, phase) ?? weekNumber);

  const homeTeam = normalizeNflTeamAbbreviation(row.home_team ?? "");
  const awayTeam = normalizeNflTeamAbbreviation(row.away_team ?? "");
  const homeScore = parseInteger(row.home_score);
  const awayScore = parseInteger(row.away_score);
  const homeResult = mapScoresToResult(homeScore, awayScore);
  const awayResult = mapScoresToResult(awayScore, homeScore);

  if (!homeTeam || !awayTeam || homeResult === null || awayResult === null) {
    return [];
  }

  validateSeasonWeekPhase(seasonYear, normalizedWeekNumber, phase);

  const metadata = {
    gameId: row.game_id?.trim() || null,
    gameDate: row.gameday?.trim() || null,
    seasonType: row.game_type?.trim() || null,
    providerWeekNumber: weekNumber
  };

  return [
    {
      seasonYear,
      weekNumber: normalizedWeekNumber,
      phase,
      teamAbbreviation: homeTeam,
      opponentAbbreviation: awayTeam,
      result: homeResult,
      pointsFor: homeScore,
      pointsAgainst: awayScore,
      metadata
    },
    {
      seasonYear,
      weekNumber: normalizedWeekNumber,
      phase,
      teamAbbreviation: awayTeam,
      opponentAbbreviation: homeTeam,
      result: awayResult,
      pointsFor: awayScore,
      pointsAgainst: homeScore,
      metadata
    }
  ];
}

async function loadRecords(options: LoadNflResultsOptions): Promise<LoadNflResultsResult> {
  const response = await fetch(NFLVERSE_GAMES_CSV_URL, {
    headers: {
      Accept: "text/csv"
    },
    next: {
      revalidate: 60 * 60
    }
  });

  if (!response.ok) {
    throw new Error(`NFL provider request failed with status ${response.status}.`);
  }

  const csv = await response.text();
  const rows = parseCsv(csv);
  const records = rows.flatMap((row) => mapGameRowToRecords(row, options.seasonYear));
  const filteredRecords =
    typeof options.weekNumber === "number"
      ? records.filter((record) => record.weekNumber === options.weekNumber)
      : records;

  return {
    records: filteredRecords,
    warnings: filteredRecords.length === 0 ? ["No NFL results were returned for the requested season context."] : []
  };
}

export const nflverseProvider: NflResultsProviderAdapter = {
  provider: "NFLVERSE",
  async loadSeasonResults(options) {
    return loadRecords(options);
  },
  async loadWeekResults(options) {
    return loadRecords(options);
  }
};
