# New Chat Handoff Prompt

Use this as the prompt template for another AI.

## Paste This First

This is the `GM Fantasy` repo at `C:\Users\Ben\GM Fantasy`.

Please treat this as the active repo unless explicitly told otherwise.

Owners control NFL teams, not fantasy players.

Preserve these source-of-truth rules:
- `TeamOwnership` = ownership truth
- `SeasonStanding` = final fantasy standings truth
- `LedgerEntry` = money truth
- `Season.leaguePhase` = workflow truth
- `LeagueMember` = durable league slot
- `User` = current person attached to that slot

Preserve these architectural rules:
- routes stay thin
- services own business logic
- do not move business logic into React
- preserve provider boundaries for auth recovery
- preserve ledger-based replacement-draft recommendation

Read these files before proposing changes:
1. `docs/00-start-here.md`
2. `docs/01-project-overview.md`
3. `docs/02-repo-architecture.md`
4. `docs/03-current-state-and-completed-prompts.md`
5. `docs/04-roadmap-and-next-steps.md`
6. `docs/05-analytics-metric-definitions.md`
7. `docs/06-recent-fixes-and-handoff-notes.md`

Then review or implement the following task:
- [replace with the exact task]

## Optional Extra Context To Add
- current branch name
- whether the task is UI-only, service-layer, auth/recovery, or data-model related
- whether provider env vars are configured locally
- whether `npm run dev` is currently running
