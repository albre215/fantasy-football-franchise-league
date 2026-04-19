# Current State and Completed Work

This file summarizes the repo as it exists after the inaugural auction implementation, recent season-creation adjustments, the league dashboard hydration fix, and the current in-progress inaugural auction simulation branch work.

## Major Product Areas Already Implemented

### League bootstrap
- league creation and joining
- home landing page with `My Leagues`
- unified league entry through `Open League`
- season creation and active-season management
- season lock / unlock workflow
- season year editing

### Membership management
- commissioner can add members
- commissioner can replace a non-commissioner member
- replacement preserves the existing `LeagueMember` slot and its history
- the Members tab uses a modal-based replacement flow

### Ownership
- active-season team ownership assignment / removal
- season lock awareness
- season-backed ownership reads

### NFL performance
- provider-backed NFL result imports
- automatic import for the active season
- weekly NFL review
- commissioner corrections
- season import history
- owner NFL rollups

### Fantasy results and ledger
- manual final fantasy standings save / overwrite
- fantasy payout posting into `LedgerEntry`
- season ledger balances
- owner ledger detail
- commissioner manual adjustments
- NFL results -> ledger posting

### Offseason workflow
- persisted league phases
- explicit `DROP_PHASE` keeper / release workflow
- ledger-based replacement-draft recommendation
- replacement draft lifecycle
- draft finalization into target-season `TeamOwnership`
- inaugural auction lifecycle for brand-new leagues
- season-level draft mode split between continuing vs inaugural flows

### History and analytics
- league overview
- owner history
- franchise history
- draft history
- analytics views
- shared analytics metric dictionary in `docs/05-analytics-metric-definitions.md`

### Auth and recovery
- credentials sign-in
- account registration
- editable account settings
- password change from account settings
- password reset request / validate / complete flow
- Resend-backed password reset email delivery
- temporary phone login request + verify flow
- Twilio Verify integration for provider-mode phone verification
- local preview modes for dev only
- preview modes blocked in production
- recovery hardening:
  - request throttling
  - challenge attempt tracking
  - temporary challenge lockout/invalidation
  - neutral password-reset request responses

### Account/profile UX
- account settings page
- editable display name / email / phone
- phone auto-formatting
- profile picture upload with circular framing
- shared profile avatars across major league surfaces
- account icon available in the shared hero treatment across pages

### Unified league workspace UX
- commissioner and owner views are combined into one league route
- commissioners can toggle between the two views in-page
- the commissioner hero now matches the simpler home/account style
- overview panel layout has been cleaned up and simplified
- inaugural auction room is integrated into the shared league workspace
- commissioner-only `Simulate Remaining Auction Draft` control is live in the auction room (merged to `main`) and enables once attending members are at 3/3 teams
- `POST /api/season/[seasonId]/inaugural-auction/simulate-remaining` assigns unsold teams to absent owners at $1 using the shared auto-assign rules
- auction state returns `presentMemberIds` and a rich `finalSummary` payload consumed by the post-auction UI

### Draft tab post-completion UX (merged on `main`)
- once `auctionState.auction.status === "COMPLETED"`:
  - the Draft Schedule panel is hidden entirely (keeper and offseason dates are fully automated, so nothing is left to schedule)
  - the Nomination Order and Owner Budgets panels are hidden
  - an inline Summary card renders with biggest/lowest spender and per-owner teams
  - an Upcoming Dates card renders with three rows, all auto-computed from the season's NFL Super Bowl:
    - Super Bowl = 2nd Sunday of February in `season.year + 1`
    - Keeper Selection Deadline = Monday after Super Bowl at 11:59 PM (owner must drop 1 team by this time)
    - Offseason Draft = Tuesday after Super Bowl at 12:00 PM
- final-summary modal:
  - is scrollable (`overflow-y-auto` on backdrop, `my-8` on card) with body scroll lock while open
  - has an X close button top-right and a footer `Close` button (both dismiss without navigating)
  - auto-pops exactly once per auction, gated by `localStorage` key `inaugural-summary-seen:<auctionId>`
- scheduler (`components/league/draft-scheduler.tsx`):
  - hides the past-dated "Currently scheduled" line once the scheduled time has passed
  - hides the `INAUGURAL` dropdown option once the inaugural auction is complete
  - returns `null` for the entire card once the inaugural auction is complete (detected via a fetch to `/api/season/${seasonId}/inaugural-auction` checking `payload.auction?.auction?.status === "COMPLETED"`)

### Season creation behavior
- creating a season now automatically makes that season active
- create-season year defaults follow the GM Fantasy season rollover rule:
  - the day after the Super Bowl starts the new GM Fantasy season year
  - for example, February 10, 2025 starts the 2025 GM Fantasy season
- the Seasons tab has less phase-heavy/status-heavy clutter in the season cards

## Current Commissioner Workflow

1. Sign in or create an account
2. Create or open a league from home
3. Create seasons and set the active season
4. Manage members and active-season ownership
5. Let active-season NFL results import automatically
6. Save final fantasy standings for the completed season
7. Publish fantasy payouts into the ledger
8. Review the ledger-based replacement-draft recommendation
9. Move the target season through phases as needed
10. In `DROP_PHASE`, save 2 keepers and review the released-team pool
11. In `DRAFT_PHASE`, run the replacement draft
12. Finalize the draft into target-season ownership
13. Review owner view, ledger, history, and analytics

## Current Source-of-Truth Summary
- `TeamOwnership` = ownership truth
- `SeasonStanding` = final fantasy standings truth
- `LedgerEntry` = money truth
- `Season.leaguePhase` = workflow truth
- `LeagueMember` = durable slot truth inside a league
- `User` = current person attached to that slot

## Important Recent Hardening / UX Improvements
- member replacement preserves slot history
- auth recovery uses provider-backed delivery
- temporary login challenges are throttled and attempt-limited
- password reset request responses are safer against account enumeration
- home page and league page entry paths were simplified
- commissioner and owner dashboards were unified
- account/profile avatar coverage expanded across major league panels
- commissioner overview UI was simplified for clearer handoff/review
- league dashboard hydration bug caused by `ProfileAvatar` inside a `<p>` was fixed

## Current Verification Snapshot
- existing inaugural auction service tests cover bid validation, late-bid clock extension, tie resolution, immediate `$98` awards, and finalization into `TeamOwnership`
- the current `simulate remaining` branch work does not yet have matching service-route/UI test coverage in `tests/services/inaugural-auction-service.test.ts`
- local `npm test -- inaugural-auction-service` was attempted during this handoff but Vitest failed to start in this environment with a Windows `spawn EPERM` startup error, so this branch work is not verified by test execution here

## What The Repo Does Not Yet Support
- configurable entry fees and payout settings end to end
- owner-facing draft actions
- broader constrained-session semantics for temporary recovery login
- true websocket-based live auction updates (still 1s polling)
- keeper-selection workflow UI wired to the auto-computed keeper deadline (deadline is displayed; the drop flow itself still relies on the existing `DROP_PHASE` tooling)
- automated offseason draft trigger at the auto-computed offseason draft time (time is displayed; execution still requires commissioner action)

## Known Unresolved Items
- intermittent `"Unable to load the inaugural auction"` error after a completed test draft (2026-04-19) — no reproducible cause found in `assertInauguralAuctionSeason` / `syncAuctionProgress` / `buildAuctionState`; needs dev-server log capture on next repro
