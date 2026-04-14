import type { DraftStatus, DraftTeamSummary } from "@/types/draft";

export type InauguralAuctionOrderMethod = "ALPHABETICAL" | "DIVISION" | "PREVIOUS_YEAR_RECORD";

export interface InauguralAuctionOwnerSummary {
  leagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  profileImageUrl?: string | null;
  role: "COMMISSIONER" | "OWNER";
  teamCount: number;
  budgetSpent: number;
  budgetRemaining: number;
  isComplete: boolean;
  awardedTeams: DraftTeamSummary[];
  maxAllowedBid: number;
  canBid: boolean;
}

export interface InauguralAuctionNominationSummary {
  id: string;
  nflTeam: DraftTeamSummary;
  orderIndex: number;
  isAwarded: boolean;
  awardedToLeagueMemberId: string | null;
}

export interface InauguralAuctionBidSummary {
  id: string;
  leagueMemberId: string;
  displayName: string;
  profileImageUrl?: string | null;
  amount: number;
  createdAt: string;
}

export interface InauguralAuctionAwardSummary {
  id: string;
  nominationId: string;
  leagueMemberId: string;
  displayName: string;
  profileImageUrl?: string | null;
  nflTeam: DraftTeamSummary;
  amount: number;
  awardedAt: string;
}

export interface InauguralAuctionFinalSummary {
  biggestSpender: {
    leagueMemberId: string;
    displayName: string;
    amount: number;
  } | null;
  lowestSpender: {
    leagueMemberId: string;
    displayName: string;
    amount: number;
  } | null;
  remainingBudgets: Array<{
    leagueMemberId: string;
    displayName: string;
    budgetRemaining: number;
  }>;
  owners: Array<{
    leagueMemberId: string;
    displayName: string;
    budgetSpent: number;
    budgetRemaining: number;
    teams: DraftTeamSummary[];
  }>;
  unassignedTeams: DraftTeamSummary[];
  awardsByDivision: Array<{
    division: string;
    awardedCount: number;
  }>;
}

export interface InauguralAuctionState {
  auction: {
    id: string;
    seasonId: string;
    leagueId: string;
    status: DraftStatus;
    orderMethod: InauguralAuctionOrderMethod;
    currentNominationIndex: number;
    nominationCount: number;
    awardedCount: number;
    announcementEndsAt: string | null;
    completedAt: string | null;
  };
  orderNotes: string[];
  currentNomination: InauguralAuctionNominationSummary | null;
  currentHighBid: InauguralAuctionBidSummary | null;
  recentBids: InauguralAuctionBidSummary[];
  nominations: InauguralAuctionNominationSummary[];
  owners: InauguralAuctionOwnerSummary[];
  countdown: {
    startedAt: string | null;
    expiresAt: string | null;
    secondsRemaining: number;
    isExtendedWindow: boolean;
  } | null;
  activeAward: InauguralAuctionAwardSummary | null;
  finalSummary: InauguralAuctionFinalSummary | null;
  viewer: {
    leagueMemberId: string | null;
    role: "COMMISSIONER" | "OWNER" | null;
    canManageAuction: boolean;
    canBid: boolean;
    budgetRemaining: number | null;
    teamCount: number | null;
    maxAllowedBid: number | null;
  };
}

export interface ConfigureInauguralAuctionInput {
  seasonId: string;
  actingUserId: string;
  orderMethod: InauguralAuctionOrderMethod;
  divisionOrder?: string[];
}

export interface StartInauguralAuctionInput {
  seasonId: string;
  actingUserId: string;
}

export interface SubmitInauguralBidInput {
  seasonId: string;
  actingUserId: string;
  amount: number;
}

export interface InauguralAuctionStateResponse {
  auction: InauguralAuctionState | null;
}

export interface ConfigureInauguralAuctionResponse {
  auction: InauguralAuctionState;
}

export interface StartInauguralAuctionResponse {
  auction: InauguralAuctionState;
}

export interface SubmitInauguralBidResponse {
  auction: InauguralAuctionState;
}
