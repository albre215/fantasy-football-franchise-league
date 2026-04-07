import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeagueOverviewAnalytics } from "@/types/analytics";

import { AnalyticsBarChart } from "./analytics-bar-chart";

export function LeagueOverviewPanel({ overview }: { overview: LeagueOverviewAnalytics }) {
  const mostRecentChampion = overview.mostRecentChampion;

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="brand-surface">
          <CardHeader>
            <CardTitle className="text-lg">Total Seasons</CardTitle>
            <CardDescription>Tracked seasons with ownership history.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{overview.totalSeasons}</CardContent>
        </Card>
        <Card className="brand-surface">
          <CardHeader>
            <CardTitle className="text-lg">Franchises Used</CardTitle>
            <CardDescription>Unique NFL teams appearing across history.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{overview.totalUniqueFranchisesUsed}</CardContent>
        </Card>
        <Card className="brand-surface">
          <CardHeader>
            <CardTitle className="text-lg">Historical Owners</CardTitle>
            <CardDescription>Distinct people across the league timeline.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{overview.totalOwnersAcrossHistory}</CardContent>
        </Card>
        <Card className="brand-surface">
          <CardHeader>
            <CardTitle className="text-lg">League Payouts</CardTitle>
            <CardDescription>Sum of each season&apos;s net posted ledger total across tracked seasons.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">${overview.totalLeaguePayouts.toFixed(2)}</CardContent>
        </Card>
        <Card className="brand-surface">
          <CardHeader>
            <CardTitle className="text-lg">Most Owned Team</CardTitle>
            <CardDescription>Most common franchise across all seasons.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview.mostOwnedTeam ? (
              <>
                <div className="font-medium">
                  <NFLTeamLabel size="detail" team={overview.mostOwnedTeam.team} />
                </div>
                <div className="text-sm text-muted-foreground">
                  {overview.mostOwnedTeam.ownershipCount} seasons across league history
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No franchise history yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AnalyticsBarChart
          color="#2BBE5A"
          data={overview.championChart}
          description="How often each owner has finished as champion in tracked seasons."
          emptyMessage="No champions are derivable from saved standings yet."
          title="Championship Counts"
          valueLabel="titles"
        />

        <div className="space-y-6">
          <Card className="brand-surface">
            <CardHeader>
              <CardTitle className="text-xl">Career Ledger Extremes</CardTitle>
              <CardDescription>Cumulative owner ledger totals across all tracked seasons.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.biggestCareerWinner ? (
                <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                  <div className="text-muted-foreground">Biggest Winner</div>
                  <div className="text-lg font-semibold">{overview.biggestCareerWinner.ownerDisplayName}</div>
                  <div className="text-muted-foreground">${overview.biggestCareerWinner.totalEarnings.toFixed(2)}</div>
                </div>
              ) : null}
              {overview.biggestCareerLoser ? (
                <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                  <div className="text-muted-foreground">Biggest Loser</div>
                  <div className="text-lg font-semibold">{overview.biggestCareerLoser.ownerDisplayName}</div>
                  <div className="text-muted-foreground">${overview.biggestCareerLoser.totalEarnings.toFixed(2)}</div>
                </div>
              ) : null}
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                <div className="text-muted-foreground">Average Parity Gap</div>
                <div className="text-lg font-semibold">
                  {overview.averageSeasonParityGap !== null ? `$${overview.averageSeasonParityGap.toFixed(2)}` : "Not available"}
                </div>
                <div className="text-muted-foreground">Average spread between the highest and lowest season ledger totals.</div>
              </div>
            </CardContent>
          </Card>

          <Card className="brand-surface">
            <CardHeader>
              <CardTitle className="text-xl">Most Recent Champion</CardTitle>
              <CardDescription>Derived from the newest season with recorded final standings.</CardDescription>
            </CardHeader>
            <CardContent>
              {mostRecentChampion ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-lg font-semibold">{mostRecentChampion.ownerDisplayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {mostRecentChampion.seasonName ?? `${mostRecentChampion.seasonYear} Season`}
                    </div>
                  </div>
                  {mostRecentChampion.championTeams.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {mostRecentChampion.championTeams.map((team) => (
                        <span
                          className="rounded-full border border-border bg-background px-3 py-1 text-sm"
                          key={`${mostRecentChampion.seasonId}-${team.id}`}
                        >
                          <NFLTeamLabel size="compact" team={team} />
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No champion is derivable yet from standings history.</div>
              )}
            </CardContent>
          </Card>

          <Card className="brand-surface">
            <CardHeader>
              <CardTitle className="text-xl">Most Common Champion</CardTitle>
              <CardDescription>The owner with the most championship finishes so far.</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.mostCommonChampion ? (
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{overview.mostCommonChampion.ownerDisplayName}</div>
                  <div className="text-sm text-muted-foreground">
                    {overview.mostCommonChampion.championshipCount} championships
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No repeated champion pattern is available yet.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="brand-surface">
        <CardHeader>
          <CardTitle className="text-xl">Season Summaries</CardTitle>
          <CardDescription>Winner, loser, and parity snapshot from each season&apos;s posted ledger totals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.seasonSummaries.length === 0 ? (
            <div className="text-sm text-muted-foreground">No season summary analytics are available yet.</div>
          ) : (
            overview.seasonSummaries.map((season) => (
              <div className="rounded-lg border border-border p-4 text-sm" key={season.seasonId}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-medium text-foreground">
                    {season.seasonName ?? `${season.seasonYear} Season`}
                  </div>
                  <div className="text-muted-foreground">${season.totalLeaguePayouts.toFixed(2)} total</div>
                </div>
                <div className="mt-2 grid gap-2 text-muted-foreground md:grid-cols-3">
                  <div>
                    Winner: {season.biggestWinner ? `${season.biggestWinner.ownerDisplayName} ($${season.biggestWinner.amount.toFixed(2)})` : "N/A"}
                  </div>
                  <div>
                    Loser: {season.biggestLoser ? `${season.biggestLoser.ownerDisplayName} ($${season.biggestLoser.amount.toFixed(2)})` : "N/A"}
                  </div>
                  <div>Parity gap: {season.parityGap !== null ? `$${season.parityGap.toFixed(2)}` : "N/A"}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
