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

export interface RecommendedDraftOrderEntry extends SeasonResultsMemberOption {
  sourceSeasonRank: number;
  draftSlot: number;
}

export interface FantasyPayoutConfigEntry {
  rank: number;
  amount: number;
}

export interface FantasyPayoutPublishedEntry extends SeasonResultsMemberOption {
  amount: number;
  rank: number;
  description: string;
  createdAt: string;
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
    hasFantasyPayoutsPublished: boolean;
  };
  eligibleMembers: SeasonResultsMemberOption[];
  seasonStandings: SeasonResultStanding[];
  recommendedReverseDraftOrder: RecommendedDraftOrderEntry[];
  fantasyPayouts: {
    config: FantasyPayoutConfigEntry[];
    configSource: "DEFAULT" | "SEASON";
    publishedEntries: FantasyPayoutPublishedEntry[];
    publishedAt: string | null;
    totalPublishedAmount: number;
  };
}

export interface SaveManualSeasonStandingsInput {
  seasonId: string;
  actingUserId: string;
  orderedLeagueMemberIds: string[];
  payoutConfig?: FantasyPayoutConfigEntry[];
}

export interface OverwriteManualSeasonStandingsInput extends SaveManualSeasonStandingsInput {
  confirmOverwrite: boolean;
}

export interface SeasonResultsResponse {
  results: SeasonResultsSummary;
}

export interface SaveManualSeasonStandingsResponse {
  results: SeasonResultsSummary;
}

export interface OverwriteManualSeasonStandingsResponse {
  results: SeasonResultsSummary;
}
