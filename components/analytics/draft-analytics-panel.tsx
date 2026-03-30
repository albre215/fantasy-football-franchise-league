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
            <CardDescription>How recent offseason drafts have played out by season.</CardDescription>
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
    </section>
  );
}
