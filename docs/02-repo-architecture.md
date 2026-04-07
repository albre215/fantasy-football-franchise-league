# Repo Architecture

## Top-Level Structure

### `app/`
Next.js App Router pages and API routes.

Important areas:
- `app/page.tsx`
  - home page / auth entry point
- `app/league/page.tsx`
  - main commissioner dashboard route
- `app/api/`
  - auth, league, season, ownership, results, ledger, NFL, draft, phase, history, and analytics routes

### `components/`
React UI components.

Important areas:
- `components/home/`
  - sign-in, registration, and league entry UI
- `components/league/`
  - commissioner-facing dashboard panels
- `components/providers/`
  - session provider wrapper
- `components/ui/`
  - shared UI primitives

### `prisma/`
Prisma schema, migrations, and seed logic.

Important files:
- `prisma/schema.prisma`
  - authoritative data model
- `prisma/seed.ts`
  - seeds NFL teams
- `prisma/migrations/`
  - historical migration files

### `server/`
Service-layer business logic.

Important area:
- `server/services/`
  - central domain services for auth, league management, seasons, ownership, results, ledger, NFL performance, draft flow, history, and analytics

### `types/`
Typed request/response and domain contracts shared across services, routes, and UI.

### `lib/`
Shared infrastructure helpers.

Important files:
- `lib/prisma.ts`
  - Prisma client singleton
- `lib/auth-session.ts`
  - session-backed route helpers
- `lib/nfl-team-aliases.ts`
  - shared NFL abbreviation normalization

## Important Prisma Domain Models

### `User`
Represents a person in the system.

Used for:
- authenticated identity
- credentials login
- cross-season identity continuity via `userId`

### `League`
Root league record.

### `LeagueMember`
Represents a user's membership in a league.

Important notes:
- unique per `(leagueId, userId)`
- role is `COMMISSIONER` or `OWNER`
- cross-season continuity should prefer `userId`, not raw `LeagueMember.id`

### `Season`
Represents a league season.

Important notes:
- unique per `(leagueId, year)`
- has `status`
- has `isLocked`
- has `fantasyPayoutConfig`
- has persisted `leaguePhase`
- active season drives the commissioner dashboard

### `NFLTeam`
Catalog of NFL teams.

### `TeamOwnership`
Authoritative season-level ownership record.

Critical rule:
- `TeamOwnership` is the source of truth for who owns which NFL team in a season

### `SeasonStanding`
Stores saved final fantasy standings.

Critical rule:
- `SeasonStanding` is the source of truth for final fantasy standings

### `LedgerEntry`
Stores season-scoped financial events.

Critical rule:
- `LedgerEntry` is the source of truth for money / winnings

### `Draft`, `DraftPick`, `KeeperSelection`
Historical offseason workflow records.

### `SeasonNflImportRun`, `SeasonNflTeamResult`
Persisted NFL import and team-result tracking.

### `SeasonSourceConfig`, `SeasonMemberSourceMapping`, `IngestionRun`, `WeeklyStanding`
Additional ingestion-related models still present in the schema.

## Important Services

### `server/services/auth-service.ts`
- registration
- password hashing
- user-claim behavior

### `server/services/league-service.ts`
- create/join leagues
- dashboard/bootstrap summary state
- league-level commissioner access
- durable member-slot management
- member replacement that preserves slot history by swapping the linked `userId`

### `server/services/season-service.ts`
- create/list seasons
- get/set active season
- lock/unlock
- setup validation
- update season year

### `server/services/season-phase-service.ts`
- read phase context
- validate transitions
- update `Season.leaguePhase`
- expose allowed actions, warnings, readiness
- gate draft prep/execution by phase

### `server/services/team-ownership-service.ts`
- season ownership reads
- assign/remove ownership
- ownership validation

### `server/services/results-service.ts`
- read standings
- save/overwrite manual standings
- publish fantasy payouts into ledger
- derive ledger-based offseason draft recommendation

### `server/services/ledger-service.ts`
- season ledger reads
- owner detail
- manual adjustments
- season ledger totals for draft recommendation

### `server/services/nfl-performance-service.ts`
- season NFL overview
- weekly NFL reads
- provider-backed imports
- commissioner correction flow
- owner NFL rollups

### `server/services/draft-service.ts`
- read/init draft state
- save keepers
- replacement draft lifecycle
- finalize into `TeamOwnership`
- phase-gated draft operations

### `server/services/history-service.ts` / `analytics-service.ts`
- cross-season history and analytics read models
- analytics metric definitions are documented in `docs/05-analytics-metric-definitions.md`

## Important API Route Areas

### Auth routes
- `app/api/auth/[...nextauth]`
- `app/api/auth/register`

### League routes
- `app/api/league/create`
- `app/api/league/join`
- `app/api/league/list`
- `app/api/league/[leagueId]/...`
- includes member replacement at `app/api/league/[leagueId]/members/replace`

### Season / bootstrap routes
- `app/api/league/[leagueId]/season/create`
- `app/api/league/[leagueId]/season/list`
- `app/api/league/[leagueId]/season/set-active`
- `app/api/season/[seasonId]/lock`
- `app/api/season/[seasonId]/unlock`
- `app/api/season/[seasonId]/year`

### Phase routes
- `app/api/season/[seasonId]/phase`

### Ownership routes
- `app/api/season/[seasonId]/ownership`
- `app/api/season/[seasonId]/ownership/assign`
- `app/api/season/[seasonId]/ownership/remove`

### Results routes
- `app/api/season/[seasonId]/results`
- `app/api/season/[seasonId]/results/overwrite`

### Ledger routes
- `app/api/season/[seasonId]/ledger`
- `app/api/season/[seasonId]/ledger/adjustments`
- `app/api/season/[seasonId]/ledger/member/[leagueMemberId]`

### NFL routes
- `app/api/season/[seasonId]/nfl`
- `app/api/season/[seasonId]/nfl/import`
- `app/api/season/[seasonId]/nfl/week/[weekNumber]`
- `app/api/season/[seasonId]/nfl/week/[weekNumber]/import`

### Draft routes
- `app/api/season/[seasonId]/draft`
- `app/api/season/[seasonId]/draft/recommended-order`
- `app/api/season/[seasonId]/draft/keepers`
- `app/api/season/[seasonId]/draft/start`
- `app/api/season/[seasonId]/draft/pause`
- `app/api/season/[seasonId]/draft/resume`
- `app/api/season/[seasonId]/draft/pick`
- `app/api/season/[seasonId]/draft/finalize`
- `app/api/season/[seasonId]/draft/reset`
- `app/api/season/[seasonId]/draft/override-order`

## Important UI Panels / Components

### `components/home/league-control-panel.tsx`
Home-screen auth and league entry experience.

### `components/league/league-dashboard.tsx`
Main commissioner console with the major operational tabs.

Important note:
- the Members tab now uses a modal-based member replacement flow rather than an always-visible side panel

### `components/league/season-results-panel.tsx`
Manual standings + fantasy payout review UI.

### `components/league/offseason-draft-panel.tsx`
Ledger-based recommendation, keeper, and draft UI.

### `components/league/season-nfl-performance-panel.tsx`
NFL import/status, weekly review, and commissioner correction UI.

### `components/league/season-ledger-panel.tsx`
Season ledger balances, owner detail, and manual adjustment UI.

### `components/league/commissioner-tools-panel.tsx`
Commissioner-facing results/draft recommendation review.

### `components/league/league-history-panel.tsx`
History and analytics UI.

## Current Data Flow

### 1. Season Bootstrap
Commissioner opens the dashboard, loads bootstrap state, seasons, and season-backed operational data as needed, then manages members, seasons, ownership, and lock state.

Membership-specific rule:
- member replacement preserves the existing `LeagueMember` slot and its historical references while swapping the linked `User`

### 2. NFL Performance
Active-season NFL results import automatically, persist into season-scoped NFL tables, and roll up to owner views. Commissioner can correct weekly outcomes manually.

### 3. Final Standings + Fantasy Payouts
Commissioner saves final standings into `SeasonStanding`, then fantasy payouts are published into `LedgerEntry`.

### 4. Offseason Draft Recommendation
The immediately previous season's ledger totals are aggregated per owner, tied deterministically, mapped into the target season by `userId`, and returned as the recommended offseason draft order.

### 5. League Phase Control
`seasonPhaseService` exposes current phase, allowed actions, warnings, readiness, and valid forward transitions.

### 6. Offseason Replacement Draft Lifecycle
In `DROP_PHASE`, keepers and released teams become explicit and reviewable. In `DRAFT_PHASE`, the replacement draft runs from the released-team pool using the ledger-based order, and finalization writes authoritative target-season `TeamOwnership`.

### 7. History / Analytics
Read-only server-side history and analytics aggregate ownership, standings, ledger, and draft records. Metric definitions are standardized in `docs/05-analytics-metric-definitions.md`.

## Architectural Boundaries To Preserve
- `TeamOwnership` = season ownership truth
- `SeasonStanding` = final fantasy standings truth
- `LedgerEntry` = money / winnings truth
- `Season.leaguePhase` = workflow truth
- `LeagueMember` = durable league slot inside a league
- `User` = current authenticated person attached to that slot
- routes stay thin
- services stay authoritative

## Known Technical Caveats
- credentials auth exists, but password reset and email verification do not
- Windows can lock Prisma/Git files while `next dev` is running
- stop `npm run dev` before Prisma migration/generate work on this machine
- local migration history was repaired recently; do not casually accept Prisma reset prompts against a populated local DB
