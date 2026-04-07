import type { HistoricalAcquisitionType, HistoryTeamSummary } from "@/types/history";

export interface AnalyticsChartDatum {
  key: string;
  label: string;
  value: number;
}

export interface LeagueChampionSummary {
  seasonId: string;
  seasonYear: number;
  seasonName: string | null;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  championTeams: HistoryTeamSummary[];
}

/**
 * League-wide read model derived from persisted standings, ownership, and ledger data.
 * All money-facing metrics use posted LedgerEntry totals rather than inferred values.
 */
export interface LeagueOverviewAnalytics {
  leagueId: string;
  leagueName: string;
  totalSeasons: number;
  totalUniqueFranchisesUsed: number;
  totalOwnersAcrossHistory: number;
  /** Sum of each season's net posted ledger total across all tracked seasons. */
  totalLeaguePayouts: number;
  /** Average per-season spread between the highest and lowest owner ledger totals. */
  averageSeasonParityGap: number | null;
  mostRecentChampion: LeagueChampionSummary | null;
  mostCommonChampion: {
    ownerUserId: string;
    ownerDisplayName: string;
    championshipCount: number;
  } | null;
  championCounts: Array<{
    ownerUserId: string;
    ownerDisplayName: string;
    championshipCount: number;
  }>;
  championChart: AnalyticsChartDatum[];
  mostOwnedTeam: {
    team: HistoryTeamSummary;
    ownershipCount: number;
  } | null;
  /** Highest cumulative owner ledger total across the full league history. */
  biggestCareerWinner: {
    ownerUserId: string;
    ownerDisplayName: string;
    totalEarnings: number;
  } | null;
  /** Lowest cumulative owner ledger total across the full league history. */
  biggestCareerLoser: {
    ownerUserId: string;
    ownerDisplayName: string;
    totalEarnings: number;
  } | null;
  /** Per-season ledger snapshot used for winner/loser and parity analytics. */
  seasonSummaries: Array<{
    seasonId: string;
    seasonYear: number;
    seasonName: string | null;
    totalLeaguePayouts: number;
    biggestWinner: {
      ownerUserId: string;
      ownerDisplayName: string;
      amount: number;
    } | null;
    biggestLoser: {
      ownerUserId: string;
      ownerDisplayName: string;
      amount: number;
    } | null;
    parityGap: number | null;
  }>;
}

export interface FranchiseOwnershipTimelineRow {
  seasonId: string;
  seasonYear: number;
  seasonName: string | null;
  ownerUserId: string;
  ownerDisplayName: string;
  acquisitionType: HistoricalAcquisitionType;
  draftPickNumber: number | null;
}

export interface FranchiseAnalyticsEntry {
  team: HistoryTeamSummary;
  ownershipCount: number;
  /** Persisted regular-season NFL wins for this franchise across tracked seasons. */
  totalRegularSeasonWins: number;
  /** Persisted playoff NFL wins for this franchise across tracked seasons. */
  totalPlayoffWins: number;
  /** Analytics mirror of the current NFL posting formula: one unit per win. */
  totalNflLedgerAmount: number;
  /** Average NFL-derived ledger amount across seasons with persisted NFL results. */
  averageNflLedgerAmountPerSeason: number | null;
  longestOwnershipStreak: {
    ownerUserId: string;
    ownerDisplayName: string;
    length: number;
    startSeasonYear: number;
    endSeasonYear: number;
  } | null;
  timeline: FranchiseOwnershipTimelineRow[];
}

/**
 * Franchise-focused analytics derived from persisted TeamOwnership, Draft, and
 * SeasonNflTeamResult records.
 */
export interface FranchiseAnalytics {
  leagueId: string;
  topOwnedTeams: Array<{
    team: HistoryTeamSummary;
    ownershipCount: number;
  }>;
  topOwnedTeamsChart: AnalyticsChartDatum[];
  mostProfitableTeams: Array<{
    team: HistoryTeamSummary;
    totalNflLedgerAmount: number;
    averageNflLedgerAmountPerSeason: number | null;
  }>;
  mostProfitableTeamsChart: AnalyticsChartDatum[];
  bestHistoricalTeams: Array<{
    team: HistoryTeamSummary;
    totalWins: number;
    regularSeasonWins: number;
    playoffWins: number;
  }>;
  bestHistoricalTeamsChart: AnalyticsChartDatum[];
  longestOwnershipStreaks: Array<{
    team: HistoryTeamSummary;
    ownerUserId: string;
    ownerDisplayName: string;
    streakLength: number;
    startSeasonYear: number;
    endSeasonYear: number;
  }>;
  franchises: FranchiseAnalyticsEntry[];
}

export interface OwnerSeasonPortfolioRow {
  seasonId: string;
  seasonYear: number;
  seasonName: string | null;
  teams: Array<{
    team: HistoryTeamSummary;
    acquisitionType: HistoricalAcquisitionType;
    draftPickNumber: number | null;
  }>;
}

export interface OwnerAnalyticsEntry {
  ownerUserId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  /** Count of seasons where the owner had ownership, standings, or ledger participation. */
  totalSeasonsParticipated: number;
  totalUniqueFranchisesOwned: number;
  /** Current alias for totalUniqueFranchisesOwned used by charts/UI. */
  ownershipDiversity: number;
  /** Sum of season ledger totals across all tracked seasons for this owner. */
  totalEarnings: number;
  /** Average final standing rank across seasons with saved standings. Lower is better. */
  averageFinish: number | null;
  /** Average per-season fantasy winning percentage from saved standings. */
  fantasyWinRate: number | null;
  /** Average per-season NFL winning percentage from persisted NFL team results. */
  nflWinRate: number | null;
  mostFrequentlyOwnedTeam: {
    team: HistoryTeamSummary;
    count: number;
  } | null;
  longestContinuousOwnership: {
    team: HistoryTeamSummary;
    length: number;
    startSeasonYear: number;
    endSeasonYear: number;
  } | null;
  teamCounts: Array<{
    team: HistoryTeamSummary;
    count: number;
  }>;
  teamCountChart: AnalyticsChartDatum[];
  /** Season-by-season analytics rows for ledger, finish, and win-rate trend reporting. */
  performanceTrend: Array<{
    seasonId: string;
    seasonYear: number;
    seasonName: string | null;
    ledgerTotal: number;
    finish: number | null;
    fantasyWinRate: number | null;
    nflWinRate: number | null;
  }>;
  earningsTrendChart: AnalyticsChartDatum[];
  seasons: OwnerSeasonPortfolioRow[];
}

/**
 * Owner-focused analytics derived from season participation, posted ledger
 * totals, saved standings, and persisted NFL result rows.
 */
export interface OwnerAnalytics {
  leagueId: string;
  ownershipDiversityChart: AnalyticsChartDatum[];
  totalEarningsChart: AnalyticsChartDatum[];
  averageFinishChart: AnalyticsChartDatum[];
  owners: OwnerAnalyticsEntry[];
}

export interface DraftSeasonAnalyticsSummary {
  draftId: string;
  targetSeasonId: string;
  targetSeasonYear: number;
  targetSeasonName: string | null;
  sourceSeasonYear: number;
  sourceSeasonName: string | null;
  status: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  keeperCount: number;
  picksCompleted: number;
}

export interface DraftAnalytics {
  leagueId: string;
  mostDraftedTeams: Array<{
    team: HistoryTeamSummary;
    draftCount: number;
    averagePickNumber: number | null;
  }>;
  mostDraftedTeamsChart: AnalyticsChartDatum[];
  mostKeptTeams: Array<{
    team: HistoryTeamSummary;
    keepCount: number;
  }>;
  mostKeptTeamsChart: AnalyticsChartDatum[];
  /** Average target-season finish and ledger total grouped by replacement draft slot. */
  draftSlotOutcomes: Array<{
    draftSlot: number;
    averageFinish: number | null;
    averageLedgerTotal: number | null;
    sampleSize: number;
  }>;
  draftSlotOutcomeChart: AnalyticsChartDatum[];
  /** Draft-by-draft audit rows pairing each replacement pick with season outcomes. */
  replacementDraftEffectiveness: Array<{
    draftId: string;
    targetSeasonId: string;
    targetSeasonYear: number;
    targetSeasonName: string | null;
    entries: Array<{
      draftSlot: number;
      ownerUserId: string;
      ownerDisplayName: string;
      selectedTeam: HistoryTeamSummary | null;
      finalFinish: number | null;
      finalLedgerTotal: number | null;
      selectedTeamRegularSeasonWins: number;
      selectedTeamPlayoffWins: number;
      selectedTeamNflLedgerAmount: number;
    }>;
  }>;
  recentDrafts: DraftSeasonAnalyticsSummary[];
}

export interface LeagueOverviewAnalyticsResponse {
  overview: LeagueOverviewAnalytics;
}

export interface FranchiseAnalyticsResponse {
  franchiseAnalytics: FranchiseAnalytics;
}

export interface OwnerAnalyticsResponse {
  ownerAnalytics: OwnerAnalytics;
}

export interface DraftAnalyticsResponse {
  draftAnalytics: DraftAnalytics;
}
