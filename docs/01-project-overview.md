# GM Fantasy

## Project Name
GM Fantasy

## What This App Is For
GM Fantasy is a commissioner-first web application for running a long-lived fantasy football league where owners control NFL franchises instead of fantasy player rosters.

The app is designed around preserving league history:
- which owner slot controlled which NFL teams in each season
- how final fantasy standings finished each season
- how money accumulated in the ledger
- how offseason keeper and replacement-draft decisions changed ownership
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
- the commissioner can review or correct weekly NFL outcomes if needed

2. End-of-season fantasy results
- the commissioner manually records final 1st through 10th place fantasy standings
- `SeasonStanding` remains the final fantasy-history truth

3. Financial posting
- fantasy placements are converted into `FANTASY_PAYOUT` ledger entries
- NFL-side season results can also contribute to owner-level money outcomes
- `LedgerEntry` is the money truth for the season

4. Offseason recommendation
- the next offseason replacement-draft recommendation is derived from the immediately previous season's total ledger winnings
- order runs from lowest total winnings to highest total winnings
- fantasy standings are used only as deterministic tie-break support

5. League phase progression
- the target season moves through explicit workflow phases:
  - `IN_SEASON`
  - `POST_SEASON`
  - `DROP_PHASE`
  - `DRAFT_PHASE`
- these phases are part of the app's workflow engine and service logic
- the product direction is for phase mechanics to stay mostly in the background rather than becoming user-facing clutter

6. DROP_PHASE keeper / release workflow
- in `DROP_PHASE`, each owner keeps exactly 2 teams from the previous season
- each owner explicitly releases exactly 1 team
- the released-team pool becomes reviewable league-wide before the draft starts

7. Ownership assignment execution
- continuing leagues use the keeper / replacement-draft flow in `DRAFT_PHASE`
- inaugural leagues use a live inaugural auction with budgets, nomination order, timed bidding, and award finalization
- both paths end by writing the authoritative target-season `TeamOwnership` rows

8. History and analytics
- historical ownership, ledger, standings, and draft records remain queryable for history and analytics
- analytics metrics are read-only derived views and have a shared metric dictionary

## Current Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL / Neon-style hosted Postgres via `DATABASE_URL`
- NextAuth credentials authentication
- Resend for password reset email delivery
- Twilio Verify for temporary phone verification login
- Node.js

## Product Goals
- long-term league management
- multi-season history
- stable member-slot continuity even when the person in that slot changes
- franchise ownership tracking
- season financial tracking
- offseason keeper and replacement-draft management
- league lifecycle control through phases
- historical analytics
- real authentication and safer recovery flows

## Current Philosophy
- preserve clean domain boundaries
- avoid redesigning core Prisma models unless clearly necessary
- keep season-scoped ownership historically meaningful
- keep `TeamOwnership` as the authoritative source of season ownership
- keep `SeasonStanding` as the authoritative source of final fantasy standings
- keep `LedgerEntry` as the authoritative source of money / winnings
- keep `Season.leaguePhase` as workflow state
- keep offseason records historically queryable through `Draft`, `DraftPick`, and `KeeperSelection`
- keep routes thin and services authoritative

## Current Product Direction
The current app favors commissioner-driven league operations with cleaner UI surfaces:
- the home page is the main authenticated landing page
- `My Leagues` is the single entry point into leagues
- `Open League` launches a unified league workspace
- commissioners can toggle between commissioner view and owner view inside the same league page
- separate home-page owner-link navigation has been removed

The app also now includes:
- editable account settings
- profile picture upload with circular framing
- shared profile avatars across major league surfaces
- password reset by email
- temporary login by phone verification
- provider-backed recovery delivery with local preview mode reserved for development only
- inaugural auction support for brand-new leagues with no previous season
- automatic season activation when a new season is created
- GM Fantasy season-year defaulting based on the day after the Super Bowl rollover rule

Provider-based ingestion code still exists in the repo, but manual standings remain the primary fantasy-results workflow.
