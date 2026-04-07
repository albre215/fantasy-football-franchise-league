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

export interface LeagueOverviewAnalytics {
  leagueId: string;
  leagueName: string;
  totalSeasons: number;
  totalUniqueFranchisesUsed: number;
  totalOwnersAcrossHistory: number;
  totalLeaguePayouts: number;
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
  biggestCareerWinner: {
    ownerUserId: string;
    ownerDisplayName: string;
    totalEarnings: number;
  } | null;
  biggestCareerLoser: {
    ownerUserId: string;
    ownerDisplayName: string;
    totalEarnings: number;
  } | null;
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
  totalRegularSeasonWins: number;
  totalPlayoffWins: number;
  totalNflLedgerAmount: number;
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
  totalSeasonsParticipated: number;
  totalUniqueFranchisesOwned: number;
  ownershipDiversity: number;
  totalEarnings: number;
  averageFinish: number | null;
  fantasyWinRate: number | null;
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
  draftSlotOutcomes: Array<{
    draftSlot: number;
    averageFinish: number | null;
    averageLedgerTotal: number | null;
    sampleSize: number;
  }>;
  draftSlotOutcomeChart: AnalyticsChartDatum[];
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
