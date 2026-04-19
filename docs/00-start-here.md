# Start Here

Use this file first when handing the repo to another AI.

## Repo
- Active repo: `C:\Users\Ben\GM Fantasy`
- Default branch baseline for handoff: `main`
- Treat `GM Fantasy` as the active repo unless explicitly told otherwise

## Read These Next
1. `docs/01-project-overview.md`
2. `docs/02-repo-architecture.md`
3. `docs/03-current-state-and-completed-prompts.md`
4. `docs/04-roadmap-and-next-steps.md`
5. `docs/05-analytics-metric-definitions.md`
6. `docs/06-recent-fixes-and-handoff-notes.md`
7. `docs/NEW_CHAT_HANDOFF.md`

## Non-Negotiable Domain Rules
- `TeamOwnership` = ownership truth
- `SeasonStanding` = final fantasy standings truth
- `LedgerEntry` = money truth
- `Season.leaguePhase` = workflow truth
- `LeagueMember` = durable league slot
- `User` = the current authenticated person attached to that slot
- offseason draft recommendation is ledger-based, not standings-based
- services own business logic
- routes stay thin
- UI should not become the business-logic layer

## Current Product Shape
- home page is the authenticated landing page
- `My Leagues` is the single league-entry path from home
- `Open League` launches a unified league workspace
- commissioners can toggle between commissioner and owner views inside the same league page
- season creation now auto-activates the newly created season
- new-season year defaults follow the GM Fantasy post-Super-Bowl rollover rule
- the Seasons tab is now a simplified create-first list: `Create New Season` at the top, seasons listed below, and year edits remain available after creation
- inaugural seasons now use a live inaugural auction path instead of the continuing-league replacement draft flow
- account settings, avatars, recovery flows, Resend email delivery, Twilio Verify temporary login, and auth hardening are all implemented

## Current Next Product Direction
- follow-up work areas: configurable fees/payouts, owner experience polish, analytics expansion, and keeper/offseason draft automation (inaugural auction live room is now feature-complete and merged to `main`)

## Current Branch Context
- `main` contains the full inaugural auction live-room flow (lobby/presence/auto-assign/simulate-remaining), the Draft tab post-auction UX (inline summary, Upcoming Dates card, hidden scheduler and nomination/budget panels once the auction is complete), and the scrollable final-summary modal with X-close and single-pop behavior
- most recent merges on `main`:
  - `feature/inaugural-draft-fixes` (`8da6c22`) — hid past-dated scheduled text, made the final-summary modal scrollable with an X close, and fixed the Return-Home button so it just dismisses the modal and stays on the Draft tab
  - `feature/draft-tab-post-auction` (`535b77a`) — streamlined Draft tab once the inaugural auction is `COMPLETED`: inline summary card, auto-computed Upcoming Dates (keeper deadline + offseason draft from NFL Super Bowl), scheduler moved to bottom and hidden entirely post-complete, Nomination Order and Owner Budgets panels hidden post-complete, final-summary modal auto-pops exactly once per auction via `localStorage` key `inaugural-summary-seen:<auctionId>`
- current checked-out branch: `feature/inaugural-draft-updates` (baseline, no active in-progress work)

## Current Working Tree Notes
- untracked workspace items currently present:
  - `.claude/`
  - `public/brand/gm-fantasy-shield-raw.png`
  - `tsconfig.tsbuildinfo`

## Known Unresolved Items
- a sporadic `"Unable to load the inaugural auction"` error was reported after a completed test draft; no reproducible cause identified yet, still awaiting dev-server logs from the user to diagnose

## Local Environment Notes
- Windows Git / Prisma lock friction still happens on this machine
- stop `npm run dev` before Prisma migration or generate commands
- do not casually accept destructive Prisma reset prompts against a populated local DB
- provider-backed recovery requires real env vars; preview modes are for local/dev only

## Best New-Chat Prompt Shape
Tell the new AI:
- this is the `GM Fantasy` repo at `C:\Users\Ben\GM Fantasy`
- owners control NFL teams, not fantasy players
- preserve the source-of-truth rules listed above
- preserve the current provider integrations and unified league workspace shape
- read the docs listed above before proposing changes
