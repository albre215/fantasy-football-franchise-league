# GM Fantasy

GM Fantasy is a commissioner-first web app for a long-running fantasy football league where owners control NFL franchises instead of fantasy player rosters.

The app preserves:
- season-scoped NFL team ownership
- final fantasy standings by season
- season ledger balances and payouts
- offseason keeper and slow-draft history
- long-term franchise and owner analytics

## Current Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- NextAuth credentials-based authentication
- Node.js

## Core Domain Rules

- The league has 10 owners.
- There are 32 NFL teams.
- Each season ends with 3 NFL teams per owner and 2 unassigned teams.
- `TeamOwnership` is the source of truth for season ownership.
- `SeasonStanding` is the source of truth for final fantasy standings.
- `LedgerEntry` is the financial source of truth for season winnings.
- Recommended offseason draft order derives from the immediately previous season's ledger totals, not standings alone.
- Cross-season owner continuity resolves through `userId`, not raw `LeagueMember.id`.
- `Draft`, `DraftPick`, and `KeeperSelection` remain historically queryable offseason records.
- `Season.leaguePhase` is the workflow source of truth for where a season sits in the lifecycle.

## Current Product Flow

1. Sign in or create an account.
2. Create or open a league.
3. Create seasons and set the active season.
4. Use bootstrap tools to manage members and season ownership.
5. NFL results for the active season import automatically.
6. Save final fantasy standings for the completed season.
7. Fantasy payouts are posted into the ledger from those standings.
8. Review offseason draft recommendation from previous-season ledger totals.
9. Move the active season through league phases:
   - `IN_SEASON`
   - `POST_SEASON`
   - `DROP_PHASE`
   - `DRAFT_PHASE`
10. In `DRAFT_PHASE`, save two keepers per owner.
11. Start and run the offseason slow draft.
12. Finalize the draft into target-season `TeamOwnership`.
13. Review ledger, history, and analytics across seasons.

## Important Folders

```text
app/
  api/                        App Router API routes
  league/                     League page entry
components/
  home/                       Sign-in and league entry UI
  league/                     Commissioner workflow panels
  providers/                  Session provider wrapper
  ui/                         Shared UI primitives
lib/
  prisma.ts                   Prisma singleton
  auth-session.ts             Server helpers for authenticated route access
prisma/
  schema.prisma               Authoritative data model
  seed.ts                     NFL team seed
server/
  services/                   Business logic and authorization checks
types/
  *.ts                        Shared request/response/domain contracts
docs/
  *.md                        Project handoff documentation
```

## Current Major Systems

- Authentication:
  - registration
  - credentials sign-in
  - session-derived acting user on mutation routes
- League bootstrap:
  - league creation and joining
  - member management
  - season creation, activation, and lock/unlock
- Ownership:
  - active-season ownership table and workspace
  - manual assignment/removal
- NFL performance:
  - provider-backed NFL result imports
  - automatic import for the active season
  - commissioner review/correction
- Results:
  - manual final standings
  - season-scoped fantasy payout config
  - ledger posting for fantasy payouts
- Ledger:
  - persisted ledger entries
  - season balances
  - manual commissioner adjustments
- Draft:
  - keeper workflow
  - offseason slow draft lifecycle
  - ledger-based draft recommendation
  - phase-gated draft preparation and execution
- History & analytics:
  - ownership history
  - owner/franchise analytics
  - draft history and summaries

## League Phase System

Each season now has a persisted `leaguePhase`:

- `IN_SEASON`
- `POST_SEASON`
- `DROP_PHASE`
- `DRAFT_PHASE`

Important notes:
- phase controls workflow availability
- phase does not replace standings, ownership, or ledger truth
- draft prep and draft execution are gated to `DRAFT_PHASE`

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set required environment variables in `.env`:

   ```env
   DATABASE_URL="postgresql://..."
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="use-a-long-random-string"
   ```

3. Generate Prisma client:

   ```bash
   npm run prisma:generate
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Seed NFL teams if needed:

   ```bash
   npm run prisma:seed
   ```

6. Run tests/build when making changes:

   ```bash
   npm test
   npm run build
   ```

## Prisma / Migration Notes

Current repo state:
- Phase 5 `leaguePhase` is part of the real schema
- the duplicate `add_season_league_phase` migration was removed
- the current migration chain in the repo is the authoritative one

Important local guidance:
- stop `npm run dev` before running Prisma commands on Windows
- if local DB schema and migration history are already out of sync, do not blindly accept a destructive reset
- inspect migration state first
- `db push` can be a practical local recovery tool, but if drift exists it should be followed by migration-history repair

## Developer Notes

- Keep routes thin and business rules in `server/services`.
- Do not flatten `User` and `LeagueMember` together.
- Do not move commissioner authorization into client-only checks.
- Do not move workflow gating into React components.
- Preserve these domain boundaries:
  - `TeamOwnership` = ownership truth
  - `SeasonStanding` = standings truth
  - `LedgerEntry` = money truth
  - `Season.leaguePhase` = workflow truth
