import type { DraftStatus, DraftTeamSummary } from "@/types/draft";

export interface OwnerLeagueMembershipSummary {
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  role: "COMMISSIONER" | "OWNER";
  joinedAt: string;
}

export interface OwnerActiveSeasonSummary {
  leagueId: string;
  leagueName: string;
  seasonId: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  isLocked: boolean;
}

export interface OwnerCurrentSeasonTeamsSummary {
  leagueId: string;
  leagueName: string;
  season: OwnerActiveSeasonSummary;
  teams: DraftTeamSummary[];
}

export interface OwnerHistoryEntry {
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonYear: number;
  seasonName: string | null;
  teams: DraftTeamSummary[];
  finalPlacement: number | null;
  isChampion: boolean | null;
}

export interface OwnerOffseasonContextSummary {
  leagueId: string;
  leagueName: string;
  targetSeasonId: string;
  targetSeasonYear: number;
  targetSeasonName: string | null;
  sourceSeasonId: string;
  sourceSeasonYear: number;
  sourceSeasonName: string | null;
  draftStatus: DraftStatus;
  previousSeasonTeams: DraftTeamSummary[];
  keepers: DraftTeamSummary[];
  draftedTeam: DraftTeamSummary | null;
  keeperCount: number;
  keeperEligibleCount: number;
  draftPosition: number | null;
  currentPickNumber: number | null;
  isOnClock: boolean;
}

export interface OwnerDashboardSummary {
  user: {
    id: string;
    displayName: string;
    email: string;
  };
  leagues: OwnerLeagueMembershipSummary[];
  activeSeasons: OwnerActiveSeasonSummary[];
  currentTeams: OwnerCurrentSeasonTeamsSummary[];
  history: OwnerHistoryEntry[];
  offseasonContext: OwnerOffseasonContextSummary[];
}

export interface OwnerDashboardResponse extends OwnerDashboardSummary {}
