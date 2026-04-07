# Analytics Metric Definitions

This file is the shared data dictionary for the read-only analytics layer.

Use it together with:
- `server/services/analytics-service.ts`
- `types/analytics.ts`
- `components/analytics/*`

## Scope

These metrics are:
- read-only
- derived from persisted source-of-truth records
- season-scoped or league-history-scoped as noted below

These metrics do not create new source-of-truth records.

## Source-of-Truth Boundaries

- `TeamOwnership` = season ownership truth
- `SeasonStanding` = final fantasy standings truth
- `LedgerEntry` = money / winnings truth
- `Season.leaguePhase` = workflow truth
- `SeasonNflTeamResult` = persisted NFL results truth

## Shared Definitions

### Season ledger total
Sum of all persisted `LedgerEntry.amount` values for one `leagueMemberId` in one season.

Includes whatever was actually posted for that season, such as:
- `FANTASY_PAYOUT`
- `NFL_REGULAR_SEASON`
- `NFL_PLAYOFF`
- `MANUAL_ADJUSTMENT`

### Winning percentage
Used for both fantasy and NFL win-rate analytics.

Formula:
- `(wins + 0.5 * ties) / (wins + losses + ties)`

Returns `null` when no games are available.

## League Overview Metrics

### `totalLeaguePayouts`
Definition:
- Sum of each season's net posted ledger total across all tracked seasons.

Source:
- `LedgerEntry`

### `averageSeasonParityGap`
Definition:
- Average per-season spread between the highest and lowest owner season ledger totals.

Formula:
- for each season: `max(owner season ledger total) - min(owner season ledger total)`
- average those season spreads

Source:
- `LedgerEntry`

### `biggestCareerWinner`
Definition:
- Owner with the highest cumulative posted ledger total across all tracked seasons.

### `biggestCareerLoser`
Definition:
- Owner with the lowest cumulative posted ledger total across all tracked seasons.

### `seasonSummaries`
Definition:
- Per-season snapshot containing:
  - season net ledger total
  - biggest season winner
  - biggest season loser
  - season parity gap

## Owner Analytics Metrics

### `totalSeasonsParticipated`
Definition:
- Count of seasons where the owner had at least one of:
  - season ownership
  - saved final standings
  - non-zero posted ledger total

### `totalEarnings`
Definition:
- Sum of season ledger totals across all tracked seasons for that owner.

Source:
- `LedgerEntry`

### `averageFinish`
Definition:
- Average saved final standing rank across seasons where a final standing exists.

Interpretation:
- lower is better because rank `1` is first place

Source:
- `SeasonStanding.rank`

### `fantasyWinRate`
Definition:
- Average of the owner's per-season fantasy winning percentages across seasons where standing win/loss/tie data exists.

Source:
- `SeasonStanding.wins`
- `SeasonStanding.losses`
- `SeasonStanding.ties`

### `nflWinRate`
Definition:
- Average of the owner's per-season NFL winning percentages across seasons where persisted NFL team results are tied to that owner.

Source:
- `SeasonNflTeamResult`
- season-scoped ownership/member mapping

### `performanceTrend`
Definition:
- Season-by-season analytics rows used to show:
  - season ledger total
  - final finish
  - fantasy win rate
  - NFL win rate

## Franchise Analytics Metrics

### `ownershipCount`
Definition:
- Number of season ownership records for the franchise across tracked seasons.

Source:
- `TeamOwnership`

### `totalRegularSeasonWins`
Definition:
- Count of persisted `SeasonNflTeamResult` rows for the franchise with:
  - `phase = REGULAR_SEASON`
  - `result = WIN`

### `totalPlayoffWins`
Definition:
- Count of persisted `SeasonNflTeamResult` rows for the franchise with:
  - playoff phase
  - `result = WIN`

### `totalNflLedgerAmount`
Definition:
- Analytics mirror of the current NFL posting formula.

Formula:
- `regular-season wins + playoff wins`

Important note:
- this is an analytic restatement of the current NFL posting logic
- it is not an independently configured finance engine

### `averageNflLedgerAmountPerSeason`
Definition:
- `totalNflLedgerAmount / seasons with persisted NFL result rows for that team`

### `mostProfitableTeams`
Definition:
- Franchises ranked by `totalNflLedgerAmount`

### `bestHistoricalTeams`
Definition:
- Franchises ranked by `totalRegularSeasonWins + totalPlayoffWins`

## Draft Analytics Metrics

### `mostDraftedTeams`
Definition:
- Teams selected through non-keeper replacement draft picks most often.

Source:
- `DraftPick`

### `mostKeptTeams`
Definition:
- Teams recorded as keepers most often before the replacement draft.

Source:
- `KeeperSelection`

### `draftSlotOutcomes`
Definition:
- Outcome rollup by replacement draft slot.

For each draft slot:
- average target-season final finish
- average target-season full ledger total
- sample size

Important note:
- this is descriptive analytics, not causal proof that a slot created the result

### `replacementDraftEffectiveness`
Definition:
- Draft-by-draft audit rows showing:
  - who picked at each slot
  - which team was selected
  - that owner's target-season finish
  - that owner's target-season ledger total
  - the selected team's persisted NFL results in that target season

## Consistency Rules

When adding or changing analytics:
- define the metric in `server/services/analytics-service.ts`
- keep DTO names in `types/analytics.ts` aligned with that definition
- keep UI descriptions in `components/analytics/*` aligned with the same wording
- update this file if a metric definition changes

If a future change alters the meaning of a metric, update:
1. service comments
2. DTO comments
3. UI copy
4. this file
