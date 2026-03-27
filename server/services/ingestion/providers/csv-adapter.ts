import type { IngestionProviderAdapter } from "@/server/services/ingestion/providers/types";

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV import requires a header row and at least one data row.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);

    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function toNullableNumber(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableBoolean(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "yes" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "no" || normalized === "0") {
    return false;
  }

  return null;
}

export const csvAdapter: IngestionProviderAdapter = {
  provider: "CSV",
  async preview(context) {
    if (!context.csvContent) {
      throw new Error("CSV content is required for CSV preview/import.");
    }

    const rows = parseCsv(context.csvContent);
    const providerNotes = [
      "CSV import supports manual fallback when ESPN or Sleeper data is unavailable.",
      "Paste season standings rows or weekly results rows into the import form."
    ];

    if (context.importType === "SEASON_STANDINGS") {
      const missingFields = ["externalentityid", "externaldisplayname"].filter(
        (field) => !(field in rows[0])
      );

      return {
        provider: "CSV",
        importType: context.importType,
        seasonId: context.seasonId,
        seasonLabel: context.seasonLabel,
        weekNumber: null,
        records: {
          seasonStandings: rows.map((row) => ({
            externalEntityId: row.externalentityid || row.teamid || row.teamname || row.ownername,
            externalDisplayName:
              row.externaldisplayname || row.teamname || row.ownername || row.externalentityid || "Unknown",
            rank: toNullableNumber(row.rank),
            wins: toNullableNumber(row.wins),
            losses: toNullableNumber(row.losses),
            ties: toNullableNumber(row.ties),
            pointsFor: toNullableNumber(row.pointsfor),
            pointsAgainst: toNullableNumber(row.pointsagainst),
            playoffFinish: row.playofffinish?.trim() || null,
            isChampion: toNullableBoolean(row.ischampion),
            metadata: {
              source: "CSV",
              rawRowType: "season_standing"
            }
          })),
          weeklyStandings: []
        },
        warnings: [],
        missingFields,
        sourceSummary: {
          recordCount: rows.length,
          supportsSeasonStandings: true,
          supportsWeeklyStandings: true,
          providerNotes
        }
      };
    }

    const weekNumber = context.weekNumber ?? toNullableNumber(rows[0].weeknumber) ?? null;

    if (!weekNumber) {
      throw new Error("Weekly CSV imports require a week number in the request or a weekNumber column.");
    }

    return {
      provider: "CSV",
      importType: context.importType,
      seasonId: context.seasonId,
      seasonLabel: context.seasonLabel,
      weekNumber,
      records: {
        seasonStandings: [],
        weeklyStandings: rows.map((row) => ({
          externalEntityId: row.externalentityid || row.teamid || row.teamname || row.ownername,
          externalDisplayName:
            row.externaldisplayname || row.teamname || row.ownername || row.externalentityid || "Unknown",
          weekNumber,
          rank: toNullableNumber(row.rank),
          pointsFor: toNullableNumber(row.pointsfor),
          pointsAgainst: toNullableNumber(row.pointsagainst),
          result: row.result?.trim() || null,
          opponentExternalEntityId: row.opponentexternalentityid?.trim() || null,
          opponentDisplayName: row.opponentdisplayname?.trim() || null,
          metadata: {
            source: "CSV",
            rawRowType: "weekly_standing"
          }
        }))
      },
      warnings: [],
      missingFields: [],
      sourceSummary: {
        recordCount: rows.length,
        supportsSeasonStandings: true,
        supportsWeeklyStandings: true,
        providerNotes
      }
    };
  }
};
