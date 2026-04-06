# Current State and Completed Prompts

This file summarizes the repo as it exists now.

## Prompt 5 - League Bootstrap Flow

### What Currently Works
- create leagues
- join leagues as authenticated users
- create seasons
- set active season
- add/remove league members
- view active-season ownership
- assign NFL teams manually
- remove assignments
- validate active season readiness
- lock/unlock active season

## Prompt 6 - Offseason Slow Draft Engine

### What Currently Works
- planning draft exists per target season
- keepers are selected from previous-season teams
- draft pool derives from non-kept teams
- one-pick-per-owner offseason draft is supported
- draft lifecycle supports:
  - planning
  - active
  - paused
  - completed
- draft finalization writes authoritative `TeamOwnership`

### Important Guardrails
- keepers lock once draft leaves `PLANNING`
- source season must be the immediately previous season
- target season must be empty before draft finalization
- draft prep/execution is now gated by season `leaguePhase`

## Prompt 7 - League History & Franchise Analytics

### What Currently Works
- league overview
- season history
- franchise history
- owner history
- draft history
- analytics leaderboards and summaries

## Prompt 8 - Manual Final Standings Entry

### What Currently Works
- commissioner can assign 1st through 10th place
- standings can be saved, edited, and overwritten
- saved standings are displayed in ranked order
- standings remain stored in `SeasonStanding`

## Prompt 9 - Draft Order Automation

### Original Goal
Automate offseason draft order from end-of-season information.

### Current State
This prompt's original standings-based implementation has been superseded by later phases.

## Prompt 10 - Authentication System

### What Currently Works
- account registration
- credentials sign-in through NextAuth
- protected league/dashboard pages
- mutation routes derive acting user from the session
- commissioner-only actions still enforce role checks server-side

## Phase 1 - Ledger Engine

### What Landed
- persisted `LedgerEntry`
- season ledger routes and UI
- commissioner manual adjustments
- season balance aggregation by owner

## Phase 2 - NFL Performance Engine

### What Landed
- provider-backed NFL result imports
- season/year-based NFL import flow
- season import history
- owner-level NFL rollups from owned teams
- commissioner weekly review/correction tools

### Current Notes
- active season imports run automatically
- manual corrections are preserved across provider re-imports
- import concurrency is guarded season-by-season

## Phase 3 - Fantasy Results -> Ledger Integration

### What Landed
- final fantasy standings still persist in `SeasonStanding`
- standings now publish `FANTASY_PAYOUT` ledger entries
- standings corrections safely replace fantasy payout ledger entries
- season financial results now include fantasy payouts

## Phase 4 - Offseason Draft Order From Ledger Totals

### What Landed
- recommended offseason draft order now derives from season ledger totals
- standings are still fantasy-history truth
- ledger is the financial truth
- source-season owners map into target season by `userId`
- deterministic tie-breaks:
  - lower ledger total first
  - worse fantasy rank first if tied
  - display name ordering as final fallback

### Hardening That Landed
- clearer naming around offseason recommendation
- stronger recommendation tests
- readiness and coverage transparency
- explicit tie-break output

## Phase 5 - League Phase System

### What Landed
- persisted `Season.leaguePhase`
- supported phases:
  - `IN_SEASON`
  - `POST_SEASON`
  - `DROP_PHASE`
  - `DRAFT_PHASE`
- phase service for:
  - current phase
  - allowed actions
  - warnings
  - readiness
  - available transitions
- draft prep and execution are gated by `DRAFT_PHASE`
- commissioner UI now exposes phase state and transitions

## Additional Hardening / Error Resolution Already Landed

### Load / speed work
- homepage and league page server rendering improved
- heavy dashboard panels are lazy-loaded
- active-season operational fetches are deferred

### Season-backed error hardening
- season/ownership/ledger/results/NFL paths were tightened to avoid broad season reads
- local Prisma schema mismatch issues around `leaguePhase` were repaired
- duplicate Phase 5 migration was removed
- local migration history and DB schema were brought back into sync

## Current Commissioner Workflow

1. Sign in or create an account
2. Create league and members
3. Create seasons and set active season
4. Manage season ownership and lock state
5. Let active-season NFL results import automatically
6. Save final standings for the completed season
7. Publish fantasy payouts into the ledger
8. Review ledger-based offseason recommendation for the next season
9. Move the target season through league phases
10. In `DRAFT_PHASE`, save keepers
11. Start the draft
12. Record picks
13. Finalize the draft into target-season ownership
14. Review history, analytics, NFL performance, and ledger balances

## Current State Summary

The repo currently supports:
- real user authentication
- season bootstrap
- team ownership management
- automatic NFL result imports for the active season
- manual final standings entry
- fantasy payouts posted into the ledger
- ledger-based offseason draft recommendation
- explicit league phase workflow
- offseason keeper and draft lifecycle
- season ledger UI and adjustments
- historical ownership and draft analytics

The repo does not yet support:
- keeper/release engine for `DROP_PHASE`
- inaugural auction behavior
- replacement draft behavior
- owner-facing app experience
- password reset / email verification
