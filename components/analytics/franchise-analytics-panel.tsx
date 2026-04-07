"use client";

import { useMemo, useState } from "react";

import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FranchiseAnalytics } from "@/types/analytics";

import { AnalyticsBarChart } from "./analytics-bar-chart";

export function FranchiseAnalyticsPanel({ analytics }: { analytics: FranchiseAnalytics }) {
  const [selectedTeamId, setSelectedTeamId] = useState(analytics.franchises[0]?.team.id ?? "");

  const selectedFranchise = useMemo(
    () => analytics.franchises.find((entry) => entry.team.id === selectedTeamId) ?? analytics.franchises[0] ?? null,
    [analytics.franchises, selectedTeamId]
  );

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsBarChart
          data={analytics.topOwnedTeamsChart}
          description="Which NFL teams have appeared most often in season ownership records."
          emptyMessage="No franchise ownership history is recorded yet."
          title="Most Owned Teams"
          valueLabel="seasons"
        />

        <AnalyticsBarChart
          color="#2BBE5A"
          data={analytics.mostProfitableTeamsChart}
          description="Teams contributing the most NFL-derived ledger wins across tracked seasons."
          emptyMessage="No team profitability analytics are available yet."
          title="Most Profitable Teams"
          valueLabel="ledger wins"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsBarChart
          color="#E0B24A"
          data={analytics.bestHistoricalTeamsChart}
          description="Historic NFL win totals from persisted season NFL results."
          emptyMessage="No historical team performance is available yet."
          title="Best Historical Teams"
          valueLabel="wins"
        />

        <Card className="brand-surface">
          <CardHeader>
            <CardTitle className="text-xl">Longest Team Ownership Streaks</CardTitle>
            <CardDescription>Biggest uninterrupted owner runs by NFL franchise.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.longestOwnershipStreaks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No franchise streaks are available yet.</div>
            ) : (
              analytics.longestOwnershipStreaks.map((entry) => (
                <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm" key={entry.team.id}>
                  <div className="font-medium">
                    <NFLTeamLabel size="detail" team={entry.team} />
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {entry.ownerDisplayName} for {entry.streakLength} seasons
                  </div>
                  <div className="text-muted-foreground">
                    {entry.startSeasonYear} to {entry.endSeasonYear}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="brand-surface">
        <CardHeader>
          <CardTitle className="text-xl">Ownership Timeline</CardTitle>
          <CardDescription>Choose a franchise to see who controlled it across seasons.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => setSelectedTeamId(event.target.value)}
            value={selectedFranchise?.team.id ?? ""}
          >
            {analytics.franchises.map((entry) => (
              <option key={entry.team.id} value={entry.team.id}>
                {entry.team.abbreviation} - {entry.team.name}
              </option>
            ))}
          </select>

          {selectedFranchise ? (
            <>
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <div className="font-medium">
                  <NFLTeamLabel size="detail" team={selectedFranchise.team} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {selectedFranchise.ownershipCount} ownership records tracked
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {selectedFranchise.totalRegularSeasonWins} regular wins | {selectedFranchise.totalPlayoffWins} playoff wins
                </div>
                <div className="text-sm text-muted-foreground">
                  ${selectedFranchise.totalNflLedgerAmount.toFixed(2)} NFL ledger contribution
                  {selectedFranchise.averageNflLedgerAmountPerSeason !== null
                    ? ` | ${selectedFranchise.averageNflLedgerAmountPerSeason.toFixed(2)} avg/season`
                    : ""}
                </div>
                {selectedFranchise.longestOwnershipStreak ? (
                  <div className="text-sm text-muted-foreground">
                    Longest streak: {selectedFranchise.longestOwnershipStreak.ownerDisplayName} for{" "}
                    {selectedFranchise.longestOwnershipStreak.length} seasons
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {selectedFranchise.timeline.map((row) => (
                  <div className="rounded-lg border border-border p-4 text-sm" key={`${selectedFranchise.team.id}-${row.seasonId}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-medium text-foreground">
                        {row.seasonName ?? `${row.seasonYear} Season`}
                      </div>
                      <div className="text-muted-foreground">{row.ownerDisplayName}</div>
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      Acquisition: {row.acquisitionType}
                      {row.draftPickNumber ? ` (Pick ${row.draftPickNumber})` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No franchise history is available yet.</div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
