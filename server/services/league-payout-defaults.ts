import type { FantasyPayoutConfigEntry } from "@/types/results";

export const DEFAULT_LEAGUE_MEMBER_COUNT = 10;
export const DEFAULT_LEAGUE_BUY_IN_PER_MEMBER = 200;
export const DEFAULT_LEAGUE_BUY_IN_TOTAL = DEFAULT_LEAGUE_MEMBER_COUNT * DEFAULT_LEAGUE_BUY_IN_PER_MEMBER;

export const DEFAULT_FANTASY_PAYOUT_CONFIG: FantasyPayoutConfigEntry[] = [
  { rank: 1, amount: 220 },
  { rank: 2, amount: 125 },
  { rank: 3, amount: 90 },
  { rank: 4, amount: 75 },
  { rank: 5, amount: 65 },
  { rank: 6, amount: 50 },
  { rank: 7, amount: 45 },
  { rank: 8, amount: 35 },
  { rank: 9, amount: 25 },
  { rank: 10, amount: 20 }
];

export const DEFAULT_NFL_REGULAR_SEASON_PAYOUT_CONFIG = {
  perWinAmount: 1.5,
  mostWinsBonus: 50,
  secondMostWinsBonus: 20,
  thirdMostWinsBonus: 10,
  leastWinsBonus: 12
} as const;

export const DEFAULT_NFL_PLAYOFF_PAYOUT_CONFIG = {
  superBowlChampion: 200,
  superBowlRunnerUp: 110,
  conferenceLoser: 75,
  divisionalLoser: 50,
  wildCardLoser: 15
} as const;
