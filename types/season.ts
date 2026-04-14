import type { DraftStatus } from "@/types/draft";

export type LeaguePhase = "IN_SEASON" | "POST_SEASON" | "DROP_PHASE" | "DRAFT_PHASE";
export type SeasonDraftMode = "CONTINUING_REPLACEMENT" | "INAUGURAL_AUCTION";

export interface SeasonSummary {
  id: string;
  leagueId: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  leaguePhase: LeaguePhase;
  draftMode: SeasonDraftMode;
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
  actingUserId: string;
  nextPhase: LeaguePhase;
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

export interface SeasonPhaseContext {
  season: {
    id: string;
    leagueId: string;
    year: number;
    name: string | null;
    status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
    leaguePhase: LeaguePhase;
    draftMode: SeasonDraftMode;
  };
  allowedActions: {
    canReviewResults: boolean;
    canReviewOffseasonRecommendation: boolean;
    canReviewDropPhase: boolean;
    canManageDraftWorkspace: boolean;
    canEditKeepers: boolean;
    canPrepareDraft: boolean;
    canEditDraft: boolean;
    canRunDraft: boolean;
    canEnterDropPhase: boolean;
  };
  readiness: {
    hasPreviousSeason: boolean;
    usesInauguralAuction: boolean;
    hasFinalStandings: boolean;
    hasFantasyPayoutsPublished: boolean;
    draftOrderReady: boolean;
    allTargetMappingsComplete: boolean;
    ledgerCoverageStatus: "NONE" | "PARTIAL" | "FULL";
    hasDraftWorkspace: boolean;
    draftStatus: DraftStatus | null;
    ownersWithCompletedKeeperSelections: number;
    ownersTotalCount: number;
    isReadyForDraftPhase: boolean;
  };
  availableTransitions: Array<{
    phase: LeaguePhase;
    isAvailable: boolean;
    warnings: string[];
  }>;
  warnings: string[];
}

export interface SeasonPhaseContextResponse {
  phase: SeasonPhaseContext;
}

export interface UpdateSeasonLeaguePhaseResponse {
  phase: SeasonPhaseContext;
}
