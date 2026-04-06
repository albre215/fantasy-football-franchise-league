# Roadmap and Next Steps

This roadmap reflects the repo after Phases 1 through 5 and the recent schema/error-resolution work.

## Current Baseline

Already implemented:
- real authentication
- league bootstrap and season management
- active-season ownership management
- NFL performance engine
- ledger engine
- fantasy standings -> ledger integration
- ledger-based offseason draft recommendation
- league phase system
- offseason keeper and slow-draft lifecycle
- history and analytics views

## Recommended Next Product Work

### Phase 6 - Drop / Keeper Workflow

#### Goal
Use the existing `DROP_PHASE` to implement the explicit keeper/release window.

#### What It Should Enable
- each owner keeps 2 teams and releases 1
- keeper/release review before draft prep
- explicit transition from `DROP_PHASE` into `DRAFT_PHASE`

#### Why It Is Next
- `DROP_PHASE` now exists but is only a gating/state layer
- phase infrastructure is in place
- draft recommendation and draft prep are already phase-aware

### Phase 7 - Owner-Facing Views

#### Goal
Add a non-commissioner experience rooted in the current historical and season data.

#### What It Should Enable
- owner portfolio view
- owner history
- season balances and results visibility
- future owner-facing draft context

## Important Technical Follow-Up

### Performance
Slow endpoints still worth profiling:
- ownership
- draft
- NFL overview/week reads
- phase context

### Testing
Good next test targets:
- season-service paths involving active season / year updates
- season-phase-service transition coverage
- NFL auto-import and import concurrency behavior
- ledger + results integration edge cases

### Migration Hygiene
The repo-side Phase 5 migration chain is now cleaned up, but this remains important:
- stop `next dev` before Prisma migration/generate work on Windows
- do not casually accept destructive Prisma reset prompts against a populated local DB
- if drift appears again, inspect migration history before resetting

## Important Constraints For Future Work

- preserve `TeamOwnership` as ownership truth
- preserve `SeasonStanding` as final fantasy standings truth
- preserve `LedgerEntry` as money truth
- preserve `Season.leaguePhase` as workflow truth
- keep draft logic in `draft-service`
- keep routes thin and services authoritative
- keep `User` separate from `LeagueMember`

## Suggested Files To Read First In A New Chat

1. `docs/01-project-overview.md`
2. `docs/02-repo-architecture.md`
3. `docs/03-current-state-and-completed-prompts.md`
4. `docs/04-roadmap-and-next-steps.md`
5. `docs/PROJECT_HANDOFF_SUMMARY.md`
6. `docs/NEW_CHAT_HANDOFF.md`

## Short Continuation Checklist

- confirm branch and git status
- confirm the work is happening in `C:\Users\Ben\GM Fantasy`
- inspect current phase/results/draft services before editing
- preserve ledger-based offseason recommendation
- preserve phase-gated draft workflow
- preserve historical semantics and source-of-truth boundaries
