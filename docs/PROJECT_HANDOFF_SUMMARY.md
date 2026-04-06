# Project Handoff Summary

## What This App Is
GM Fantasy is a commissioner-first web app for managing a long-running fantasy football league where owners control NFL franchises instead of fantasy players.

## Current Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- NextAuth credentials auth
- Node.js

## Current Completed Functionality
- real authentication and session-backed commissioner access
- league bootstrap and season management
- active-season team ownership management
- season lock/unlock validation
- provider-backed NFL performance engine with automatic active-season imports
- manual final standings entry
- fantasy payout posting into the ledger
- season ledger balances and commissioner adjustments
- ledger-based offseason draft recommendation
- offseason keeper workflow
- offseason slow draft lifecycle
- league phase system
- draft finalization into season ownership
- history and analytics views for ownership and draft history

## Current Source-of-Truth Rules
- `TeamOwnership` is the source of truth for season ownership
- `SeasonStanding` is the source of truth for final fantasy standings
- `LedgerEntry` is the source of truth for money / winnings
- `Season.leaguePhase` is the source of truth for workflow phase
- recommended offseason draft order is derived from the immediately previous season's ledger totals
- `Draft`, `DraftPick`, and `KeeperSelection` preserve offseason history
- cross-season owner continuity maps through `userId`

## Current Workflow
1. Sign in or create an account
2. Create/open a league
3. Create seasons and set active season
4. Manage members and season ownership
5. Let active-season NFL results import automatically
6. Save final fantasy standings for the completed season
7. Publish fantasy payouts into the ledger
8. Review ledger-based offseason draft recommendation for the next season
9. Move the target season through phases
10. In `DRAFT_PHASE`, save keepers
11. Start the draft
12. Record picks
13. Finalize the draft into `TeamOwnership`
14. Review ledger, history, and analytics

## Next Recommended Prompt
Implement the real `DROP_PHASE` keeper/release workflow.

## Why That Is Next
- `DROP_PHASE` is now persisted and visible but not yet backed by full keeper/release mechanics
- phase infrastructure, ledger-based recommendation, and draft gating are already in place
- this is the most natural next product step before replacement draft or inaugural auction work

## Top Risks / Caveats
- Windows can lock Git and Prisma files while `next dev` is running
- stop the dev server before Prisma migrate/generate work
- do not casually accept destructive Prisma reset prompts against a populated local DB
- provider ingestion code still exists but manual fantasy standings remain the active workflow
- historical semantics must be preserved; do not flatten ownership, standings, ledger, and phase state together

## Exact Instructions For Seeding A New AI Review
Start the new conversation with:

1. The current branch name
2. A note that this is the `GM Fantasy` repo at `C:\Users\Ben\GM Fantasy`
3. A note that owners control NFL teams, not fantasy players
4. A note that:
   - `TeamOwnership` = ownership truth
   - `SeasonStanding` = standings truth
   - `LedgerEntry` = money truth
   - `Season.leaguePhase` = workflow truth
5. A note that offseason draft recommendation is ledger-based, not standings-based
6. A note that Phase 5 league phases are implemented
7. A request to read:
   - `docs/01-project-overview.md`
   - `docs/02-repo-architecture.md`
   - `docs/03-current-state-and-completed-prompts.md`
   - `docs/04-roadmap-and-next-steps.md`
   - `docs/PROJECT_HANDOFF_SUMMARY.md`
   - `docs/NEW_CHAT_HANDOFF.md`
8. The specific review or next feature request you want
