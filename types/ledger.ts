export type LedgerEntryCategory =
  | "MANUAL_ADJUSTMENT"
  | "FANTASY_PAYOUT"
  | "NFL_REGULAR_SEASON"
  | "NFL_PLAYOFF"
  | "UNUSED_TEAM_ALLOCATION";

export interface LedgerSeasonSummary {
  id: string;
  leagueId: string;
  year: number;
  name: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
}

export interface LedgerOwnerSummary {
  leagueMemberId: string;
  userId: string;
  displayName: string;
  email: string;
  role: "COMMISSIONER" | "OWNER";
}

export interface LedgerEntrySummary {
  id: string;
  leagueId: string;
  seasonId: string;
  leagueMemberId: string;
  owner: LedgerOwnerSummary;
  category: LedgerEntryCategory;
  amount: number;
  description: string;
  metadata: Record<string, unknown> | null;
  actingUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerOwnerBalance extends LedgerOwnerSummary {
  totalBalance: number;
  totalPositive: number;
  totalNegative: number;
  entryCount: number;
}

export interface SeasonLedgerSummary {
  season: LedgerSeasonSummary;
  balances: LedgerOwnerBalance[];
  entries: LedgerEntrySummary[];
  totals: {
    entryCount: number;
    totalPositive: number;
    totalNegative: number;
    net: number;
  };
}

export interface LeagueMemberSeasonLedger {
  season: LedgerSeasonSummary;
  member: LedgerOwnerBalance;
  entries: LedgerEntrySummary[];
  totals: {
    entryCount: number;
    totalPositive: number;
    totalNegative: number;
    net: number;
  };
}

export interface CreateManualAdjustmentInput {
  seasonId: string;
  leagueMemberId: string;
  amount: number;
  description: string;
  actingUserId: string;
  metadata?: Record<string, unknown> | null;
}

export interface SeasonLedgerResponse {
  ledger: SeasonLedgerSummary;
}

export interface LeagueMemberSeasonLedgerResponse {
  ledger: LeagueMemberSeasonLedger;
}

export interface CreateManualAdjustmentResponse {
  ledger: SeasonLedgerSummary;
  createdEntry: LedgerEntrySummary;
}
