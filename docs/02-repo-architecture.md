# Repo Architecture

## Top-Level Structure

### `app/`
Next.js App Router pages and API routes.

Important areas:
- `app/page.tsx`
  - Home page / auth entry point
- `app/league/page.tsx`
  - Main commissioner dashboard route
- `app/api/`
  - Route handlers for auth, league, season, draft, results, ownership, and history APIs

### `components/`
React UI components.

Important areas:
- `components/home/`
  - Sign-in, registration, and league entry UI
- `components/league/`
  - Main commissioner-facing panels
- `components/providers/`
  - Session provider wrapper
- `components/ui/`
  - Reusable UI primitives such as buttons, cards, and inputs

### `prisma/`
Prisma schema, migrations, and seed logic.

Important files:
- `prisma/schema.prisma`
  - Authoritative data model
- `prisma/seed.ts`
  - Seeds NFL teams
- `prisma/migrations/`
  - Historical migration files

### `server/`
Service-layer business logic.

Important area:
- `server/services/`
  - Central domain services for league management, auth, seasons, ownership, draft flow, standings, and analytics

### `types/`
Typed request/response and domain contracts shared across services, routes, and UI.

### `lib/`
Shared infrastructure helpers.

Important files:
- `lib/prisma.ts`
  - Prisma client singleton
- `lib/auth-session.ts`
  - Session-backed route helpers for authenticated user access

### `utils/`
Small utility helpers. Present in repo but not a major domain layer.

## Important Prisma Domain Models

### `User`
Represents a person in the system.

Used for:
- authenticated identity
- credentials-based account login
- league membership
- cross-season identity continuity via `userId`

Important note:
- `User` remains separate from `LeagueMember`
- `passwordHash` supports the current credentials auth flow

### `League`
Root league record.

Used for:
- league metadata
- grouping seasons
- grouping members
- grouping offseason drafts

### `LeagueMember`
Represents a user's membership in a league for a role.

Important notes:
- unique per `(leagueId, userId)`
- role is `COMMISSIONER` or `OWNER`
- current code often uses `userId` rather than raw `LeagueMember.id` for cross-season continuity

### `Season`
Represents a league season.

Important notes:
- unique per `(leagueId, year)`
- has `status`
- has `isLocked`
- active season drives the commissioner dashboard

### `NFLTeam`
Catalog of NFL teams.

Important notes:
- seeded once
- active teams are used for ownership, keepers, and drafts

### `TeamOwnership`
Authoritative season-level ownership record.

This is one of the most important architectural rules in the app:
- `TeamOwnership` is the source of truth for who owns which NFL team in a season
- it is not replaced by draft models or standings models

### `Draft`
Represents one offseason draft targeting a new season and sourced from the immediately previous season.

Important notes:
- one `Draft` per target season
- current statuses: `PLANNING`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`

### `DraftPick`
Represents a specific offseason pick in draft order.

Used for:
- pick board
- current pick progression
- final drafted team history

### `KeeperSelection`
Represents a kept team during the offseason draft workflow.

Used for:
- draft pool generation
- historical keeper analysis
- final season ownership composition when combined with drafted team

### `SeasonStanding`
Stores saved season-level standings/result data.

Current active use:
- manual final standings entry
- reverse draft order generation
- future analytics input

### `WeeklyStanding`
Stores weekly standings data.

Current status:
- schema exists
- not part of the current commissioner-facing workflow

### `SeasonSourceConfig`, `SeasonMemberSourceMapping`, `IngestionRun`
Additive ingestion-related models.

Current status:
- still present in the schema and service layer
- not the active workflow after the Prompt 8 simplification

## Important Services

### `server/services/auth-service.ts`
Responsibilities:
- register user accounts
- hash passwords
- claim existing placeholder `User` rows by email if a commissioner created them earlier

### `server/services/league-service.ts`
Responsibilities:
- create leagues
- join leagues
- build bootstrap summary state
- league-level member summaries and lock-readiness support
- commissioner authorization checks at the league boundary

### `server/services/season-service.ts`
Responsibilities:
- create seasons
- list seasons
- get/set active season
- calculate season setup validity
- commissioner lock/unlock workflow
- commissioner authorization checks for season-scoped actions

### `server/services/team-ownership-service.ts`
Responsibilities:
- canonical active-season ownership summary
- assign teams
- remove team ownership
- list available teams
- enforce ownership rules

Important boundary:
- this service owns season ownership logic
- it does not own draft lifecycle or standings logic

### `server/services/draft-service.ts`
Responsibilities:
- initialize and read offseason draft state
- keeper validation and saving
- draft start/pause/resume
- pick validation and recording
- draft finalization into `TeamOwnership`

Important current behavior:
- source season must be the immediately previous season
- keeper editing is only allowed while the draft is in `PLANNING`
- keeper selections are locked once the draft begins

### `server/services/results-service.ts`
Responsibilities:
- read final standings for a season
- save manual final standings
- derive recommended reverse draft order from standings

Important boundary:
- final standings are the source of truth for draft-order generation

### `server/services/history-service.ts`
Responsibilities:
- league history overview
- season history
- franchise history
- owner history
- draft history
- analytics leaderboards based on real stored ownership/draft data

### `server/services/ingestion-service.ts`
Responsibilities:
- provider-based import orchestration

Current status:
- present in repo
- not part of the main commissioner workflow right now

## Important API Route Areas

### Auth routes
- `app/api/auth/[...nextauth]`
- `app/api/auth/register`

Purpose:
- credentials sign-in session handling
- account registration

### League routes
- `app/api/league/create`
- `app/api/league/join`
- `app/api/league/list`
- `app/api/league/[leagueId]/...`

Purpose:
- league creation
- joining as the authenticated user
- bootstrap state
- member management
- season selection
- history and analytics reads

### Season bootstrap / ownership routes
- `app/api/season/[seasonId]/assign-team`
- `app/api/season/[seasonId]/remove-team`
- `app/api/season/[seasonId]/ownership`
- `app/api/season/[seasonId]/setup-status`
- `app/api/season/[seasonId]/lock`
- `app/api/season/[seasonId]/unlock`

Purpose:
- season-scoped ownership and readiness management

### Results routes
- `app/api/season/[seasonId]/results`

Purpose:
- `GET` saved season standings summary
- `POST` save/update manual final standings

### Draft routes
- `app/api/season/[seasonId]/draft`
- `app/api/season/[seasonId]/draft/recommended-order`
- `app/api/season/[seasonId]/draft/keepers`
- `app/api/season/[seasonId]/draft/start`
- `app/api/season/[seasonId]/draft/pause`
- `app/api/season/[seasonId]/draft/resume`
- `app/api/season/[seasonId]/draft/pick`
- `app/api/season/[seasonId]/draft/finalize`

Purpose:
- read/create offseason planning draft
- fetch recommended draft order from final standings
- save keepers
- run draft lifecycle

### History / analytics routes
- `app/api/league/[leagueId]/history/...`
- `app/api/league/[leagueId]/analytics/summary`

Purpose:
- cross-season history and analytics reads

## Important UI Panels / Components

### `components/home/league-control-panel.tsx`
Home-screen auth and league entry experience.

Purpose:
- create an account
- sign in
- sign out
- create league
- join league

### `components/league/league-dashboard.tsx`
Main commissioner console.

Composes:
- league details
- season management
- offseason draft panel
- member management
- ownership table
- setup validation
- history panel
- final standings panel

### `components/league/offseason-draft-panel.tsx`
Current offseason draft UI.

Important current behavior:
- automatically anchors to the immediately previous season
- prepares the planning draft workspace automatically once prior standings are valid
- makes keeper selection the first visible offseason action
- shows generated draft order after keeper completion

### `components/league/season-results-panel.tsx`
Manual final standings entry UI.

Purpose:
- commissioner assigns 1st through 10th place
- standings are saved and displayed in ranked order
- reverse-order draft preview is shown

### `components/league/league-history-panel.tsx`
History and analytics UI.

Purpose:
- league overview
- season history
- franchise history
- owner history
- draft history
- analytics leaderboards

## Current Data Flow

### 1. Season Bootstrap
1. Authenticated commissioner opens league dashboard.
2. Dashboard fetches:
   - league bootstrap state
   - season list
   - active season ownership
   - active season draft state
3. Commissioner:
   - creates seasons
   - sets active season
   - adds/removes members
   - manually assigns teams when needed
   - locks or unlocks the season

Canonical ownership source:
- `teamOwnershipService.getSeasonOwnership(...)`

### 2. Final Standings Entry
1. Active season is selected.
2. `SeasonResultsPanel` loads `/api/season/[seasonId]/results`.
3. Commissioner assigns 1st through 10th place using season member IDs.
4. `resultsService.saveManualSeasonStandings(...)` persists `SeasonStanding` rows.
5. Saved standings become the official source of truth for that season's finishing order.

### 3. Offseason Draft Order Automation
1. Next season becomes the active season.
2. `OffseasonDraftPanel` identifies the immediately previous season by year.
3. It calls `/api/season/[targetSeasonId]/draft/recommended-order?sourceSeasonId=[previousSeasonId]`.
4. `resultsService.getRecommendedReverseDraftOrder(...)`:
   - validates same league
   - validates immediate previous season
   - validates complete standings
   - maps standings owners into target-season members by `userId`
   - reverses rank order

### 4. Offseason Draft Lifecycle
Current sequence:
1. Active season has valid previous season + saved final standings.
2. Planning draft workspace is prepared automatically.
3. Keeper selection workspace appears first.
4. Commissioner saves 2 keepers per owner.
5. Once keepers are complete, the generated draft order is shown.
6. Commissioner starts draft.
7. Commissioner records one pick per owner.
8. Commissioner finalizes draft.
9. `draftService.finalizeDraft(...)` creates season `TeamOwnership`.

Important integrity rules:
- keepers lock once draft leaves `PLANNING`
- keeper set drives draft pool integrity
- final ownership is derived from keepers plus one drafted team per owner

### 5. History / Analytics
1. `LeagueHistoryPanel` hits history and analytics routes.
2. `history-service` aggregates ownership, draft, and standings-adjacent data.
3. Read models are returned for:
   - league overview
   - season summaries
   - franchise history
   - owner history
   - draft history
   - leaderboard summaries

### 6. Authentication / Authorization
1. User registers or signs in from the home page.
2. NextAuth issues a JWT-backed session.
3. Protected routes and pages require an authenticated session.
4. Mutation routes call `requireAuthenticatedUserId()` to derive the acting user.
5. Services still enforce league membership and commissioner role checks server-side.

## Architectural Boundaries To Preserve
- `TeamOwnership` is the source of truth for season ownership
- Final standings are the source of truth for draft-order generation
- `Draft`, `DraftPick`, and `KeeperSelection` are historical offseason records
- Cross-season member continuity should prefer `userId`, not raw `LeagueMember.id`
- Draft logic belongs in `draft-service`
- Standings logic belongs in `results-service`
- History aggregation belongs in `history-service`
- Session lookup belongs in route/session helpers, not business logic

## Known Technical Caveats
- Credentials auth is implemented, but password reset and email verification are not
- Provider ingestion code still exists
  - but it is not the active workflow
  - manual final standings are the current product direction
- Prisma migration history may need care in local development
  - additive migration files exist
  - earlier project work used `db push` as a practical fallback in some cases
  - verify local DB workflow before assuming `migrate dev` is clean
- `prisma generate` may fail on Windows if a running `next dev` process is holding the Prisma query engine DLL open
