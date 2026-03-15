export interface LeagueListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  seasonCount: number;
}

export interface LeagueMemberSummary {
  id: string;
  role: "COMMISSIONER" | "OWNER";
  joinedAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
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
  leagueId: string;
}

export interface CreateLeagueResponse {
  league: LeagueDashboard;
}

export interface JoinLeagueResponse {
  league: LeagueDashboard;
}

export interface ListLeaguesResponse {
  leagues: LeagueListItem[];
}

export interface LeagueDashboardResponse {
  league: LeagueDashboard;
}
