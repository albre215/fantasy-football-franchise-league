# Recent Fixes and Handoff Notes

Use this file as the quickest "what just changed?" reference.

## Current Repo
- Active repo: `C:\Users\Ben\GM Fantasy`
- Treat `GM Fantasy` as the active repo unless explicitly told otherwise
- Current baseline branch for handoff purposes: `main`
- Current checked-out branch during this handoff: `feature/inaugural-draft-updates` (clean; recent work merged to `main`)

## Most Recent Product / UX Changes

### Inaugural auction path
- inaugural seasons now use a live inaugural auction instead of the continuing-league replacement draft flow
- season `draftMode` distinguishes inaugural vs continuing workflow
- the auction room is embedded in the shared league workspace for commissioners and owners
- final inaugural ownership still persists only into `TeamOwnership`

### Inaugural auction live-room work (all merged to `main`)
- commissioner-only `Simulate Remaining Auction Draft` action is live at `POST /api/season/[seasonId]/inaugural-auction/simulate-remaining`
- button enables once every present owner is at 3/3 teams; auto-assign at $1 routes to the highest-budget absent owner (alpha tiebreak)
- draft lobby + presence (`Join Draft`) and auto-assign on clock expiry all shipped in PR1–PR4

### Draft tab post-inaugural-auction UX (merged on `main` in `535b77a`, preceded by `8da6c22`)
- once the inaugural auction is `COMPLETED`:
  - Draft Schedule panel is hidden entirely (keeper/offseason dates are automated)
  - Nomination Order and Owner Budgets panels are hidden
  - inline Summary card (biggest/lowest spender, per-owner teams) renders on the Draft tab
  - Upcoming Dates card shows Super Bowl, Keeper Selection Deadline, and Offseason Draft times, all auto-computed from `season.year + 1`'s 2nd Sunday of February
  - final-summary modal is scrollable, has an X close and body scroll lock, and auto-opens exactly once per auction via `localStorage` key `inaugural-summary-seen:<auctionId>`
  - `Return Home` replaced with `Close` (dismisses without navigation)
- before completion, the `INAUGURAL` option is shown in the scheduler dropdown; it is removed once the auction completes
- the scheduler also hides the "Currently scheduled" line when the saved `scheduledAt` is in the past

### Season creation cleanup
- newly created seasons now become active automatically
- create-season year defaults follow the GM Fantasy post-Super-Bowl rollover rule
- the Seasons tab is now create-first, with `Create New Season` at the top and seasons listed directly below
- Seasons tab cards no longer show the extra phase/status/helper copy that was cluttering the UI
- season cards still allow post-create year edits, and inactive `Set Active` buttons now match the `Active Season` button width

### Home + league entry cleanup
- `My Leagues` is the main home-page league launcher
- duplicate `Open League Hub` flow was removed
- join/create league actions were simplified and tightened
- join-league suggestions now narrow as the user types

### Unified league workspace
- commissioner and owner dashboards were combined into a single league page
- commissioners can toggle between commissioner and owner view in-page
- separate owner-link panel on the home page was removed

### Commissioner overview cleanup
- league hero was simplified to match home/account styling
- overview cards were cleaned up and reduced in verbosity
- current-state and next-action data were combined into one panel
- dashboard-view toggle placement was standardized at the bottom

### Hydration / error cleanup
- fixed a league dashboard hydration error caused by rendering `ProfileAvatar` inside a `<p>`
- the invalid nesting produced the recent bottom-right Next.js overlay errors on the league page

### Account settings and profile UX
- account page was visually aligned with the home/league hero system
- profile picture upload + circular framing editor were added
- shared avatars now appear in major league and owner surfaces
- reset-password modal was added inside account settings

## Most Recent Auth / Recovery Changes

### Password recovery
- password reset flow now exists end to end
- Resend-backed password reset delivery is implemented
- preview email mode remains available for local/dev only

### Temporary login by phone
- temporary login flow now exists end to end
- Twilio Verify-backed SMS send/check is implemented
- preview SMS mode remains available for local/dev only

### Recovery hardening
- password reset request responses were neutralized at the route layer
- repeated recovery requests are throttled
- temporary login challenges track attempts
- repeated invalid verification attempts trigger lockout/invalidation
- preview modes are blocked in production
- account/session payloads do not carry large profile-image data

## Important Current Product Semantics

### Membership semantics
- `LeagueMember` is a durable league slot
- `User` is the current person attached to that slot
- replacing a member preserves slot history

### Offseason semantics
- offseason recommendation is ledger-based, not standings-based
- `DROP_PHASE` is the keeper / release stage
- `DRAFT_PHASE` is the replacement-draft stage
- phases are primarily internal workflow machinery and should not dominate user-facing UI unless needed

### Financial semantics
- fantasy payouts and NFL-derived postings are separate ledger workflows
- reruns replace only the scoped ledger categories they own

## Practical Notes For A New Chat
- read `docs/00-start-here.md` first
- then read:
  1. `docs/01-project-overview.md`
  2. `docs/02-repo-architecture.md`
  3. `docs/03-current-state-and-completed-prompts.md`
  4. `docs/04-roadmap-and-next-steps.md`
- if the task touches auth/recovery, also inspect:
  - `server/services/auth-recovery-service.ts`
  - `server/services/recovery-delivery-service.ts`
  - `auth.ts`
- if the task touches members or the commissioner workspace, also inspect:
  - `server/services/league-service.ts`
  - `components/league/league-dashboard.tsx`
  - `components/league/commissioner-tools-panel.tsx`
  - `components/league/inaugural-auction-panel.tsx`
  - `server/services/inaugural-auction-service.ts`
- if the task specifically continues the current branch work, inspect:
  - `app/api/season/[seasonId]/inaugural-auction/simulate-remaining/route.ts`
  - `tests/services/inaugural-auction-service.test.ts`
  - `prisma/schema.prisma`

## Local Environment Notes
- Windows Git/Prisma locking still happens on this machine
- stop `npm run dev` before Prisma migration/generate work
- do not casually accept destructive Prisma reset prompts against a populated DB
- real recovery delivery requires valid provider env vars in `.env`
- if a task is being handed off from the current checkout rather than `main`, mention the active branch explicitly because recent fixes may live on a feature branch before merge
- local test attempt during this handoff:
  - `npm test -- inaugural-auction-service`
  - result: Vitest startup failed in this environment with Windows `spawn EPERM`, so branch-local auction simulation work was not test-verified here

## Known Unresolved Items
- intermittent `"Unable to load the inaugural auction"` error surfaced after a completed test draft on 2026-04-19; root cause not yet identified (checked `assertInauguralAuctionSeason`, `syncAuctionProgress`, `buildAuctionState` with no obvious cause; `season.draftMode` is never cleared). Needs dev-server log capture on next repro.
