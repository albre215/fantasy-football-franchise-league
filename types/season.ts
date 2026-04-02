export type LeaguePhase = "IN_SEASON" | "POST_SEASON" | "DROP_PHASE" | "DRAFT_PHASE";

export type SeasonActionKey =
  | "REVIEW_RESULTS"
  | "REVIEW_OFFSEASON_RECOMMENDATION"
  | "ENTER_DROP_PHASE"
  | "PREPARE_DRAFT"
  | "EDIT_DRAFT"
  | "RUN_DRAFT";

export interface SeasonSummary {
  id: string;
  leagueId: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  leaguePhase: LeaguePhase;
  isLocked: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface SeasonNflSyncStatus {
  attempted: boolean;
  status: "PENDING" | "COMPLETED" | "FAILED";
  message: string | null;
}

export interface SeasonSetupStatus {
  seasonId: string;
  leagueId: string;
  memberCount: number;
  assignedTeamCount: number;
  unassignedTeamCount: number;
  hasExactlyTenMembers: boolean;
  eachMemberHasThreeTeams: boolean;
  hasThirtyAssignedTeams: boolean;
  hasTwoUnassignedTeams: boolean;
  isValid: boolean;
  ownerStatuses: Array<{
    leagueMemberId: string;
    userId: string;
    displayName: string;
    role: "COMMISSIONER" | "OWNER";
    assignedTeamCount: number;
    isValid: boolean;
  }>;
}

export interface CreateSeasonInput {
  leagueId: string;
  year: number;
  name?: string;
  actingUserId: string;
}

export interface SetActiveSeasonInput {
  leagueId: string;
  seasonId: string;
  actingUserId: string;
}

export interface UpdateSeasonYearInput {
  seasonId: string;
  year: number;
  actingUserId: string;
}

export interface UpdateSeasonLeaguePhaseInput {
  seasonId: string;
  nextPhase: LeaguePhase;
  actingUserId: string;
}

export interface SeasonPhaseContext {
  season: {
    id: string;
    leagueId: string;
    year: number;
    name: string | null;
    status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
    leaguePhase: LeaguePhase;
    isLocked: boolean;
  };
  allowedActions: {
    canReviewResults: boolean;
    canReviewOffseasonRecommendation: boolean;
    canEnterDropPhase: boolean;
    canPrepareDraft: boolean;
    canEditDraft: boolean;
    canRunDraft: boolean;
  };
  availableTransitions: Array<{
    nextPhase: LeaguePhase;
    warnings: string[];
  }>;
  warnings: string[];
  readiness: {
    hasPreviousSeason: boolean;
    hasFinalStandings: boolean;
    hasRecommendedDraftOrder: boolean;
    hasCompleteTargetMapping: boolean;
    hasDraftWorkspace: boolean;
    draftStatus: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | null;
    participantCount: number;
    mappedTargetMemberCount: number;
  };
}

export interface CreateSeasonResponse {
  season: SeasonSummary;
}

export interface SeasonListResponse {
  seasons: SeasonSummary[];
}

export interface ActiveSeasonResponse {
  season: SeasonSummary | null;
}

export interface SetActiveSeasonResponse {
  season: SeasonSummary;
  nflImport: SeasonNflSyncStatus | null;
}

export interface SeasonSetupStatusResponse {
  status: SeasonSetupStatus;
}

export interface LockSeasonResponse {
  season: SeasonSummary;
  status: SeasonSetupStatus;
}

export interface SeasonActorInput {
  seasonId: string;
  actingUserId: string;
}

export interface UnlockSeasonResponse {
  season: SeasonSummary;
}

export interface UpdateSeasonYearResponse {
  season: SeasonSummary;
  nflImport: SeasonNflSyncStatus | null;
}

export interface SeasonPhaseContextResponse {
  phase: SeasonPhaseContext;
}

export interface UpdateSeasonLeaguePhaseResponse {
  phase: SeasonPhaseContext;
  season: SeasonSummary;
}
