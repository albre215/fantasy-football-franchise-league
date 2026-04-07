"use client";

import { useMemo, useState } from "react";

import { NFLTeamLabel, NFLTeamLogo } from "@/components/shared/nfl-team-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OwnerAnalytics } from "@/types/analytics";

import { AnalyticsBarChart } from "./analytics-bar-chart";

export function OwnerAnalyticsPanel({ analytics }: { analytics: OwnerAnalytics }) {
  const [selectedOwnerId, setSelectedOwnerId] = useState(analytics.owners[0]?.ownerUserId ?? "");

  const selectedOwner = useMemo(
    () => analytics.owners.find((owner) => owner.ownerUserId === selectedOwnerId) ?? analytics.owners[0] ?? null,
    [analytics.owners, selectedOwnerId]
  );

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsBarChart
          color="#E0B24A"
          data={analytics.ownershipDiversityChart}
          description="How many different NFL franchises each owner has controlled."
          emptyMessage="Owner diversity analytics are not available yet."
          title="Ownership Diversity"
          valueLabel="franchises"
        />

        <AnalyticsBarChart
          color="#2BBE5A"
          data={analytics.totalEarningsChart}
          description="Cumulative posted ledger totals by owner across tracked seasons."
          emptyMessage="Owner earnings analytics are not available yet."
          title="Total Earnings"
          valueLabel="dollars"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AnalyticsBarChart
          color="#4A7BE0"
          data={analytics.averageFinishChart}
          description="Average saved final standing rank, inverted visually so better finishes rank higher."
          emptyMessage="Average finish analytics are not available yet."
          title="Average Finish"
          valueLabel="finish score"
        />

        <Card className="brand-surface">
          <CardHeader>
            <CardTitle className="text-xl">Owner Explorer</CardTitle>
            <CardDescription>Choose an owner to review their franchise history over time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => setSelectedOwnerId(event.target.value)}
              value={selectedOwner?.ownerUserId ?? ""}
            >
              {analytics.owners.map((owner) => (
                <option key={owner.ownerUserId} value={owner.ownerUserId}>
                  {owner.ownerDisplayName}
                </option>
              ))}
            </select>

            {selectedOwner ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Seasons Participated</div>
                    <div className="font-semibold">{selectedOwner.totalSeasonsParticipated}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Unique Franchises</div>
                    <div className="font-semibold">{selectedOwner.totalUniqueFranchisesOwned}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Total Earnings</div>
                    <div className="font-semibold">${selectedOwner.totalEarnings.toFixed(2)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Average Finish</div>
                    <div className="font-semibold">
                      {selectedOwner.averageFinish !== null ? selectedOwner.averageFinish.toFixed(2) : "N/A"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Fantasy Win Rate</div>
                    <div className="font-semibold">
                      {selectedOwner.fantasyWinRate !== null ? `${(selectedOwner.fantasyWinRate * 100).toFixed(1)}%` : "N/A"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">NFL Win Rate</div>
                    <div className="font-semibold">
                      {selectedOwner.nflWinRate !== null ? `${(selectedOwner.nflWinRate * 100).toFixed(1)}%` : "N/A"}
                    </div>
                  </div>
                </div>

                {selectedOwner.mostFrequentlyOwnedTeam ? (
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Most Frequently Owned Team</div>
                    <div className="mt-1 font-medium">
                      <NFLTeamLabel size="detail" team={selectedOwner.mostFrequentlyOwnedTeam.team} />
                    </div>
                    <div className="text-muted-foreground">
                      {selectedOwner.mostFrequentlyOwnedTeam.count} seasons
                    </div>
                  </div>
                ) : null}

                {selectedOwner.longestContinuousOwnership ? (
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Longest Continuous Ownership</div>
                    <div className="mt-1 font-medium">
                      <NFLTeamLabel size="detail" team={selectedOwner.longestContinuousOwnership.team} />
                    </div>
                    <div className="text-muted-foreground">
                      {selectedOwner.longestContinuousOwnership.length} seasons
                      {" | "}
                      {selectedOwner.longestContinuousOwnership.startSeasonYear} to{" "}
                      {selectedOwner.longestContinuousOwnership.endSeasonYear}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No owner history is available yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedOwner ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <AnalyticsBarChart
              color="#2BBE5A"
              data={selectedOwner.teamCountChart}
              description="Which franchises this owner has controlled most often."
              emptyMessage="No franchise counts are available for this owner yet."
              title={`${selectedOwner.ownerDisplayName}'s Team Counts`}
              valueLabel="seasons"
            />

            <AnalyticsBarChart
              color="#E0B24A"
              data={selectedOwner.earningsTrendChart}
              description="Season-by-season posted ledger total for the selected owner."
              emptyMessage="No earnings trend is available for this owner yet."
              title={`${selectedOwner.ownerDisplayName}'s Earnings Trend`}
              valueLabel="dollars"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card className="brand-surface">
              <CardHeader>
                <CardTitle className="text-xl">Performance Trend</CardTitle>
                <CardDescription>Per-season finish, posted ledger total, and win-rate metrics.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedOwner.performanceTrend.map((season) => (
                  <div className="rounded-lg border border-border p-4 text-sm" key={season.seasonId}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-medium text-foreground">
                        {season.seasonName ?? `${season.seasonYear} Season`}
                      </div>
                      <div className="text-muted-foreground">${season.ledgerTotal.toFixed(2)}</div>
                    </div>
                    <div className="mt-2 grid gap-2 text-muted-foreground md:grid-cols-3">
                      <div>Finish: {season.finish ?? "N/A"}</div>
                      <div>
                        Fantasy Win Rate: {season.fantasyWinRate !== null ? `${(season.fantasyWinRate * 100).toFixed(1)}%` : "N/A"}
                      </div>
                      <div>
                        NFL Win Rate: {season.nflWinRate !== null ? `${(season.nflWinRate * 100).toFixed(1)}%` : "N/A"}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="brand-surface">
              <CardHeader>
                <CardTitle className="text-xl">Ownership Timeline</CardTitle>
                <CardDescription>Season-by-season portfolio for the selected owner.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedOwner.seasons.map((season) => (
                  <div className="rounded-lg border border-border p-4 text-sm" key={season.seasonId}>
                    <div className="font-medium text-foreground">
                      {season.seasonName ?? `${season.seasonYear} Season`}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {season.teams.map((entry) => (
                        <span
                          className="rounded-full border border-border bg-background px-3 py-1 text-sm"
                          key={`${season.seasonId}-${entry.team.id}`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <NFLTeamLogo abbreviation={entry.team.abbreviation} name={entry.team.name} size="compact" />
                            <span>
                              {entry.team.abbreviation} ({entry.acquisitionType})
                            </span>
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}
