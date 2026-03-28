export type IngestionProvider = "MANUAL" | "ESPN" | "SLEEPER" | "CSV";
export type IngestionImportType = "SEASON_STANDINGS" | "WEEKLY_STANDINGS";
export type IngestionRunStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type MappingStatus = "MATCHED" | "REQUIRES_REVIEW" | "UNMATCHED";

export interface SeasonSourceConfigSummary {
  id: string;
  seasonId: string;
  provider: IngestionProvider;
  externalLeagueId: string | null;
  externalSeasonKey: string | null;
  config: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSeasonSourceConfigInput {
  seasonId: string;
  provider: IngestionProvider;
  externalLeagueId?: string;
  externalSeasonKey?: string;
  config?: Record<string, string | number | boolean | null>;
  actingUserId: string;
}

export interface ImportedRecordMappingCandidate {
  externalEntityId: string;
  externalDisplayName: string;
  suggestedLeagueMemberId: string | null;
  matchedLeagueMemberId: string | null;
  status: MappingStatus;
  confidenceScore: number | null;
}

export interface NormalizedSeasonStandingRecord {
  externalEntityId: string;
  externalDisplayName: string;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  playoffFinish: string | null;
  isChampion: boolean | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface NormalizedWeeklyStandingRecord {
  externalEntityId: string;
  externalDisplayName: string;
  weekNumber: number;
  rank: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  result: string | null;
  opponentExternalEntityId: string | null;
  opponentDisplayName: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface NormalizedImportPreview {
  provider: IngestionProvider;
  importType: IngestionImportType;
  seasonId: string;
  seasonLabel: string;
  weekNumber: number | null;
  records: {
    seasonStandings: NormalizedSeasonStandingRecord[];
    weeklyStandings: NormalizedWeeklyStandingRecord[];
  };
  mappings: ImportedRecordMappingCandidate[];
  warnings: string[];
  missingFields: string[];
  sourceSummary: {
    recordCount: number;
    supportsSeasonStandings: boolean;
    supportsWeeklyStandings: boolean;
    providerNotes: string[];
  };
}

export interface PreviewIngestionInput {
  seasonId: string;
  provider: IngestionProvider;
  importType: IngestionImportType;
  weekNumber?: number;
  csvContent?: string;
  externalLeagueId?: string;
  externalSeasonKey?: string;
  config?: Record<string, string | number | boolean | null>;
}

export interface RunIngestionInput extends PreviewIngestionInput {
  actingUserId: string;
  mappingOverrides?: Record<string, string>;
}

export interface IngestionRunSummary {
  id: string;
  provider: IngestionProvider;
  importType: IngestionImportType;
  status: IngestionRunStatus;
  weekNumber: number | null;
  actingUserId: string | null;
  startedAt: string;
  completedAt: string | null;
  warnings: string[];
  errorMessage: string | null;
  sourceSummary: {
    recordCount: number;
    supportsSeasonStandings: boolean;
    supportsWeeklyStandings: boolean;
    providerNotes: string[];
  } | null;
}

export interface SeasonSourceConfigResponse {
  configs: SeasonSourceConfigSummary[];
}

export interface SaveSeasonSourceConfigResponse {
  config: SeasonSourceConfigSummary;
}

export interface PreviewIngestionResponse {
  preview: NormalizedImportPreview;
}

export interface RunIngestionResponse {
  run: IngestionRunSummary;
  importedCounts: {
    seasonStandings: number;
    weeklyStandings: number;
    mappingsStored: number;
  };
}

export interface IngestionRunListResponse {
  runs: IngestionRunSummary[];
}
