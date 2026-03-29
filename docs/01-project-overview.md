# GM Fantasy

## Project Name
GM Fantasy

## What This App Is For
GM Fantasy is a commissioner-first web application for running a long-lived fantasy football league where owners control NFL franchises instead of fantasy player rosters.

The application is built around preserving historical league state over many years:
- which owner controlled which NFL teams in each season
- how offseason keeper and draft decisions changed ownership
- what the final standings were for each season
- how those records feed history, analytics, and future automation

## Core League Concept
- 10 owners in the league
- Owners control NFL teams, not fantasy players
- 32 NFL teams total
- Each owner ends each season with exactly 3 teams
- 2 NFL teams remain unassigned each season
- Ownership is season-scoped and historically preserved

## Main Yearly Lifecycle
The current codebase models the yearly workflow roughly as:

1. Final standings entry
- The commissioner manually records the final 1st through 10th place standings for the completed season.

2. Offseason draft order generation
- The system derives the next offseason draft order from the immediately previous season's saved final standings.
- The draft order is reverse standings order.

3. Offseason draft preparation
- Once the next season is activated and the previous season has saved standings, the offseason planning draft workspace is prepared.
- Owners then lock in 2 keepers each from their previous season's 3-team portfolio.

4. Offseason draft execution
- After keepers are finalized, the generated draft order is shown.
- The commissioner starts the slow draft and records one pick per owner.

5. Resulting season ownership
- Finalizing the draft creates the authoritative `TeamOwnership` rows for the target season.

6. History and analytics
- Historical ownership, draft, and standings records are available for league history and analytics views.

## Current Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL / Neon-style hosted Postgres via `DATABASE_URL`
- Node.js

## Product Goals
- Long-term league management
- Multi-season history
- Franchise ownership tracking
- Offseason keeper and draft management
- Historical analytics
- Real authentication and safer mutation access
- Eventual owner-facing dashboards
- Eventual richer commissioner tools and visualizations

## Current Philosophy
- Preserve clean domain boundaries
- Avoid redesigning core Prisma models unless absolutely necessary
- Keep season-scoped ownership historically meaningful
- Keep `TeamOwnership` as the authoritative source of season ownership
- Keep final standings as the source of truth for draft-order generation
- Keep offseason records historically queryable through `Draft`, `DraftPick`, and `KeeperSelection`

## Current Product Direction
The current app favors a commissioner-driven workflow over external integrations:
- Final standings are entered manually
- Draft order automation is derived from those saved standings
- Offseason draft lifecycle is managed directly in the app

Provider-based ingestion code still exists in the repo, but it is not the active commissioner workflow right now.
