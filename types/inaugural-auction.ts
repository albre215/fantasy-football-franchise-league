import type { DraftStatus, DraftTeamSummary } from "@/types/draft";

export type InauguralAuctionOrderMethod = "ALPHABETICAL" | "DIVISION" | "PREVIOUS_YEAR_RECORD" | "CUSTOM";
export type InauguralAuctionPreviousYearSortDirection = "BEST_FIRST" | "WORST_FIRST";

export interface InauguralAuctionOrderPreviewEntry {
  orderIndex: number;
  nflTeam: DraftTeamSummary;
  note: string | null;
}

export interface InauguralAuctionOrderPreview {
  orderMethod: InauguralAuctionOrderMethod;
  notes: string[];
  divisionOrder: string[] | null;
  entries: InauguralAuctionOrderPreviewEntry[];
}

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

export type AuctionAwardSource = "BID" | "AUTO_ASSIGN" | "SIMULATED" | "FINAL_SELECTION";

export interface InauguralAuctionAwardSummary {
  id: string;
  nominationId: string;
  leagueMemberId: string;
  displayName: string;
  profileImageUrl?: string | null;
  nflTeam: DraftTeamSummary;
  amount: number;
  awardedAt: string;
  source: AuctionAwardSource;
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
  mostBidsByOwner: Array<{ leagueMemberId: string; displayName: string; bidCount: number }>;
  leastBidsByOwner: Array<{ leagueMemberId: string; displayName: string; bidCount: number }>;
  mostBidsOnTeams: Array<{ team: DraftTeamSummary; bidCount: number }>;
  leastBidsOnTeams: Array<{ team: DraftTeamSummary; bidCount: number }>;
  highestWinningBid: { team: DraftTeamSummary; displayName: string; amount: number } | null;
  lowestWinningBid: { team: DraftTeamSummary; displayName: string; amount: number } | null;
  dollarSales: Array<{ team: DraftTeamSummary; displayName: string }>;
  autoAssignedAwards: Array<{ team: DraftTeamSummary; displayName: string; amount: number }>;
  longestBiddingWar: { team: DraftTeamSummary; bidCount: number } | null;
  averageWinningBid: number;
  closestAuction: { team: DraftTeamSummary; displayName: string; winningAmount: number; runnerUpAmount: number; margin: number } | null;
  biggestOverbid: { team: DraftTeamSummary; displayName: string; winningAmount: number; runnerUpAmount: number; margin: number } | null;
  totalSpent: number;
  totalRemaining: number;
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
  orderPreview: InauguralAuctionOrderPreview;
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
  finalSelection:
    | {
        leagueMemberId: string;
        displayName: string;
        availableTeams: Array<{
          nominationId: string;
          team: DraftTeamSummary;
        }>;
        automaticBidAmount: number;
      }
    | null;
  activeAward: InauguralAuctionAwardSummary | null;
  finalSummary: InauguralAuctionFinalSummary | null;
  presentMemberIds: string[];
  viewer: {
    leagueMemberId: string | null;
    role: "COMMISSIONER" | "OWNER" | null;
    canManageAuction: boolean;
    canBid: boolean;
    canSelectFinalTeam: boolean;
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
  customTeamOrder?: string[];
  previousYearSortDirection?: InauguralAuctionPreviousYearSortDirection;
}

export interface StartInauguralAuctionInput {
  seasonId: string;
  actingUserId: string;
}

export interface SubmitInauguralBidInput {
  seasonId: string;
  actingUserId: string;
  amount: number;
  nominationId?: string;
}

export interface InauguralAuctionStateResponse {
  auction: InauguralAuctionState | null;
}

export interface ConfigureInauguralAuctionResponse {
  auction: InauguralAuctionState;
}

export interface InauguralAuctionOrderPreviewResponse {
  preview: InauguralAuctionOrderPreview;
}

export interface StartInauguralAuctionResponse {
  auction: InauguralAuctionState;
}

export interface SubmitInauguralBidResponse {
  auction: InauguralAuctionState;
}
