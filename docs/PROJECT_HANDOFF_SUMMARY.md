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
- Real authentication and session-backed commissioner access
- League bootstrap and season management
- Active-season team ownership management
- Season lock/unlock validation
- Manual final standings entry
- Reverse draft-order generation from final standings
- Offseason keeper workflow
- Offseason slow draft lifecycle
- Draft finalization into season ownership
- History and analytics views for ownership and draft history

## Current Source-of-Truth Rules
- `TeamOwnership` is the source of truth for season ownership
- `SeasonStanding` is the source of truth for final standings
- Draft order is derived from the immediately previous season's saved final standings
- `Draft`, `DraftPick`, and `KeeperSelection` preserve offseason history
- Cross-season owner continuity should be mapped through `userId`

## Current Workflow
1. Sign in or create an account
2. Save final standings for the completed season
3. Activate the next season
4. Offseason draft workspace is prepared automatically from the immediately previous season
5. Owners save 2 keepers each
6. Generated draft order appears after keepers are complete
7. Commissioner starts the draft
8. Picks are recorded
9. Draft is finalized into `TeamOwnership`

## Next Recommended Prompt
Prompt 11 — Owner Dashboard

## Why That Is Next
- Authentication now exists and sensitive mutations are session-backed
- The app has enough owner-relevant data to support a dedicated owner experience
- Commissioner workflows can stay focused while owner-specific views are introduced cleanly

## Top Risks / Caveats
- Prisma migration workflow may need care in local development
- Provider ingestion code still exists but is not the active product workflow
- Historical semantics must be preserved; do not flatten current-state shortcuts into core models
- Password reset and email verification are not implemented yet

## Exact Instructions For Seeding A New ChatGPT Conversation
Start the new conversation with:

1. The current branch name
2. A note that this is a fantasy franchise league app where owners control NFL teams
3. A note that final standings are manual and drive draft order automation
4. A note that `TeamOwnership` is the source of truth for season ownership
5. A note that authentication is already implemented and mutation routes derive identity from the session
6. A request to read:
   - `docs/01-project-overview.md`
   - `docs/02-repo-architecture.md`
   - `docs/03-current-state-and-completed-prompts.md`
   - `docs/04-roadmap-and-next-steps.md`
   - `docs/PROJECT_HANDOFF_SUMMARY.md`
7. The specific next prompt or feature you want implemented
