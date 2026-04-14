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
- account settings, avatars, recovery flows, Resend email delivery, Twilio Verify temporary login, and auth hardening are all implemented

## Current Next Product Direction
- most likely next major feature: inaugural auction / empty-league entry path
- follow-up work areas: owner experience polish, analytics expansion, configurable fees/payouts

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
