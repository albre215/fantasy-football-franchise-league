import type { IngestionProvider } from "@/types/ingestion";

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

export interface SeasonResultsMemberOption {
  leagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  role: "COMMISSIONER" | "OWNER";
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
    hasFinalStandings: boolean;
    hasChampionData: boolean;
    isReadyForDraftOrderAutomation: boolean;
  };
  eligibleMembers: SeasonResultsMemberOption[];
  seasonStandings: SeasonResultStanding[];
  recommendedReverseDraftOrder: SeasonResultsMemberOption[];
}

export interface SaveManualSeasonStandingsInput {
  seasonId: string;
  actingUserId: string;
  orderedLeagueMemberIds: string[];
}

export interface SeasonResultsResponse {
  results: SeasonResultsSummary;
}

export interface SaveManualSeasonStandingsResponse {
  results: SeasonResultsSummary;
}
