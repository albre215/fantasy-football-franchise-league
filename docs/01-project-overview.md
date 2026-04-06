# GM Fantasy

## Project Name
GM Fantasy

## What This App Is For
GM Fantasy is a commissioner-first web application for running a long-lived fantasy football league where owners control NFL franchises instead of fantasy player rosters.

The application is built around preserving historical league state:
- which owner controlled which NFL teams in each season
- how final fantasy standings finished each season
- how season money results accumulated in the ledger
- how offseason keeper and draft decisions changed ownership
- how those records feed history, analytics, and future automation

## Core League Concept
- 10 owners in the league
- owners control NFL teams, not fantasy players
- 32 NFL teams total
- each owner ends each season with exactly 3 teams
- 2 NFL teams remain unassigned each season
- ownership is season-scoped and historically preserved

## Current Yearly Lifecycle

1. In-season operations
- a season is active and typically in `IN_SEASON`
- NFL results import automatically for the active season
- commissioner can review or correct weekly NFL outcomes if needed

2. End-of-season results
- the commissioner manually records the final 1st through 10th place fantasy standings
- `SeasonStanding` remains the final fantasy-history truth

3. Financial posting
- fantasy placements are converted into `FANTASY_PAYOUT` ledger entries
- NFL-side season results also contribute to owner-level money outcomes
- `LedgerEntry` is the money truth for the season

4. Offseason recommendation
- the next offseason draft recommendation is derived from the immediately previous season's total ledger winnings
- order runs from lowest total winnings to highest total winnings
- standings are used only as a deterministic tie-break fallback

5. League phase progression
- the target season moves through explicit workflow phases:
  - `IN_SEASON`
  - `POST_SEASON`
  - `DROP_PHASE`
  - `DRAFT_PHASE`

6. DROP_PHASE keeper / release workflow
- in `DROP_PHASE`, each owner keeps exactly 2 teams from the previous season
- each owner explicitly releases exactly 1 team
- the released-team pool becomes reviewable league-wide before the draft starts

7. Replacement draft execution
- in `DRAFT_PHASE`, the commissioner runs a one-pick-per-owner replacement draft
- the draft pool comes only from the explicit released-team pool
- finalizing the draft creates the authoritative `TeamOwnership` rows for the target season

8. History and analytics
- historical ownership, ledger, standings, and draft records remain queryable for history and analytics

## Current Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL / Neon-style hosted Postgres via `DATABASE_URL`
- NextAuth credentials authentication
- Node.js

## Product Goals
- long-term league management
- multi-season history
- franchise ownership tracking
- season financial tracking
- offseason keeper and draft management
- league lifecycle control through phases
- historical analytics
- real authentication and safer mutation access

## Current Philosophy
- preserve clean domain boundaries
- avoid redesigning core Prisma models unless clearly necessary
- keep season-scoped ownership historically meaningful
- keep `TeamOwnership` as the authoritative source of season ownership
- keep `SeasonStanding` as the authoritative source of final fantasy standings
- keep `LedgerEntry` as the authoritative source of money / winnings
- keep `Season.leaguePhase` as workflow state
- keep offseason records historically queryable through `Draft`, `DraftPick`, and `KeeperSelection`

## Current Product Direction
The current app favors a commissioner-driven workflow over external integrations:
- final fantasy standings are entered manually
- NFL results are provider-backed and imported automatically for the active season
- fantasy payouts are posted into the ledger from saved standings
- offseason draft order is derived from previous-season ledger totals
- offseason workflow is explicitly gated by persisted league phases

Provider-based ingestion code still exists in the repo, but manual standings remain the primary fantasy-results workflow.
