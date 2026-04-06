export type DraftStatus = "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

export interface DraftTeamSummary {
  id: string;
  name: string;
  abbreviation: string;
  conference: "AFC" | "NFC";
  division: string;
}

export interface DraftKeeperSelection {
  id: string;
  leagueMemberId: string;
  userId: string;
  displayName: string;
  nflTeam: DraftTeamSummary;
}

export interface DraftMemberSummary {
  leagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  role: "COMMISSIONER" | "OWNER";
  previousSeasonTeams: DraftTeamSummary[];
  keepers: DraftKeeperSelection[];
  releasedTeam: DraftTeamSummary | null;
  draftedTeam: DraftTeamSummary | null;
  replacementDraftSlot: number | null;
  hasPicked: boolean;
  keeperCount: number;
  isKeeperComplete: boolean;
}

export interface ReplacementDraftOrderEntry {
  draftSlot: number;
  leagueMemberId: string;
  userId: string;
  displayName: string;
  hasPicked: boolean;
  selectedTeam: DraftTeamSummary | null;
}

export interface DraftPickSummary {
  id: string;
  overallPickNumber: number;
  roundNumber: number;
  roundPickNumber: number;
  selectingLeagueMemberId: string;
  selectingDisplayName: string;
  selectedNflTeam: DraftTeamSummary | null;
  pickedAt: string | null;
}

export interface DraftSummary {
  id: string;
  leagueId: string;
  targetSeasonId: string;
  sourceSeasonId: string;
  targetSeasonName: string | null;
  targetSeasonYear: number;
  sourceSeasonName: string | null;
  sourceSeasonYear: number;
  status: DraftStatus;
  currentPick: number;
  completedAt: string | null;
  keeperCount: number;
  picksCompleted: number;
  totalPicks: number;
  isTargetSeasonLocked: boolean;
}

export interface DraftState {
  draft: DraftSummary;
  members: DraftMemberSummary[];
  draftPool: DraftTeamSummary[];
  releasedTeamPool: DraftTeamSummary[];
  remainingTeams: DraftTeamSummary[];
  replacementDraftOrder: ReplacementDraftOrderEntry[];
  picks: DraftPickSummary[];
  currentPick: DraftPickSummary | null;
  currentDrafter: ReplacementDraftOrderEntry | null;
  canFinalize: boolean;
  canStart: boolean;
  keeperEditing: {
    canEdit: boolean;
    isLocked: boolean;
    lockReason: string | null;
  };
  keeperProgress: {
    completeOwners: number;
    totalOwners: number;
    isComplete: boolean;
  };
  readiness: {
    isReady: boolean;
    warnings: string[];
  };
}

export interface DropPhaseOwnerSummary {
  sourceLeagueMemberId: string | null;
  targetLeagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  role: "COMMISSIONER" | "OWNER";
  eligibleTeams: DraftTeamSummary[];
  keptTeamIds: string[];
  keptTeams: DraftTeamSummary[];
  releasedTeam: DraftTeamSummary | null;
  isComplete: boolean;
  mappingStatus: "MAPPED" | "MISSING_SOURCE_OWNER";
  warnings: string[];
}

export interface DropPhaseContext {
  sourceSeasonId: string | null;
  sourceSeasonName: string | null;
  sourceSeasonYear: number | null;
  targetSeasonId: string;
  targetSeasonName: string | null;
  targetSeasonYear: number;
  currentPhase: import("@/types/season").LeaguePhase;
  hasDraftWorkspace: boolean;
  draftId: string | null;
  draftStatus: DraftStatus | null;
  ownersCompleteCount: number;
  ownersTotalCount: number;
  releasedTeamPool: DraftTeamSummary[];
  isReadyForDraftPhase: boolean;
  recommendationReadiness: {
    draftOrderReady: boolean;
    allTargetMappingsComplete: boolean;
    ledgerCoverageStatus: "NONE" | "PARTIAL" | "FULL";
  };
  warnings: string[];
  owners: DropPhaseOwnerSummary[];
}

export interface DraftOrderRecommendationEntry {
  leagueMemberId: string | null;
  sourceLeagueMemberId: string;
  targetLeagueMemberId: string | null;
  userId: string;
  displayName: string;
  email: string;
  role: "COMMISSIONER" | "OWNER";
  sourceSeasonRank: number | null;
  ledgerTotal: number;
  draftSlot: number;
  tieBreakReason: "LEDGER_TOTAL" | "FANTASY_RANK" | "DISPLAY_NAME";
  mappingStatus: "MAPPED" | "MISSING_TARGET_MEMBER";
  warnings: string[];
}

export interface DraftOrderRecommendation {
  sourceSeasonId: string;
  sourceSeasonName: string | null;
  sourceSeasonYear: number;
  lowestTotalOwner: {
    leagueMemberId: string | null;
    userId: string;
    displayName: string;
    ledgerTotal: number;
  } | null;
  highestTotalOwner: {
    leagueMemberId: string | null;
    userId: string;
    displayName: string;
    ledgerTotal: number;
  } | null;
  readiness: {
    hasAnyLedgerEntries: boolean;
    hasCompleteFantasyStandings: boolean;
    allTargetMappingsComplete: boolean;
    ownersWithLedgerEntries: number;
    zeroLedgerOwnerCount: number;
    ledgerCoverageStatus: "NONE" | "PARTIAL" | "FULL";
    isReady: boolean;
  };
  warnings: string[];
  entries: DraftOrderRecommendationEntry[];
}

export interface InitializeDraftInput {
  targetSeasonId: string;
  sourceSeasonId: string;
  actingUserId: string;
  orderLeagueMemberIds: string[];
}

export interface SaveKeepersInput {
  draftId: string;
  leagueMemberId: string;
  nflTeamIds: string[];
  actingUserId: string;
}

export interface StartDraftInput {
  draftId: string;
  actingUserId: string;
}

export interface MakeDraftPickInput {
  draftId: string;
  nflTeamId: string;
  actingUserId: string;
}

export interface FinalizeDraftInput {
  draftId: string;
  actingUserId: string;
}

export interface ResetDraftInput {
  targetSeasonId: string;
  actingUserId: string;
  force: boolean;
}

export interface OverrideDraftOrderInput {
  targetSeasonId: string;
  actingUserId: string;
  orderLeagueMemberIds: string[];
}

export interface InitializeDraftResponse {
  draft: DraftState;
}

export interface DraftStateResponse {
  draft: DraftState | null;
}

export interface DraftOrderRecommendationResponse {
  recommendation: DraftOrderRecommendation;
}

export interface DropPhaseContextResponse {
  dropPhase: DropPhaseContext;
}

export interface SaveKeepersResponse {
  draft: DraftState;
}

export interface StartDraftResponse {
  draft: DraftState;
}

export interface MakeDraftPickResponse {
  draft: DraftState;
}

export interface FinalizeDraftResponse {
  draft: DraftState;
}

export interface PauseDraftResponse {
  draft: DraftState;
}

export interface ResumeDraftResponse {
  draft: DraftState;
}

export interface ResetDraftResponse {
  removedDraftId: string;
  removedTargetSeasonOwnershipCount: number;
}

export interface OverrideDraftOrderResponse {
  draft: DraftState;
}
