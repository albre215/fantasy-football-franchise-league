export type HistoricalAcquisitionType = "KEEPER" | "DRAFT" | "MANUAL" | "UNKNOWN";

export interface HistoryTeamSummary {
  id: string;
  name: string;
  abbreviation: string;
  conference: "AFC" | "NFC";
  division: string;
}

export interface HistoryOwnerOption {
  userId: string;
  displayName: string;
  email: string;
}

export interface HistoryFranchiseOption {
  nflTeamId: string;
  name: string;
  abbreviation: string;
  conference: "AFC" | "NFC";
  division: string;
}

export interface HistorySeasonSummary {
  seasonId: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  isLocked: boolean;
  assignedTeamCount: number;
  unassignedTeamCount: number;
  ownershipRecordCount: number;
  hasDraft: boolean;
  draftStatus: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | null;
  keeperCount: number;
  pickCount: number;
  historicalDataAvailable: {
    ownership: boolean;
    draft: boolean;
  };
}

export interface LeagueHistoryOverview {
  leagueId: string;
  leagueName: string;
  totalSeasonsTracked: number;
  totalOwnershipRecords: number;
  totalHistoricalOwners: number;
  totalDraftsTracked: number;
  totalKeeperSelections: number;
  totalDraftPicksMade: number;
  franchiseOptions: HistoryFranchiseOption[];
  ownerOptions: HistoryOwnerOption[];
  continuitySummary: {
    longestOwnershipStreak: {
      ownerDisplayName: string;
      teamAbbreviation: string;
      streakLength: number;
    } | null;
    mostFrequentlyOwnedTeam: {
      teamAbbreviation: string;
      ownershipCount: number;
    } | null;
    mostFrequentlyChangingTeam: {
      teamAbbreviation: string;
      transitionCount: number;
    } | null;
  };
  deferredMetrics: DeferredMetric[];
}

export interface DeferredMetric {
  id:
    | "championships"
    | "win_loss_history"
    | "playoff_results"
    | "dynasty_metrics"
    | "team_success_by_decade"
    | "owner_win_percentage";
  label: string;
  description: string;
  availability: "PROMPT_8";
}

export interface FranchiseHistoryRow {
  seasonId: string;
  seasonYear: number;
  seasonName: string | null;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  acquisitionType: HistoricalAcquisitionType;
  slot: number | null;
  draftPickNumber: number | null;
}

export interface FranchiseHistorySummary {
  franchise: HistoryFranchiseOption;
  rows: FranchiseHistoryRow[];
  analytics: {
    seasonsOwned: number;
    distinctOwners: number;
    longestContinuousStreak: {
      ownerDisplayName: string;
      length: number;
      startSeasonYear: number;
      endSeasonYear: number;
    } | null;
    ownershipTransitions: number;
    timesKept: number;
    timesDrafted: number;
    currentOwner: {
      ownerDisplayName: string;
      seasonYear: number;
    } | null;
  };
}

export interface OwnerPortfolioTeam {
  team: HistoryTeamSummary;
  slot: number;
  acquisitionType: HistoricalAcquisitionType;
  draftPickNumber: number | null;
}

export interface OwnerHistoryRow {
  seasonId: string;
  seasonYear: number;
  seasonName: string | null;
  teams: OwnerPortfolioTeam[];
}

export interface OwnerHistorySummary {
  owner: HistoryOwnerOption;
  rows: OwnerHistoryRow[];
  analytics: {
    totalSeasonsParticipated: number;
    totalDistinctTeamsControlled: number;
    totalKeeperSelections: number;
    totalDraftedTeamsAcquired: number;
    longestTeamTenure: {
      teamAbbreviation: string;
      length: number;
      startSeasonYear: number;
      endSeasonYear: number;
    } | null;
    currentPortfolio: HistoryTeamSummary[];
  };
}

export interface DraftHistorySeasonSummary {
  draftId: string;
  targetSeasonId: string;
  targetSeasonYear: number;
  targetSeasonName: string | null;
  sourceSeasonId: string;
  sourceSeasonYear: number;
  sourceSeasonName: string | null;
  status: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  keeperCount: number;
  picksCompleted: number;
  completedAt: string | null;
  keepers: Array<{
    ownerDisplayName: string;
    team: HistoryTeamSummary;
  }>;
  picks: Array<{
    overallPickNumber: number;
    ownerDisplayName: string;
    team: HistoryTeamSummary | null;
    pickedAt: string | null;
  }>;
}

export interface AnalyticsLeaderboardEntry {
  label: string;
  value: string;
  supportingText: string;
}

export interface LeagueAnalyticsSummary {
  franchiseLeaderboards: {
    longestOwnershipStreak: AnalyticsLeaderboardEntry[];
    mostFrequentlyOwned: AnalyticsLeaderboardEntry[];
    mostFrequentlyChanging: AnalyticsLeaderboardEntry[];
    mostKept: AnalyticsLeaderboardEntry[];
    mostDrafted: AnalyticsLeaderboardEntry[];
  };
  ownerLeaderboards: {
    widestFranchiseHistory: AnalyticsLeaderboardEntry[];
    longestFranchiseTenure: AnalyticsLeaderboardEntry[];
    mostKeeperSelections: AnalyticsLeaderboardEntry[];
    mostDraftedAcquisitions: AnalyticsLeaderboardEntry[];
  };
  deferredMetrics: DeferredMetric[];
}

export interface LeagueHistoryOverviewResponse {
  overview: LeagueHistoryOverview;
}

export interface LeagueSeasonHistoryResponse {
  seasons: HistorySeasonSummary[];
}

export interface FranchiseHistoryResponse {
  franchiseHistory: FranchiseHistorySummary;
}

export interface OwnerHistoryResponse {
  ownerHistory: OwnerHistorySummary;
}

export interface DraftHistoryResponse {
  drafts: DraftHistorySeasonSummary[];
}

export interface LeagueAnalyticsSummaryResponse {
  analytics: LeagueAnalyticsSummary;
}
