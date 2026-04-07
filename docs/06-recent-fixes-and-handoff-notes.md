# Recent Fixes and Handoff Notes

Use this file as the fastest "what just changed?" reference when starting a fresh chat.

## Current Repo
- Active repo: `C:\Users\Ben\GM Fantasy`
- Treat `GM Fantasy` as the only active repo unless explicitly told otherwise
- Current baseline branch for handoff purposes: `main`

## Most Recent UX / Workflow Fixes

### Membership Management
- Members are now managed as durable league slots.
- Replacing a member does not delete or recreate the slot.
- The existing `LeagueMember` record keeps its history and simply changes which `User` is attached.
- That means the replacement user inherits the slot's:
  - team history
  - current season ownership
  - standings history
  - ledger history
  - draft history

### Members Tab UX
- The old always-visible `Change Member` side panel was removed.
- Clicking `Change Member` now opens a modal.
- The selected member row gets a clear active/selected state.
- The modal closes on save or cancel.
- The commissioner row is explicitly non-replaceable.

### Draft Phase Recommendation Gating
- `DROP_PHASE -> DRAFT_PHASE` no longer stays blocked by stale recommendation warnings when a valid replacement draft workspace already exists.
- A usable existing draft workspace now counts as a trustworthy draft order for entering `DRAFT_PHASE`.

## Important Current Product Semantics

### Membership Semantics
- `LeagueMember` is a durable league slot.
- `User` is the current person attached to that slot.
- Historical league records stay attached to the slot.
- Commissioner-driven member replacement should preserve slot history, not delete it.

### Offseason Semantics
- offseason recommendation is ledger-based, not standings-based
- `DROP_PHASE` is the real keeper/release stage
- `DRAFT_PHASE` is the replacement-draft stage

### Financial Semantics
- fantasy payouts and NFL-derived postings are separate ledger workflows
- reruns replace only the scoped ledger categories they own

## Practical Notes For A New Chat
- Read `docs/NEW_CHAT_HANDOFF.md` first.
- Then read:
  1. `docs/PROJECT_HANDOFF_SUMMARY.md`
  2. `docs/03-current-state-and-completed-prompts.md`
  3. `docs/05-analytics-metric-definitions.md`
- If the task touches members, also inspect:
  - `server/services/league-service.ts`
  - `components/league/league-dashboard.tsx`
  - `app/api/league/[leagueId]/members/replace/route.ts`

## Local Environment Notes
- Windows Git/Prisma locking still happens on this machine.
- Stop `npm run dev` before Prisma migration/generate work.
- Do not casually accept destructive Prisma reset prompts against a populated database.
