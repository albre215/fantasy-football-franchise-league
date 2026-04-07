import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DraftAnalytics } from "@/types/analytics";

import { AnalyticsBarChart } from "./analytics-bar-chart";

export function DraftAnalyticsPanel({ analytics }: { analytics: DraftAnalytics }) {
  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <AnalyticsBarChart
          data={analytics.mostDraftedTeamsChart}
          description="Non-keeper acquisitions made through offseason draft picks."
          emptyMessage="No drafted-team analytics are available yet."
          title="Most Drafted Teams"
          valueLabel="drafts"
        />
        <AnalyticsBarChart
          color="#E0B24A"
          data={analytics.mostKeptTeamsChart}
          description="Teams that owners choose to protect most often before the draft."
          emptyMessage="No keeper analytics are available yet."
          title="Most Kept Teams"
          valueLabel="keeps"
        />
      </div>

      <AnalyticsBarChart
        color="#4A7BE0"
        data={analytics.draftSlotOutcomeChart}
        description="Average target-season posted ledger total by replacement draft slot."
        emptyMessage="No draft-slot outcome analytics are available yet."
        title="Draft Slot Outcomes"
        valueLabel="avg ledger"
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="brand-surface">
          <CardHeader>
            <CardTitle className="text-xl">Drafted Team Details</CardTitle>
            <CardDescription>Most frequent non-keeper draft targets across league history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.mostDraftedTeams.length === 0 ? (
              <div className="text-sm text-muted-foreground">No completed draft picks are recorded yet.</div>
            ) : (
              analytics.mostDraftedTeams.slice(0, 8).map((entry) => (
                <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm" key={entry.team.id}>
                  <div className="font-medium">
                    <NFLTeamLabel size="detail" team={entry.team} />
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {entry.draftCount} draft selections
                    {entry.averagePickNumber ? ` | Avg. pick ${entry.averagePickNumber}` : ""}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="brand-surface">
          <CardHeader>
            <CardTitle className="text-xl">Recent Draft Activity</CardTitle>
            <CardDescription>Operational summary of recent replacement drafts by target season.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.recentDrafts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No offseason drafts are recorded yet.</div>
            ) : (
              analytics.recentDrafts.map((draft) => (
                <div className="rounded-lg border border-border p-4 text-sm" key={draft.draftId}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium text-foreground">
                      {draft.targetSeasonName ?? `${draft.targetSeasonYear} Season`}
                    </div>
                    <div className="text-muted-foreground">{draft.status}</div>
                  </div>
                  <div className="mt-2 grid gap-2 text-muted-foreground md:grid-cols-3">
                    <div>Source: {draft.sourceSeasonName ?? `${draft.sourceSeasonYear} Season`}</div>
                    <div>Keepers: {draft.keeperCount}</div>
                    <div>Picks completed: {draft.picksCompleted}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="brand-surface">
        <CardHeader>
          <CardTitle className="text-xl">Replacement Draft Effectiveness</CardTitle>
          <CardDescription>How each replacement pick mapped to target-season outcomes and team-level NFL results.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {analytics.replacementDraftEffectiveness.length === 0 ? (
            <div className="text-sm text-muted-foreground">No completed replacement draft outcomes are available yet.</div>
          ) : (
            analytics.replacementDraftEffectiveness.map((draft) => (
              <div className="rounded-lg border border-border p-4 text-sm" key={draft.draftId}>
                <div className="font-medium text-foreground">
                  {draft.targetSeasonName ?? `${draft.targetSeasonYear} Season`}
                </div>
                <div className="mt-3 space-y-2">
                  {draft.entries.map((entry) => (
                    <div
                      className="rounded-lg border border-border bg-background px-4 py-3"
                      key={`${draft.draftId}-${entry.draftSlot}-${entry.ownerUserId}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">
                            Pick {entry.draftSlot}: {entry.ownerDisplayName}
                          </div>
                          <div className="text-muted-foreground">
                            {entry.selectedTeam ? (
                              <NFLTeamLabel size="detail" team={entry.selectedTeam} />
                            ) : (
                              "No selected team"
                            )}
                          </div>
                        </div>
                        <div className="text-right text-muted-foreground">
                          <div>Finish: {entry.finalFinish ?? "N/A"}</div>
                          <div>Ledger: {entry.finalLedgerTotal !== null ? `$${entry.finalLedgerTotal.toFixed(2)}` : "N/A"}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-muted-foreground">
                        Team wins: {entry.selectedTeamRegularSeasonWins} regular / {entry.selectedTeamPlayoffWins} playoff | Team NFL amount: ${entry.selectedTeamNflLedgerAmount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
