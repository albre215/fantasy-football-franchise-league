# Roadmap and Next Steps

This roadmap reflects the repo after Phases 1 through 10.

## Current Baseline

Already implemented:
- real authentication
- league bootstrap and season management
- durable member-slot replacement workflow
- active-season ownership management
- NFL performance engine
- ledger engine
- fantasy standings -> ledger integration
- ledger-based offseason draft recommendation
- league phase system
- explicit DROP_PHASE keeper / release workflow
- replacement draft lifecycle
- owner-facing read-only views
- NFL results -> ledger posting
- history and analytics views
- analytics metric definitions hardening

## Recommended Next Product Work

### Phase 11 - Inaugural Auction / Empty-League Entry Path

#### Goal
Support the path where a brand-new or reset league does not have a previous season to inherit from.

#### What It Should Enable
- inaugural auction behavior when there is no immediately previous season
- an explicit alternative to replacement-draft continuity
- clean coexistence with the current ledger-based offseason continuity path

#### Why It Is Next
- the continuing-league offseason workflow is now end-to-end
- the next major gap is the non-continuity path for brand-new leagues
- this is the most natural next product step before broader owner actions or deeper automation

### Owner Experience Follow-Up

#### Goal
Build on the Phase 7 read-only owner views without changing the core domain model.

#### What It Should Enable
- read-only owner replacement-draft context improvements
- eventual owner confirmations or acknowledgements if the product wants them later
- better financial and historical comparisons per owner

### Analytics Follow-Up

#### Goal
Extend the analytics layer carefully without changing metric semantics that are now standardized.

#### Guardrails
- preserve the definitions in `docs/05-analytics-metric-definitions.md`
- treat analytics as read-only derived views
- update service comments, DTO comments, UI copy, and the metric dictionary together if a definition changes

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
- preserve `LeagueMember` as a durable league slot and `User` as the current attached person
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
7. `docs/05-analytics-metric-definitions.md`
8. `docs/06-recent-fixes-and-handoff-notes.md`

## Short Continuation Checklist

- confirm branch and git status
- confirm the work is happening in `C:\Users\Ben\GM Fantasy`
- inspect current phase/results/draft services before editing
- preserve ledger-based offseason recommendation
- preserve phase-gated draft workflow
- preserve historical semantics and source-of-truth boundaries
