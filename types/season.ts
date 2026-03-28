export interface SeasonSummary {
  id: string;
  leagueId: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  isLocked: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
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
