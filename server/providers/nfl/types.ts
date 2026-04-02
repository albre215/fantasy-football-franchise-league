import type { SeasonNflGameResult, SeasonNflResultPhase } from "@/types/nfl-performance";

export interface NormalizedNflTeamResultRecord {
  seasonYear: number;
  weekNumber: number;
  phase: SeasonNflResultPhase;
  teamAbbreviation: string;
  opponentAbbreviation: string | null;
  result: SeasonNflGameResult;
  pointsFor: number | null;
  pointsAgainst: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface LoadNflResultsOptions {
  seasonYear: number;
  weekNumber?: number;
}

export interface LoadNflResultsResult {
  records: NormalizedNflTeamResultRecord[];
  warnings?: string[];
}

export interface NflResultsProviderAdapter {
  provider: "NFLVERSE";
  loadSeasonResults(options: LoadNflResultsOptions): Promise<LoadNflResultsResult>;
  loadWeekResults(options: Required<LoadNflResultsOptions>): Promise<LoadNflResultsResult>;
}
