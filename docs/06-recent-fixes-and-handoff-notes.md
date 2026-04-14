# Recent Fixes and Handoff Notes

Use this file as the quickest "what just changed?" reference.

## Current Repo
- Active repo: `C:\Users\Ben\GM Fantasy`
- Treat `GM Fantasy` as the active repo unless explicitly told otherwise
- Current baseline branch for handoff purposes: `main`

## Most Recent Product / UX Changes

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

## Local Environment Notes
- Windows Git/Prisma locking still happens on this machine
- stop `npm run dev` before Prisma migration/generate work
- do not casually accept destructive Prisma reset prompts against a populated DB
- real recovery delivery requires valid provider env vars in `.env`
