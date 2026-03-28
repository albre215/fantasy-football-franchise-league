# Current State and Completed Prompts

This file summarizes the current implementation prompt-by-prompt based on the repo as it exists now.

## Prompt 5 — League Bootstrap Flow

### Purpose
Provide the commissioner console for setting up the active season before or alongside offseason work.

### Main Files / Systems
- `server/services/league-service.ts`
- `server/services/season-service.ts`
- `server/services/team-ownership-service.ts`
- `components/league/league-dashboard.tsx`
- `app/api/league/[leagueId]/bootstrap-state/route.ts`
- `app/api/season/[seasonId]/ownership/route.ts`
- `app/api/season/[seasonId]/assign-team/route.ts`
- `app/api/season/[seasonId]/remove-team/route.ts`
- `app/api/season/[seasonId]/lock/route.ts`
- `app/api/season/[seasonId]/unlock/route.ts`

### What Currently Works
- Create leagues
- Join leagues as authenticated users
- Create seasons
- Set active season
- Add/remove league members
- View active-season ownership
- Assign NFL teams manually
- Remove manual assignments
- Validate active season readiness
- Lock/unlock active season

### Guardrails / Limitations
- Bootstrap validation assumes:
  - 10 members
  - 30 assigned teams
  - 2 unassigned teams
  - 3 teams per owner
- Commissioner-only changes still depend on league membership and role checks

## Prompt 6 — Offseason Slow Draft Engine

### Purpose
Support the annual offseason keeper and slow draft workflow that produces the next season's ownership.

### Main Files / Systems
- `server/services/draft-service.ts`
- `components/league/offseason-draft-panel.tsx`
- `app/api/season/[seasonId]/draft/...`
- Prisma models:
  - `Draft`
  - `DraftPick`
  - `KeeperSelection`

### What Currently Works
- Planning draft exists per target season
- Keepers are selected from previous season teams
- Draft pool derives from non-kept teams
- One-pick-per-owner offseason draft is supported
- Draft lifecycle supports:
  - planning
  - active
  - paused
  - completed
- Picks are validated against current draft pool
- Draft finalization writes authoritative `TeamOwnership` rows for the target season

### Important Guardrails
- Keepers are locked once draft leaves `PLANNING`
- Draft source season must match the immediately previous season
- Current league members must each have exactly 3 teams in the source season
- Target season must be empty before offseason draft ownership is finalized

### Current UX Refinements Already Landed
- Per-owner keeper cards
- Locked keeper UI after draft start
- Source season is no longer manually chosen from arbitrary historical seasons
- Offseason flow now starts with keeper selection first

## Prompt 7 — League History & Franchise Analytics

### Purpose
Turn the app into a long-term historical database for ownership and draft history.

### Main Files / Systems
- `server/services/history-service.ts`
- `components/league/league-history-panel.tsx`
- `app/api/league/[leagueId]/history/...`
- `app/api/league/[leagueId]/analytics/summary/route.ts`
- `types/history.ts`

### What Currently Works
- League history overview
- Season history
- Franchise history
- Owner history
- Draft history
- Analytics leaderboards based on:
  - ownership streaks
  - most frequently owned teams
  - team transitions
  - most kept teams
  - most drafted teams
  - owner franchise breadth

### Guardrails / Limitations
- Results-based success metrics are not fully implemented yet
- History intentionally does not fabricate championships, win/loss records, or playoff metrics beyond available data

## Prompt 8 — Manual Final Standings Entry

### Purpose
Simplify season results entry so the commissioner records final standings manually instead of relying on ESPN/Sleeper/CSV workflows.

### Main Files / Systems
- `server/services/results-service.ts`
- `components/league/season-results-panel.tsx`
- `app/api/season/[seasonId]/results/route.ts`
- Prisma model:
  - `SeasonStanding`

### What Currently Works
- Commissioner can assign 1st through 10th place for the active season
- One owner per placement
- Standings can be edited and resaved
- Saved standings are displayed in ranked order
- Reverse draft-order preview is shown

### Important Note
Prompt 8 was intentionally simplified away from ESPN/Sleeper/CSV as the main product direction.

### Guardrails / Limitations
- Manual final standings are the active workflow
- Provider ingestion code still exists in the repo but is not the current commissioner-facing path

## Prompt 9 — Draft Order Automation

### Purpose
Use Prompt 8's saved final standings as the canonical source of truth for offseason draft order.

### Main Files / Systems
- `server/services/results-service.ts`
- `server/services/draft-service.ts`
- `app/api/season/[seasonId]/draft/recommended-order/route.ts`
- `components/league/offseason-draft-panel.tsx`

### What Currently Works
- Reads saved final standings from the immediately previous season
- Generates reverse-order offseason draft sequence
- Maps source-season standings owners into target-season members by `userId`
- Prevents using older historical seasons as the source season
- Uses standings-backed order to prepare the offseason planning draft

### Guardrails / Limitations
- Current UX no longer exposes freeform draft-order editing in setup
- The system now favors deterministic, standings-derived order for the current flow

## Prompt 10 — Authentication System

### Purpose
Replace the old mock commissioner identity with a real session-backed authentication model while preserving existing service-layer authorization rules.

### Main Files / Systems
- `auth.ts`
- `middleware.ts`
- `lib/auth-session.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/register/route.ts`
- `components/home/league-control-panel.tsx`
- `components/providers/session-provider.tsx`
- Protected mutation routes under `app/api/league/...` and `app/api/season/...`
- Prisma `User.passwordHash`

### What Currently Works
- Account registration with email, display name, and password
- Credentials sign-in through NextAuth
- Session-backed identity on server routes
- `/league` and `/dashboard` are protected by auth middleware
- Sensitive mutation routes derive the acting user from the authenticated session
- Commissioner-only actions still enforce league membership and role checks server-side
- Existing `LeagueMember` continuity still flows through `userId`

### Guardrails / Limitations
- This is credentials-based auth only for now
- No password reset or email verification flow yet
- No owner-specific dashboard yet
- The `actingUserId` concept still exists inside services, but routes now supply it from the session instead of client input

## Current Commissioner Workflow

### End-to-End Current Flow
1. Sign in or create an account
2. Create league and members
3. Create seasons and set active season
4. Use bootstrap tools as needed for season setup and corrections
5. At the end of a completed season, save manual final standings
6. Make the next season active
7. Offseason panel automatically anchors to the immediately previous season
8. Planning draft workspace is prepared automatically once standings are valid
9. Save two keepers per owner
10. Review generated draft order
11. Start the draft
12. Record one pick per owner
13. Finalize the draft into target-season ownership
14. Review history and analytics

## Current Authentication / Permissions Approach
- The app now uses real session-backed authentication
- Commissioner-only actions are still enforced server-side through service-layer checks
- Routes no longer trust client-supplied identity for sensitive mutations
- `User` remains separate from `LeagueMember`

## Features Intentionally Paused or Deferred
- Owner dashboard
- Rich commissioner override tooling
- Visualization-heavy analytics UI
- Full operational hardening
- External results ingestion as the main workflow
- Detailed weekly results analytics as a product surface
- Password reset and email verification flows

## Current State Summary
The repo currently supports:
- real user authentication
- season bootstrap
- team ownership management
- manual final standings entry
- automated draft order generation from standings
- offseason keeper and draft lifecycle
- historical ownership and draft analytics

The repo does not yet support:
- owner-facing app experiences
- advanced commissioner admin tooling
- visualization-heavy analytics
- fully activated provider-based results ingestion as the main workflow
