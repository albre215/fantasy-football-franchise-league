# Current State and Completed Prompts

This file summarizes the repo as it exists after Phases 1 through 10.5 plus the recent membership-management and UX fixes.

## Earlier Prompt Baseline

### League bootstrap
- league creation and joining
- season creation and active-season management
- league member add workflow
- commissioner-driven member replacement that preserves slot history
- season setup validation
- lock / unlock workflow

### History / analytics
- league overview
- franchise history
- owner history
- draft history
- analytics leaderboards and summaries

### Manual standings + auth
- commissioner-entered final standings
- standings overwrite flow
- credentials authentication through NextAuth
- session-derived acting user on mutation routes

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
- automatic active-season imports
- season import history
- owner-level NFL rollups from owned teams
- commissioner weekly review / correction tools

### Current Notes
- manual corrections survive provider re-imports
- imports are concurrency-guarded by season

## Phase 3 - Fantasy Results -> Ledger Integration

### What Landed
- final fantasy standings remain stored in `SeasonStanding`
- saved standings publish `FANTASY_PAYOUT` ledger entries
- standings corrections safely replace fantasy payout ledger entries

## Phase 4 - Offseason Draft Order From Ledger Totals

### What Landed
- recommended offseason draft order now derives from season ledger totals
- source-season owners map into the target season by `userId`
- deterministic tie-breaks:
  - lower ledger total first
  - worse fantasy rank first if tied
  - display name ordering as final fallback

### Hardening That Landed
- clearer recommendation naming
- stronger recommendation tests
- readiness / coverage transparency
- explicit tie-break output

## Phase 5 - League Phase System

### What Landed
- persisted `Season.leaguePhase`
- supported phases:
  - `IN_SEASON`
  - `POST_SEASON`
  - `DROP_PHASE`
  - `DRAFT_PHASE`
- service-owned phase context, warnings, readiness, and transitions
- phase-gated draft preparation and execution

## Phase 6 - Real DROP_PHASE Keeper / Release Workflow

### What Landed
- `DROP_PHASE` now records exactly 2 keepers and 1 released team per owner
- released-team pool is explicit and league-wide reviewable
- transition into `DRAFT_PHASE` depends on valid keeper / release completion

## Phase 7 - Owner-Facing Read-Only Views

### What Landed
- `/owner` route and read-only owner dashboard
- owner season detail
- owner financial rollups
- owner history
- read-only draft and phase context

## Phase 8 - Replacement Draft System

### What Landed
- replacement draft pool derives only from the explicit released-team pool
- ledger-based offseason recommendation still drives draft order
- one replacement draft pick per owner
- duplicate or non-pool team picks are rejected
- replacement draft execution remains gated by `DRAFT_PHASE`
- finalization writes exactly 3 authoritative `TeamOwnership` rows per owner into the target season

## Phase 9 - NFL Results -> Ledger Automation

### What Landed
- persisted NFL team results can be previewed as owner-level ledger rollups
- commissioners can post NFL-derived ledger entries explicitly
- reruns safely replace only prior NFL-derived entries for the same season

## Phase 10 - Analytics & Insights Layer

### What Landed
- richer owner analytics
- richer franchise analytics
- season payout and parity analytics
- draft slot and replacement-draft effectiveness analytics

## Phase 10.5 - Analytics Definitions Hardening

### What Landed
- explicit metric-definition comments in `analytics-service.ts`
- clarified analytics DTO documentation in `types/analytics.ts`
- standardized analytics UI wording
- dedicated analytics data dictionary in `docs/05-analytics-metric-definitions.md`

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

### Recent membership-management hardening
- member replacement now preserves the existing `LeagueMember` slot and its full historical references
- the Members tab now uses a modal-based replacement flow instead of an always-visible side panel
- selected member rows now show a clearer active state during replacement
- commissioner rows are explicitly non-replaceable in the UI

## Current Commissioner Workflow

1. Sign in or create an account
2. Create league and members
3. Create seasons and set active season
4. Manage season ownership and lock state
5. Let active-season NFL results import automatically
6. Save final standings for the completed season
7. Publish fantasy payouts into the ledger
8. Review the ledger-based offseason recommendation for the next season
9. Move the target season through league phases
10. In `DROP_PHASE`, save 2 keepers and review the released-team pool
11. Move into `DRAFT_PHASE`
12. Start the replacement draft
13. Record one released-team pick per owner
14. Finalize the draft into target-season ownership
15. Review owner views, history, analytics, NFL performance, and ledger balances

## Current State Summary

The repo currently supports:
- real user authentication
- season bootstrap
- durable member-slot management with commissioner replacement
- team ownership management
- automatic NFL result imports for the active season
- manual final standings entry
- fantasy payouts posted into the ledger
- ledger-based offseason draft recommendation
- explicit league phase workflow
- real DROP_PHASE keeper / release workflow
- replacement draft lifecycle
- owner-facing read-only views
- season ledger UI and adjustments
- historical ownership and draft analytics

The repo does not yet support:
- inaugural auction behavior
- owner-facing draft actions
- password reset / email verification
