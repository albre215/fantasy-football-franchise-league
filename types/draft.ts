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
  draftedTeam: DraftTeamSummary | null;
  keeperCount: number;
  isKeeperComplete: boolean;
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
  picks: DraftPickSummary[];
  currentPick: DraftPickSummary | null;
  canFinalize: boolean;
  canStart: boolean;
  keeperProgress: {
    completeOwners: number;
    totalOwners: number;
    isComplete: boolean;
  };
}

export interface DraftOrderRecommendationEntry {
  leagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  role: "COMMISSIONER" | "OWNER";
  sourceSeasonRank: number;
  draftSlot: number;
}

export interface DraftOrderRecommendation {
  sourceSeasonId: string;
  sourceSeasonName: string | null;
  sourceSeasonYear: number;
  champion: {
    leagueMemberId: string;
    userId: string;
    displayName: string;
  } | null;
  lastPlace: {
    leagueMemberId: string;
    userId: string;
    displayName: string;
  } | null;
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

export interface InitializeDraftResponse {
  draft: DraftState;
}

export interface DraftStateResponse {
  draft: DraftState | null;
}

export interface DraftOrderRecommendationResponse {
  recommendation: DraftOrderRecommendation;
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
