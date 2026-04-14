# Repo Architecture

## Top-Level Structure

### `app/`
Next.js App Router pages and API routes.

Important areas:
- `app/page.tsx`
  - home page / auth entry point / league launcher
- `app/league/page.tsx`
  - unified league workspace route
- `app/account/page.tsx`
  - account settings page
- `app/reset-password/page.tsx`
  - password reset completion page
- `app/api/`
  - auth, account, league, season, ownership, results, ledger, NFL, draft, phase, history, and analytics routes

### `components/`
React UI components.

Important areas:
- `components/home/`
  - sign-in, registration, recovery, and home landing UI
- `components/account/`
  - account settings form and password reset modal UI
- `components/league/`
  - commissioner-facing and owner-facing league panels
- `components/brand/`
  - shared hero/account slot brand surfaces
- `components/shared/`
  - shared avatar and NFL label UI
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
  - central domain services for auth, auth recovery, account, league management, seasons, ownership, results, ledger, NFL performance, draft flow, history, and analytics

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
- password reset and temporary login recovery
- profile image storage
- cross-season identity continuity via `userId`

### `League`
Root league record.

### `LeagueMember`
Represents a membership slot inside a league.

Important notes:
- unique per `(leagueId, userId)`
- role is `COMMISSIONER` or `OWNER`
- should be treated as the durable slot inside the league
- member replacement preserves the `LeagueMember` slot and swaps the attached `User`

### `Season`
Represents a league season.

Important notes:
- unique per `(leagueId, year)`
- has `status`
- has `isLocked`
- has `fantasyPayoutConfig`
- has persisted `leaguePhase`
- has `draftMode` to distinguish continuing-league replacement flow vs inaugural auction flow
- active season drives the league workspace

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

### `InauguralAuction`, `InauguralAuctionNomination`, `InauguralAuctionBid`, `InauguralAuctionAward`
Supporting records for brand-new league inaugural auctions.

Important notes:
- these support live inaugural ownership assignment
- they are not a second ownership truth
- final ownership still lands in `TeamOwnership`

### `PasswordResetToken`
Password reset token model.

Important notes:
- token hash is persisted, not the raw token
- token is single-use through `consumedAt`

### `TemporaryLoginCode`
Temporary phone-login challenge model.

Important notes:
- stores the local or Twilio-backed challenge anchor
- now includes attempt-tracking and lockout fields
- verification challenges are single-use through `consumedAt`

### `SeasonNflImportRun`, `SeasonNflTeamResult`
Persisted NFL import and team-result tracking.

### `SeasonSourceConfig`, `SeasonMemberSourceMapping`, `IngestionRun`, `WeeklyStanding`
Additional ingestion-related models still present in the schema.

## Important Services

### `server/services/auth-service.ts`
- registration
- password hashing
- user creation

### `server/services/auth-recovery-service.ts`
- password reset token generation / validation / completion
- temporary login challenge creation
- temporary login verification
- recovery throttling, one-time-use semantics, and verification attempt hardening

### `server/services/recovery-delivery-service.ts`
- provider boundary for recovery delivery
- Resend password reset email integration
- Twilio Verify SMS send/check integration
- preview-mode behavior for local development
- preview-mode production safety rails

### `server/services/account-service.ts`
- account profile read/update
- email update validation
- password change validation
- profile image persistence

### `server/services/league-service.ts`
- create/join leagues
- home-page league listing
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
- season creation now auto-activates the new season
- season creation determines `draftMode` based on whether a previous season exists

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

### `server/services/inaugural-auction-service.ts`
- inaugural auction configuration
- nomination ordering
- live bidding validation
- timer extension / immediate award handling
- award progression and final summary state
- finalization into authoritative `TeamOwnership`

### `server/services/history-service.ts` / `analytics-service.ts`
- cross-season history and analytics read models
- analytics metric definitions are documented in `docs/05-analytics-metric-definitions.md`

## Important API Route Areas

### Auth routes
- `app/api/auth/[...nextauth]`
- `app/api/auth/register`
- `app/api/auth/recovery/password/request`
- `app/api/auth/recovery/password/validate`
- `app/api/auth/recovery/password/complete`
- `app/api/auth/recovery/temporary-login/request`

### Account routes
- `app/api/account`
- `app/api/account/password`

### League routes
- `app/api/league/create`
- `app/api/league/join`
- `app/api/league/list`
- `app/api/league/join/suggestions`
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

### Inaugural auction routes
- `app/api/season/[seasonId]/inaugural-auction`
- `app/api/season/[seasonId]/inaugural-auction/start`
- `app/api/season/[seasonId]/inaugural-auction/bid`

## Important UI Panels / Components

### `components/home/league-control-panel.tsx`
Home-screen auth and league entry experience.

Important notes:
- sign-in and create-account live here
- forgot-password and temporary phone-login recovery modal lives here
- join-league suggestions live here

### `components/home/account-menu.tsx`
Top-right account control with home-page greeting animation.

### `components/account/account-settings-form.tsx`
Account settings UI.

Important notes:
- editable display name, email, phone
- phone formatting assistance
- profile picture upload + circular framing
- reset-password modal flow

### `components/shared/profile-avatar.tsx`
Reusable avatar component used across account, commissioner, and owner UI.

### `components/league/league-dashboard.tsx`
Unified league workspace.

Important notes:
- `Open League` is the main entry path
- commissioners land in commissioner view
- commissioners can toggle between commissioner and owner view inside the same page
- the overview hero has been simplified to match home/account styling
- the overview card layout was recently cleaned up for handoff-friendly UI

### `components/league/league-owner-panel.tsx`
Read-only owner view embedded inside the unified league workspace.

### `components/league/season-results-panel.tsx`
Manual standings + fantasy payout review UI.

### `components/league/offseason-draft-panel.tsx`
Ledger-based recommendation, keeper, and draft UI.

### `components/league/inaugural-auction-panel.tsx`
Commissioner/owner live inaugural auction room.

Important notes:
- used when `activeSeason.draftMode === "INAUGURAL_AUCTION"`
- polling-based live room, not websocket-based
- commissioner configures order and starts the auction
- eligible owners bid from the shared league workspace

### `components/league/season-nfl-performance-panel.tsx`
NFL import/status, weekly review, and commissioner correction UI.

### `components/league/season-ledger-panel.tsx`
Season ledger balances, owner detail, and manual adjustment UI.

### `components/league/commissioner-tools-panel.tsx`
Commissioner-facing state and workflow support sections.

### `components/league/league-history-panel.tsx`
History and analytics UI.

## Current Data Flow

### 1. Home + Auth
User signs in or registers from the home page, opens a league from `My Leagues`, or uses recovery flows when needed.

### 2. Recovery
Password reset remains email-first. Temporary login uses phone verification as a convenience path, not the primary recovery truth.

### 3. League Workspace
Commissioner opens a league from home, loads bootstrap state, seasons, and season-backed operational data as needed, then manages members, seasons, ownership, results, ledger, NFL, and history in one workspace.

Membership-specific rule:
- member replacement preserves the existing `LeagueMember` slot and its historical references while swapping the linked `User`

### 4. NFL Performance
Active-season NFL results import automatically, persist into season-scoped NFL tables, and roll up to owner views. Commissioner can correct weekly outcomes manually.

### 5. Final Standings + Fantasy Payouts
Commissioner saves final standings into `SeasonStanding`, then fantasy payouts are published into `LedgerEntry`.

### 6. Offseason Draft Recommendation
The immediately previous season's ledger totals are aggregated per owner, tied deterministically, mapped into the target season by `userId`, and returned as the recommended offseason draft order.

### 7. League Phase Control
`seasonPhaseService` exposes current phase, allowed actions, warnings, readiness, and valid forward transitions. The domain engine uses phases heavily; recent UI work has reduced phase-heavy wording in commissioner overview surfaces.

### 8. Ownership Assignment Lifecycle
In `DROP_PHASE`, keepers and released teams become explicit and reviewable. In `DRAFT_PHASE`, the replacement draft runs from the released-team pool using the ledger-based order, and finalization writes authoritative target-season `TeamOwnership`.

For inaugural seasons, the inaugural auction room replaces the continuity draft workflow and finalizes into the same authoritative `TeamOwnership` model.

### 9. History / Analytics
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
- Windows can lock Prisma/Git files while `next dev` is running
- stop `npm run dev` before Prisma migration/generate work on this machine
- local migration history was repaired recently; do not casually accept Prisma reset prompts against a populated local DB
- recovery providers require real env configuration; without that, local preview mode is used in development only
