import type { DraftStatus, DraftTeamSummary } from "@/types/draft";
import type { HistoricalAcquisitionType, HistoryTeamSummary } from "@/types/history";
import type { LedgerEntryCategory } from "@/types/ledger";
import type { LeaguePhase } from "@/types/season";

export interface OwnerLeagueMembershipSummary {
  leagueId: string;
  leagueCode: string | null;
  leagueName: string;
  leagueSlug: string;
  role: "COMMISSIONER" | "OWNER";
  joinedAt: string;
}

export interface OwnerStandingSummary {
  rank: number;
  isChampion: boolean;
}

export interface OwnerDraftStatusSummary {
  status: DraftStatus;
  draftPosition: number | null;
  currentPickNumber: number | null;
  picksCompleted: number;
  totalPicks: number;
  isOnClock: boolean;
  draftedTeam: DraftTeamSummary | null;
}

export interface OwnerCurrentSeasonSummary {
  leagueId: string;
  leagueCode: string | null;
  leagueName: string;
  seasonId: string;
  seasonYear: number;
  seasonName: string | null;
  seasonStatus: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  phase: LeaguePhase;
  role: "COMMISSIONER" | "OWNER";
  teams: DraftTeamSummary[];
  ledgerTotal: number;
  standing: OwnerStandingSummary | null;
  draftStatus: OwnerDraftStatusSummary | null;
}

export interface OwnerFinancialSeasonSummary {
  leagueId: string;
  leagueCode: string | null;
  leagueName: string;
  seasonId: string;
  seasonYear: number;
  seasonName: string | null;
  entryCount: number;
  totalPositive: number;
  totalNegative: number;
  ledgerTotal: number;
}

export interface OwnerHistoryTeamSummary {
  team: HistoryTeamSummary;
  slot: number;
  acquisitionType: HistoricalAcquisitionType;
  draftPickNumber: number | null;
}

export interface OwnerHistorySeasonSummary {
  leagueId: string;
  leagueCode: string | null;
  leagueName: string;
  seasonId: string;
  seasonYear: number;
  seasonName: string | null;
  teams: OwnerHistoryTeamSummary[];
  finalPlacement: number | null;
  isChampion: boolean | null;
  ledgerTotal: number;
}

export interface OwnerDashboardSummary {
  user: {
    id: string;
    displayName: string;
    email: string;
    profileImageUrl?: string | null;
  };
  memberships: OwnerLeagueMembershipSummary[];
  currentSeasons: OwnerCurrentSeasonSummary[];
  featuredSeasonId: string | null;
  financialSummary: {
    currentSeasonTotal: number;
    cumulativeEarnings: number;
    seasons: OwnerFinancialSeasonSummary[];
  };
  history: OwnerHistorySeasonSummary[];
}

export interface OwnerSeasonLedgerEntrySummary {
  id: string;
  category: LedgerEntryCategory;
  amount: number;
  description: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface OwnerDropPhaseDetail {
  sourceSeasonId: string | null;
  sourceSeasonYear: number | null;
  sourceSeasonName: string | null;
  eligibleTeams: DraftTeamSummary[];
  keptTeams: DraftTeamSummary[];
  releasedTeam: DraftTeamSummary | null;
  isComplete: boolean;
  warnings: string[];
}

export interface OwnerDraftPhaseDetail {
  status: DraftStatus;
  draftPosition: number | null;
  currentPickNumber: number | null;
  picksCompleted: number;
  totalPicks: number;
  isOnClock: boolean;
  draftedTeam: DraftTeamSummary | null;
}

export interface OwnerSeasonSummary {
  user: {
    id: string;
    displayName: string;
    email: string;
    profileImageUrl?: string | null;
  };
  membership: {
    leagueMemberId: string;
    role: "COMMISSIONER" | "OWNER";
  };
  season: {
    id: string;
    leagueId: string;
    leagueCode: string | null;
    leagueName: string;
    year: number;
    name: string | null;
    status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
    phase: LeaguePhase;
  };
  teams: DraftTeamSummary[];
  ledger: {
    total: number;
    entryCount: number;
    entries: OwnerSeasonLedgerEntrySummary[];
  };
  standing: OwnerStandingSummary | null;
  dropPhase: OwnerDropPhaseDetail | null;
  draftPhase: OwnerDraftPhaseDetail | null;
}

export interface OwnerDashboardResponse extends OwnerDashboardSummary {}

export interface OwnerSeasonResponse {
  season: OwnerSeasonSummary;
}
