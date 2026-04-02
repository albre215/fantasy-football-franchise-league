# New Chat Handoff

Use this file to bootstrap a fresh chat quickly without re-explaining the whole app.

## Repo + Working Context
- Active repo: `C:\Users\Ben\GM Fantasy`
- Treat `GM Fantasy` as the only active repo unless explicitly told otherwise
- Current branch at handoff creation: `main`
- Stack:
  - Next.js 14 App Router
  - TypeScript
  - Tailwind CSS
  - Prisma
  - PostgreSQL
  - NextAuth credentials auth

## What The Product Is
GM Fantasy is a commissioner-first fantasy franchise league app where owners control NFL teams, not player rosters.

The app supports:
- league creation and joining
- member/bootstrap management
- season management and lock/unlock workflow
- active-season team ownership management
- final standings entry and overwrite flow
- reverse draft-order generation from saved standings
- offseason keeper and draft lifecycle
- history + analytics views
- season ledger / money tracking foundation

## Non-Negotiable Domain Rules
- `TeamOwnership` is the source of truth for season ownership
- `SeasonStanding` is the source of truth for final standings
- draft order derives from saved standings
- offseason history persists in `Draft`, `DraftPick`, and `KeeperSelection`
- cross-season identity continuity uses `userId`, not `leagueMemberId`
- `User` and `LeagueMember` remain separate
- services contain business logic
- routes stay thin
- UI should not contain business logic

## Major Current Features Already Implemented
- Auth:
  - sign in / create account
  - session-derived route identity
  - commissioner-only mutations enforced in services
- Homepage / branding:
  - GM Fantasy branding system
  - logo integration
  - signed-out auth-first homepage
  - signed-in homepage with `My Leagues`
- League dashboard:
  - tabbed commissioner console
  - `Overview`
  - `Seasons`
  - `Members`
  - `Ownership`
  - `Results & Draft`
  - `Ledger`
  - `History & Analytics`
- NFL logos:
  - shared team logo mapping/component is already in place across the UI
- Results & Draft:
  - manual final standings save / overwrite
  - reverse draft order recommendation
  - offseason draft initialization
  - keeper save flow
  - draft start / pause / resume / pick / finalize / reset / override order
- History & Analytics:
  - analytics routes + service
  - overview / franchise / owner / draft analytics
  - subview-scoped loading with local subview cache
- Ledger engine:
  - persisted `LedgerEntry`
  - `LedgerEntryCategory`
  - season ledger routes
  - commissioner manual adjustments
  - season ledger UI in dashboard

## Current Architecture Anchors
- Schema:
  - `prisma/schema.prisma`
- Core services:
  - `server/services/league-service.ts`
  - `server/services/season-service.ts`
  - `server/services/team-ownership-service.ts`
  - `server/services/results-service.ts`
  - `server/services/draft-service.ts`
  - `server/services/analytics-service.ts`
  - `server/services/ledger-service.ts`
- Main commissioner UI:
  - `components/league/league-dashboard.tsx`
- Analytics orchestration:
  - `components/league/league-history-panel.tsx`
  - `components/analytics/analytics-section-state.tsx`
- Ledger UI:
  - `components/league/season-ledger-panel.tsx`

## Current Product Shape
### Ownership
- active-season ownership is manual and commissioner-controlled
- season lock prevents further manual ownership changes

### Standings
- final standings are currently manual
- standings are stored in `SeasonStanding`
- draft order recommendation derives from standings

### Draft
- draft is offseason-only and tied to target/source seasons
- owners keep 2 teams
- draft fills the third team
- finalization writes the target season's `TeamOwnership`

### Analytics
- analytics are read-only
- aggregation is server-side
- UI loads analytics by active subview instead of eagerly loading all views

### Ledger
- phase 1 foundation only
- no automated NFL/fantasy payout generation yet
- manual adjustments exist now
- balances aggregate by season and `leagueMemberId`

## Important Current Limitations / Deferred Work
- No NFL ingestion automation yet
- No ESPN integration yet
- No fantasy standings ingestion automation yet
- No export/reporting system yet
- No notification system
- No email verification / password reset
- Ledger is foundational only; future payout logic is not implemented yet

## Local Environment Notes
- Windows git lock-file / permission friction has happened before on this machine
- Prisma generate can fail if the query engine DLL is locked by a running dev server
- If schema changes were added, stop `npm run dev` before:
  - `npx prisma migrate dev`
  - `npm run prisma:generate`

## Best Files To Read First In A New Chat
1. `docs/01-project-overview.md`
2. `docs/02-repo-architecture.md`
3. `docs/03-current-state-and-completed-prompts.md`
4. `docs/04-roadmap-and-next-steps.md`
5. `docs/PROJECT_HANDOFF_SUMMARY.md`
6. `docs/NEW_CHAT_HANDOFF.md`

## Best Prompt Framing For A New Chat
Tell the new chat:
- this is the `GM Fantasy` repo at `C:\Users\Ben\GM Fantasy`
- do not use the old `fantasy_franchise_league` folder unless explicitly asked
- preserve the domain rules listed above
- preserve thin routes + service-owned logic
- preserve `User` vs `LeagueMember`
- preserve `TeamOwnership` and `SeasonStanding` as source-of-truth models
- read the docs listed above before proposing or implementing changes

## Current Baseline After This Handoff
- `main` already includes:
  - analytics load-state polish
  - Phase 1 ledger engine
  - slightly larger NFL team logos
