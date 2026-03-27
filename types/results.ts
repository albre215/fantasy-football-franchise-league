import type { IngestionProvider, IngestionRunSummary, SeasonSourceConfigSummary } from "@/types/ingestion";

export interface SeasonResultStanding {
  leagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  role: "COMMISSIONER" | "OWNER";
  provider: IngestionProvider;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  playoffFinish: string | null;
  isChampion: boolean | null;
  sourceRunId: string | null;
  externalDisplayName: string | null;
}

export interface WeeklyResultStanding {
  weekNumber: number;
  leagueMemberId: string;
  userId: string;
  displayName: string;
  provider: IngestionProvider;
  rank: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  result: string | null;
  opponentDisplayName: string | null;
  sourceRunId: string | null;
}

export interface SeasonResultsSummary {
  season: {
    id: string;
    leagueId: string;
    year: number;
    name: string | null;
    status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  };
  availability: {
    hasSeasonStandings: boolean;
    hasWeeklyStandings: boolean;
    hasChampionData: boolean;
    hasPlayoffData: boolean;
    isReadyForDraftOrderAutomation: boolean;
  };
  sourceConfigs: SeasonSourceConfigSummary[];
  seasonStandings: SeasonResultStanding[];
  weeklyStandings: WeeklyResultStanding[];
  importRuns: IngestionRunSummary[];
}

export interface SeasonResultsResponse {
  results: SeasonResultsSummary;
}
