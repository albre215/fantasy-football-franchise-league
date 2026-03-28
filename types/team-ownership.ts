export interface NFLTeamSummary {
  id: string;
  name: string;
  abbreviation: string;
  conference: "AFC" | "NFC";
  division: string;
}

export interface TeamOwnershipEntry {
  id: string;
  slot: number;
  leagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  team: NFLTeamSummary;
}

export interface OwnerTeamGroup {
  leagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  role: "COMMISSIONER" | "OWNER";
  teamCount: number;
  teams: Array<{
    ownershipId: string;
    slot: number;
    team: NFLTeamSummary;
  }>;
}

export interface SeasonOwnershipSummary {
  seasonId: string;
  leagueId: string;
  seasonName: string | null;
  seasonYear: number;
  owners: OwnerTeamGroup[];
  availableTeams: NFLTeamSummary[];
}

export interface AssignTeamInput {
  seasonId: string;
  userId: string;
  nflTeamId: string;
  actingUserId: string;
}

export interface AssignTeamResponse {
  ownership: TeamOwnershipEntry;
  seasonOwnership: SeasonOwnershipSummary;
}

export interface RemoveTeamOwnershipInput {
  seasonId: string;
  teamOwnershipId: string;
  actingUserId: string;
}

export interface RemoveTeamOwnershipResponse {
  removedTeamOwnershipId: string;
  seasonOwnership: SeasonOwnershipSummary;
}

export interface SeasonOwnershipResponse {
  ownership: SeasonOwnershipSummary;
}

export interface NFLTeamsResponse {
  teams: NFLTeamSummary[];
}
