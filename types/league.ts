import type { SeasonSetupStatus, SeasonSummary } from "@/types/season";

export interface LeagueListItem {
  id: string;
  leagueCode: string | null;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  seasonCount: number;
  currentUserRole?: "COMMISSIONER" | "OWNER";
}

export interface LeagueMemberSummary {
  id: string;
  role: "COMMISSIONER" | "OWNER";
  joinedAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    profileImageUrl?: string | null;
  };
}

export interface LeagueSeasonSummary {
  id: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  isLocked: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface LeagueDashboard {
  id: string;
  leagueCode: string | null;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  members: LeagueMemberSummary[];
  seasons: LeagueSeasonSummary[];
}

export interface CreateLeagueInput {
  userId: string;
  name: string;
  description?: string;
}

export interface JoinLeagueInput {
  userId: string;
  leagueCode: string;
}

export interface CreateLeagueResponse {
  league: LeagueDashboard;
}

export interface JoinLeagueResponse {
  league: LeagueDashboard;
}

export interface JoinLeagueSuggestion {
  id: string;
  leagueCode: string;
  name: string;
  memberCount: number;
  seasonCount: number;
}

export interface JoinLeagueSuggestionsResponse {
  suggestions: JoinLeagueSuggestion[];
}

export interface ListLeaguesResponse {
  leagues: LeagueListItem[];
}

export interface LeagueDashboardResponse {
  league: LeagueDashboard;
}

export interface AddLeagueMemberInput {
  leagueId: string;
  displayName: string;
  email: string;
  actingUserId: string;
  mockUserKey?: string;
}

export interface RemoveLeagueMemberInput {
  leagueId: string;
  leagueMemberId: string;
  actingUserId: string;
}

export interface ReplaceLeagueMemberInput {
  leagueId: string;
  leagueMemberId: string;
  displayName: string;
  email: string;
  actingUserId: string;
  mockUserKey?: string;
}

export interface LeagueBootstrapMember {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  phoneNumber: string | null;
  profileImageUrl?: string | null;
  role: "COMMISSIONER" | "OWNER";
  joinedAt: string;
  assignmentCount: number;
  canRemove: boolean;
}

export interface LeagueBootstrapState {
  league: {
    id: string;
    leagueCode: string | null;
    name: string;
    slug: string;
    description: string | null;
    commissioner: {
      leagueMemberId: string;
      userId: string;
      displayName: string;
      email: string;
      profileImageUrl?: string | null;
    } | null;
  };
  memberCount: number;
  members: LeagueBootstrapMember[];
  activeSeason: SeasonSummary | null;
  assignedTeamCount: number;
  unassignedTeamCount: number;
  everyMemberHasExactlyThreeTeams: boolean;
  validationStatus: SeasonSetupStatus | null;
  lockReadiness: {
    hasActiveSeason: boolean;
    hasExactlyTenMembers: boolean;
    hasThirtyAssignedTeams: boolean;
    hasTwoUnassignedTeams: boolean;
    everyMemberHasExactlyThreeTeams: boolean;
    isReadyToLock: boolean;
    state: "NOT_READY" | "READY_TO_LOCK" | "LOCKED";
  };
}

export interface AddLeagueMemberResponse {
  member: LeagueBootstrapMember;
}

export interface LeagueMembersListResponse {
  members: LeagueBootstrapMember[];
}

export interface RemoveLeagueMemberResponse {
  removedLeagueMemberId: string;
}

export interface ReplaceLeagueMemberResponse {
  member: LeagueBootstrapMember;
}

export interface LeagueBootstrapStateResponse {
  bootstrapState: LeagueBootstrapState;
}
