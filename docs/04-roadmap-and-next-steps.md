# Roadmap and Next Steps

This roadmap reflects the repo on `main` after the recovery-provider integrations, authentication hardening, account/profile work, and commissioner-console overview cleanup.

## Current Baseline

Already implemented:
- real credentials authentication
- account settings with profile image support
- password reset by email
- temporary login by phone verification
- Resend integration
- Twilio Verify integration
- recovery hardening and throttling
- league bootstrap and season management
- durable member-slot replacement workflow
- active-season ownership management
- NFL performance engine
- ledger engine
- fantasy standings -> ledger integration
- ledger-based offseason replacement-draft recommendation
- league phase system
- explicit `DROP_PHASE` keeper / release workflow
- replacement draft lifecycle
- unified commissioner / owner league workspace
- NFL results -> ledger posting
- history and analytics views
- analytics metric definitions

## Recommended Next Product Work

### Phase 11 - Inaugural Auction / Empty-League Entry Path

#### Goal
Support the path where a brand-new or reset league does not have a previous season to inherit from.

#### What It Should Enable
- inaugural auction behavior when there is no immediately previous season
- an explicit alternative to replacement-draft continuity
- clean coexistence with the current ledger-based continuity path

#### Why It Is Next
- the continuing-league offseason workflow is now end to end
- the biggest remaining league-lifecycle gap is the non-continuity path for brand-new leagues
- this is the cleanest next feature before owner actions or deeper automation

### Configurable Fees / Payout Settings

#### Goal
Move hardcoded financial assumptions into persisted league or season settings.

#### What It Should Enable
- configurable entry fee
- configurable payout structure
- dashboard surfaces that display dynamic financial settings
- cleaner downstream ledger automation

### Owner Experience Follow-Up

#### Goal
Build on the embedded owner view without changing the core domain model.

#### What It Should Enable
- clearer owner draft/replacement context
- richer owner financial summaries
- better owner-facing history comparisons
- possible future confirmations/acknowledgements without turning owners into workflow truth

### Auth / Recovery Follow-Up

#### Goal
Improve production readiness without redesigning the auth architecture.

#### Good Future Targets
- deeper rate limiting if external infra becomes available
- audit/event logging beyond current DB fields
- optional constrained-session behavior for temporary recovery login
- email/phone verification for account lifecycle if the product wants it later

## Important Technical Follow-Up

### Performance
Endpoints still worth profiling:
- ownership
- draft
- NFL overview/week reads
- phase context
- league bootstrap summaries

### Testing
Good next test targets:
- season-service paths involving active season / year updates
- season-phase-service transition coverage
- draft edge cases around reset/finalize/override order
- NFL auto-import and import concurrency behavior
- recovery route behavior around provider failures

### Migration Hygiene
- stop `next dev` before Prisma migration/generate work on Windows
- do not casually accept destructive Prisma reset prompts against a populated local DB
- if drift appears again, inspect migration history before resetting

## Important Constraints For Future Work
- preserve `TeamOwnership` as ownership truth
- preserve `SeasonStanding` as final fantasy standings truth
- preserve `LedgerEntry` as money truth
- preserve `Season.leaguePhase` as workflow truth
- preserve `LeagueMember` as a durable slot and `User` as the current attached person
- keep draft logic in `draft-service`
- keep routes thin and services authoritative
- keep `User` separate from `LeagueMember`
- keep recovery provider logic inside the delivery/service layer

## Suggested Files To Read First In A New Chat
1. `docs/00-start-here.md`
2. `docs/01-project-overview.md`
3. `docs/02-repo-architecture.md`
4. `docs/03-current-state-and-completed-prompts.md`
5. `docs/04-roadmap-and-next-steps.md`
6. `docs/05-analytics-metric-definitions.md`
7. `docs/06-recent-fixes-and-handoff-notes.md`
8. `docs/NEW_CHAT_HANDOFF.md`

## Short Continuation Checklist
- confirm branch and git status
- confirm the work is happening in `C:\Users\Ben\GM Fantasy`
- inspect the relevant services before editing
- preserve ledger-based replacement-draft recommendation
- preserve historical semantics and source-of-truth boundaries
- preserve recovery provider boundaries and production safety rails
