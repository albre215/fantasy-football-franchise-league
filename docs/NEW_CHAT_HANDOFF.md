# New Chat Handoff

Use this file to bootstrap a fresh chat quickly without re-explaining the whole app.

## Repo + Working Context
- Active repo: `C:\Users\Ben\GM Fantasy`
- Treat `GM Fantasy` as the only active repo unless explicitly told otherwise
- Current branch at handoff creation: `fix/phase-10-5-analytics-hardening`
- Stack:
  - Next.js 14 App Router
  - TypeScript
  - Tailwind CSS
  - Prisma
  - PostgreSQL
  - NextAuth credentials auth

## What The Product Is
GM Fantasy is a commissioner-first fantasy franchise league app where owners control NFL teams, not player rosters.

The app currently supports:
- league creation and joining
- member/bootstrap management
- season management and lock/unlock workflow
- active-season team ownership management
- provider-backed NFL performance tracking
- final standings entry and overwrite flow
- season ledger balances and manual adjustments
- fantasy payout posting into the ledger
- ledger-based offseason draft recommendation
- explicit DROP_PHASE keeper / release workflow
- replacement draft lifecycle
- league phase controls
- owner-facing read-only views
- NFL results -> ledger posting
- history and analytics views

## Non-Negotiable Domain Rules
- `TeamOwnership` is the source of truth for season ownership
- `SeasonStanding` is the source of truth for final fantasy standings
- `LedgerEntry` is the source of truth for money / winnings
- `Season.leaguePhase` is the source of truth for workflow phase
- offseason history persists in `Draft`, `DraftPick`, and `KeeperSelection`
- cross-season identity continuity uses `userId`, not `leagueMemberId`
- `User` and `LeagueMember` remain separate
- services contain business logic
- routes stay thin
- UI should not contain business logic

## Major Current Features Already Implemented

### Auth
- sign in / create account
- session-derived route identity
- commissioner-only mutations enforced in services

### League dashboard
- commissioner console with tabs:
  - `Overview`
  - `Seasons`
  - `Members`
  - `Ownership`
  - `Results & Draft`
  - `NFL Performance`
  - `Ledger`
  - `History & Analytics`

### Ownership
- active-season ownership workspace
- assignment/removal
- season lock awareness

### NFL Performance
- provider-backed NFL imports
- automatic import for the active season
- weekly results review
- commissioner corrections
- season import history

### Results & Ledger
- manual final standings save / overwrite
- fantasy payouts posted into `LedgerEntry`
- season-scoped fantasy payout config
- league balances and owner ledger detail
- commissioner manual adjustments

### Offseason draft
- recommendation based on previous-season ledger totals
- deterministic tie-breaks
- keeper save flow
- draft start / pause / resume / pick / finalize / reset / override order
- phase-gated draft preparation and execution

### League phases
- persisted `Season.leaguePhase`
- supported phases:
  - `IN_SEASON`
  - `POST_SEASON`
  - `DROP_PHASE`
  - `DRAFT_PHASE`
- commissioner phase transition controls exist

### History & Analytics
- overview / franchise / owner / draft analytics
- server-side aggregation
- metric definitions are standardized in `docs/05-analytics-metric-definitions.md`

## Current Product Shape

### Ownership
- active-season ownership is manual and commissioner-controlled
- `TeamOwnership` is canonical

### Standings
- final standings are manual
- standings are stored in `SeasonStanding`
- standings are not the financial truth

### Ledger
- season winnings flow through `LedgerEntry`
- fantasy payouts are persisted into the ledger
- offseason draft recommendation uses ledger totals

### Draft
- tied to target/source seasons
- owners keep 2 teams in `DROP_PHASE`
- each owner releases 1 team into the replacement draft pool
- the replacement draft fills the third team in `DRAFT_PHASE`
- finalization writes target-season `TeamOwnership`

### Phase system
- workflow gating is explicit
- draft workflows are gated to `DRAFT_PHASE`
- `DROP_PHASE` is now the real keeper / release stage

## Local Environment Notes
- Windows git lock-file / permission friction has happened before on this machine
- Prisma generate can fail if the query engine DLL is locked by a running dev server
- stop `npm run dev` before:
  - `npx prisma migrate dev`
  - `npm run prisma:generate`
- recent local migration history was repaired after Phase 5
- do not casually accept Prisma reset prompts against a populated local DB

## Best Files To Read First In A New Chat
1. `docs/01-project-overview.md`
2. `docs/02-repo-architecture.md`
3. `docs/03-current-state-and-completed-prompts.md`
4. `docs/04-roadmap-and-next-steps.md`
5. `docs/PROJECT_HANDOFF_SUMMARY.md`
6. `docs/NEW_CHAT_HANDOFF.md`
7. `docs/05-analytics-metric-definitions.md`

## Best Prompt Framing For A New Chat
Tell the new chat:
- this is the `GM Fantasy` repo at `C:\Users\Ben\GM Fantasy`
- do not use the old `fantasy_franchise_league` folder unless explicitly asked
- preserve the domain rules listed above
- preserve thin routes + service-owned logic
- preserve `User` vs `LeagueMember`
- preserve `TeamOwnership`, `SeasonStanding`, `LedgerEntry`, and `Season.leaguePhase` as distinct source-of-truth layers
- read the docs listed above before proposing or implementing changes

## Current Baseline After This Handoff
- `main` includes:
  - Phase 1 ledger engine
  - Phase 2 NFL performance engine
  - Phase 3 fantasy payouts to ledger
  - Phase 4 ledger-based offseason draft recommendation
  - Phase 4 hardening
  - Phase 5 league phase system
  - Phase 6 real DROP_PHASE keeper / release workflow
  - Phase 7 owner-facing read-only views
  - Phase 8 replacement draft system
  - Phase 9 NFL results -> ledger automation
  - Phase 10 analytics & insights layer
  - Phase 10.5 analytics definitions hardening
  - schema/error-resolution work for `leaguePhase`
  - repaired Prisma migration state and cleaned Phase 5 migration chain
