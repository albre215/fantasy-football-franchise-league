# GM Fantasy

GM Fantasy is a commissioner-first web app for a long-running fantasy football league where owners control NFL franchises instead of fantasy player rosters.

The app preserves:
- season-scoped NFL team ownership
- manual final standings by season
- offseason keeper and slow draft history
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
- `SeasonStanding` is the source of truth for final standings.
- Offseason draft order is generated from the immediately previous season's saved final standings.
- `Draft`, `DraftPick`, and `KeeperSelection` remain historically queryable offseason records.
- Cross-season owner continuity should resolve through `userId`, not raw `LeagueMember.id`.

## Main Product Flow

1. Sign in or create an account.
2. Create or open a league.
3. Create seasons and set the active season.
4. Record final standings for the completed season.
5. Let the app prepare the offseason keeper workspace for the new active season.
6. Save two keepers for each owner.
7. Start and run the offseason slow draft.
8. Finalize the draft into target-season `TeamOwnership`.
9. Review history and analytics across seasons.

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

## Authentication

Prompt 10 replaces the old mock commissioner identity with a real session-backed flow.

Current auth setup:
- credentials-based sign-in with email + password
- user registration via `/api/auth/register`
- protected league and dashboard pages
- mutation routes derive the acting user from the authenticated session
- league/season commissioner checks still happen server-side inside services

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Set required environment variables in `.env`:

   ```env
   DATABASE_URL="postgresql://..."
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="use-a-long-random-string"
   ```

4. Update Prisma and generate the client.

   Preferred if your local migration history is healthy:

   ```bash
   npx prisma migrate dev
   npm run prisma:generate
   ```

   If your local migration history is already out of sync, use:

   ```bash
   npx prisma db push
   npm run prisma:generate
   ```

5. Seed NFL teams if needed:

   ```bash
   npm run prisma:seed
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

7. Run the auth/authorization regression tests when you make auth-sensitive changes:

   ```bash
   npm test
   ```

Open `http://localhost:3000`.

## Developer Notes

- The repo still contains some dormant ingestion code, but manual final standings are the active product direction.
- Keep routes thin and business rules in `server/services`.
- Do not flatten `User` and `LeagueMember` together.
- Do not move commissioner authorization into client-only checks.
- Be careful with Prisma migration history in local development; `db push` may be safer than forcing a broken migration chain.
