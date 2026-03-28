# Roadmap and Next Steps

This roadmap reflects the intended progression of the current codebase from its present state.

## Prompt 10 — Authentication System

### Current State
Implemented.

### What Landed
- credentials-based sign-in
- account registration
- protected commissioner pages
- session-derived acting user identity for sensitive mutations
- preserved service-layer commissioner role checks

## Prompt 11 — Owner Dashboard

### Intended Goal
Create an owner-facing experience distinct from the commissioner bootstrap console.

### What It Should Enable
- owner portfolio view
- owner history
- keeper awareness
- season standing visibility
- eventually owner-facing draft participation context

### How the Current Repo Prepares For It
- ownership, history, standings, and draft state already have read models
- `history-service` and `team-ownership-service` already expose owner-relevant data
- auth now provides a real session-backed `userId` to anchor owner-specific screens

### Constraints To Preserve
- do not move commissioner workflow logic into owner screens
- keep active-season ownership canonical from `TeamOwnership`
- continue resolving cross-season continuity through `userId`

## Prompt 12 — Commissioner Tools

### Intended Goal
Add richer commissioner tooling beyond the current basic console.

### What It Should Enable
- corrections and exception handling
- stronger review workflows
- safer administrative actions
- better draft and standings management ergonomics

### How the Current Repo Prepares For It
- commissioner routes and service checks already exist
- season, standings, and draft workflows are already centralized in services
- auth now gives those tools a real permission boundary

### Constraints To Preserve
- commissioner overrides should be explicit and historically meaningful
- do not bypass core validation rules in the name of convenience

## Prompt 13 — Visualization & Analytics UI

### Intended Goal
Turn historical data into stronger visual reporting and richer analytics presentation.

### What It Should Enable
- charts and trends
- championship and drought views once richer results exist
- decade-level summaries
- stronger comparative analytics for owners and franchises

### How the Current Repo Prepares For It
- `history-service` already builds structured read models
- standings, ownership, and draft records are already historically queryable
- manual standings now give results-based analytics a stable source of truth

### Constraints To Preserve
- visualization should consume existing read models or carefully added read models
- do not push analytics derivation into UI components

## Prompt 14 — Long-Term Stability & Performance

### Intended Goal
Harden the application for longer-term maintainability and operational safety.

### What It Should Enable
- better test coverage
- more predictable migrations
- safer production rollout
- improved query efficiency and state handling

### How the Current Repo Prepares For It
- domain logic is already relatively centralized
- services and types are reasonably separated by concern
- auth is now integrated without collapsing the existing domain model

### Constraints To Preserve
- avoid flattening historical models for short-term optimization
- keep domain boundaries clean while improving reliability

## Recommended Next Prompt
Prompt 11 — Owner Dashboard

## Why Prompt 11 Should Be Next
- Authentication is now in place, so owner-specific screens can be built on real session identity instead of mock assumptions.
- The repo already has the necessary read models for ownership, standings, history, and offseason draft context.
- This is the right point to separate owner-facing experience from the commissioner bootstrap console without redesigning the underlying domain.

## Technical Debt / Cleanup Worth Addressing Alongside Prompt 11
- Review local Prisma migration workflow and document the safest dev path
- Revisit dormant ingestion code and decide whether to keep it dormant, hide it further, or remove it later
- Add tests around:
  - authentication and authenticated route access
  - commissioner authorization
  - standings save validation
  - draft order generation
  - keeper locking
  - draft finalization
- Add password reset and email verification later if product scope calls for them

## Important Constraints For Future Work
- Preserve `TeamOwnership` as the source of truth for season ownership
- Preserve `SeasonStanding` as the source of truth for final finishing order
- Preserve `Draft`, `DraftPick`, and `KeeperSelection` as offseason history records
- Continue to prefer `userId` for cross-season identity mapping
- Keep service-layer business rules centralized and routes thin
- Keep `User` separate from `LeagueMember`

## How To Continue This Project In A Fresh ChatGPT Conversation

### Suggested Seed Prompt
Use the current repo plus the docs in `docs/` as the starting context.

Include:
- current branch name
- whether `main` is the target branch
- the current active prompt you want to implement
- any recent UI or workflow decisions that must be preserved

### Best Files To Reference First
- `docs/01-project-overview.md`
- `docs/02-repo-architecture.md`
- `docs/03-current-state-and-completed-prompts.md`
- `docs/04-roadmap-and-next-steps.md`
- `docs/PROJECT_HANDOFF_SUMMARY.md`

### Suggested Opening Context For A New Assistant
- This is a commissioner-first fantasy franchise league app
- Owners control NFL teams, not fantasy players
- Final standings are entered manually
- Draft order is generated from final standings
- Keeper selection happens before draft start
- `TeamOwnership` remains the source of truth for season ownership
- Authentication is already implemented with session-backed route protection

## Short Continuation Checklist
- confirm branch and git status
- inspect current prompt target files before editing
- preserve current offseason order of operations
- preserve historical data semantics
- avoid schema redesign unless clearly necessary
