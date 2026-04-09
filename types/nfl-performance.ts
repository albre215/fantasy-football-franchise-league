export type NflResultProvider = "MANUAL" | "NFLVERSE";
export type NflImportStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type NflImportMode = "FULL_SEASON" | "SINGLE_WEEK";
export type SeasonNflResultPhase = "REGULAR_SEASON" | "WILD_CARD" | "DIVISIONAL" | "CONFERENCE" | "SUPER_BOWL";
export type SeasonNflGameResult = "WIN" | "LOSS" | "TIE";

export interface NflPerformanceTeamSummary {
  nflTeamId: string;
  abbreviation: string;
  name: string;
}

export interface NflPerformanceOwnerSummary {
  leagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  profileImageUrl?: string | null;
  role: "COMMISSIONER" | "OWNER";
}

export interface SeasonNflWeekOption {
  key: string;
  weekNumber: number;
  phase: SeasonNflResultPhase;
  label: string;
  gameCount: number;
  importedAt: string | null;
}

export type NflImportCoverageStatus = "EMPTY" | "PARTIAL" | "FULL_SEASON_IMPORTED";

export interface SeasonNflImportRunSummary {
  id: string;
  seasonId: string;
  seasonYear: number;
  provider: NflResultProvider;
  mode: NflImportMode;
  weekNumber: number | null;
  status: NflImportStatus;
  actingUserId: string | null;
  importedResultCount: number;
  warnings: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface OwnerNflRecordSummary extends NflPerformanceOwnerSummary {
  wins: number;
  losses: number;
  ties: number;
  regularSeasonWins: number;
  playoffWins: number;
  pointsFor: number;
  pointsAgainst: number;
  teamCount: number;
  resultCount: number;
  netPoints: number;
}

export interface OwnerNflLedgerPostingSummary extends NflPerformanceOwnerSummary {
  ownedTeams: NflPerformanceTeamSummary[];
  nflResultSummary: {
    teamCount: number;
    resultCount: number;
    wins: number;
    losses: number;
    ties: number;
    regularSeasonWins: number;
    playoffWins: number;
    pointsFor: number;
    pointsAgainst: number;
    netPoints: number;
  };
  regularSeasonAmount: number;
  playoffAmount: number;
  nflLedgerAmount: number;
  warnings: string[];
}

export interface SeasonNflLedgerPostingPreview {
  season: SeasonNflOverview["season"];
  isReadyToPost: boolean;
  postingStatus: "NOT_POSTED" | "POSTED";
  warnings: string[];
  coverageStatus: NflImportCoverageStatus;
  entryCount: number;
  totalLeagueAmount: number;
  alreadyPosted: boolean;
  canRerun: boolean;
  lastPostedAt: string | null;
  lastPostedBy: {
    userId: string;
    displayName: string;
    email: string;
    profileImageUrl?: string | null;
  } | null;
  readiness: {
    hasImportedResults: boolean;
    hasCompletedFullSeasonImport: boolean;
    hasValidOwnership: boolean;
    ownershipCount: number;
    expectedOwnershipCount: number;
    ownedTeamResultCount: number;
    missingOwnedTeamIds: string[];
    hasMissingOwnedTeamResults: boolean;
  };
  ownerRollups: OwnerNflLedgerPostingSummary[];
}

export interface TeamWeekPerformanceSummary {
  id: string;
  seasonId: string;
  seasonYear: number;
  weekNumber: number;
  phase: SeasonNflResultPhase;
  result: SeasonNflGameResult;
  pointsFor: number | null;
  pointsAgainst: number | null;
  sourceProvider: NflResultProvider;
  actingUserId: string | null;
  createdAt: string;
  updatedAt: string;
  team: NflPerformanceTeamSummary;
  opponent: NflPerformanceTeamSummary | null;
  owner: NflPerformanceOwnerSummary | null;
}

export interface OwnerWeekPerformanceSummary extends OwnerNflRecordSummary {
  teams: TeamWeekPerformanceSummary[];
}

export interface SeasonNflOverview {
  season: {
    id: string;
    leagueId: string;
    year: number;
    name: string | null;
    status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  };
  importState: {
    hasImportedResults: boolean;
    totalImportedResults: number;
    importedWeekCount: number;
    importedRegularSeasonWeeks: number;
    importedPlayoffWeeks: number;
    importedRegularSeasonWeekNumbers: number[];
    importedPlayoffPhases: SeasonNflResultPhase[];
    coverageStatus: NflImportCoverageStatus;
    hasCompletedFullSeasonImport: boolean;
    latestCompletedImport: SeasonNflImportRunSummary | null;
    recentImports: SeasonNflImportRunSummary[];
  };
  availableWeeks: SeasonNflWeekOption[];
  ownerStandings: OwnerNflRecordSummary[];
  playoffHighlights: Array<{
    team: NflPerformanceTeamSummary;
    owner: NflPerformanceOwnerSummary | null;
    phase: SeasonNflResultPhase;
    result: SeasonNflGameResult;
  }>;
}

export interface SeasonWeekNflResults {
  season: SeasonNflOverview["season"];
  selectedWeek: SeasonNflWeekOption | null;
  selectedPhase: SeasonNflResultPhase | null;
  ownerResults: OwnerWeekPerformanceSummary[];
  unassignedTeamResults: TeamWeekPerformanceSummary[];
  allTeamResults: TeamWeekPerformanceSummary[];
}

export interface ImportSeasonNflResultsInput {
  seasonId: string;
  actingUserId: string;
  weekNumber?: number;
}

export interface UpsertSeasonWeekTeamResultInput {
  seasonId: string;
  actingUserId: string;
  weekNumber: number;
  nflTeamId: string;
  opponentNflTeamId?: string | null;
  phase: SeasonNflResultPhase;
  result: SeasonNflGameResult;
  pointsFor?: number | null;
  pointsAgainst?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface SeasonNflOverviewResponse {
  nfl: SeasonNflOverview;
}

export interface SeasonNflLedgerPostingPreviewResponse {
  nflLedger: SeasonNflLedgerPostingPreview;
}

export interface SeasonWeekNflResultsResponse {
  nfl: SeasonWeekNflResults;
}

export interface ImportSeasonNflResultsResponse {
  nfl: SeasonNflOverview;
}

export interface UpsertSeasonWeekTeamResultResponse {
  nfl: SeasonWeekNflResults;
}

export interface PostSeasonNflResultsToLedgerResponse {
  nflLedger: SeasonNflLedgerPostingPreview;
}
