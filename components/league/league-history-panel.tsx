"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DraftHistoryResponse,
  FranchiseHistoryResponse,
  LeagueAnalyticsSummaryResponse,
  LeagueHistoryOverviewResponse,
  LeagueSeasonHistoryResponse,
  OwnerHistoryResponse
} from "@/types/history";

interface LeagueHistoryPanelProps {
  leagueId: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function seasonLabel(name: string | null, year: number) {
  return name ?? `${year} Season`;
}

export function LeagueHistoryPanel({ leagueId }: LeagueHistoryPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overview, setOverview] = useState<LeagueHistoryOverviewResponse["overview"] | null>(null);
  const [seasonHistory, setSeasonHistory] = useState<LeagueSeasonHistoryResponse["seasons"]>([]);
  const [draftHistory, setDraftHistory] = useState<DraftHistoryResponse["drafts"]>([]);
  const [analytics, setAnalytics] = useState<LeagueAnalyticsSummaryResponse["analytics"] | null>(null);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [franchiseHistory, setFranchiseHistory] = useState<FranchiseHistoryResponse["franchiseHistory"] | null>(null);
  const [ownerHistory, setOwnerHistory] = useState<OwnerHistoryResponse["ownerHistory"] | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [overviewResponse, seasonsResponse, draftsResponse, analyticsResponse] = await Promise.all([
          fetch(`/api/league/${leagueId}/history/overview`, { cache: "no-store" }),
          fetch(`/api/league/${leagueId}/history/seasons`, { cache: "no-store" }),
          fetch(`/api/league/${leagueId}/history/drafts`, { cache: "no-store" }),
          fetch(`/api/league/${leagueId}/analytics/summary`, { cache: "no-store" })
        ]);

        const [overviewData, seasonsData, draftsData, analyticsData] = await Promise.all([
          parseJsonResponse<LeagueHistoryOverviewResponse>(overviewResponse),
          parseJsonResponse<LeagueSeasonHistoryResponse>(seasonsResponse),
          parseJsonResponse<DraftHistoryResponse>(draftsResponse),
          parseJsonResponse<LeagueAnalyticsSummaryResponse>(analyticsResponse)
        ]);

        setOverview(overviewData.overview);
        setSeasonHistory(seasonsData.seasons);
        setDraftHistory(draftsData.drafts);
        setAnalytics(analyticsData.analytics);
        setSelectedFranchiseId((current) =>
          overviewData.overview.franchiseOptions.some((option) => option.nflTeamId === current)
            ? current
            : overviewData.overview.franchiseOptions[0]?.nflTeamId ?? ""
        );
        setSelectedOwnerId((current) =>
          overviewData.overview.ownerOptions.some((option) => option.userId === current)
            ? current
            : overviewData.overview.ownerOptions[0]?.userId ?? ""
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load league history.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [leagueId]);

  useEffect(() => {
    if (!selectedFranchiseId || !selectedOwnerId) {
      return;
    }

    void (async () => {
      setDetailError(null);

      try {
        const [franchiseResponse, ownerResponse] = await Promise.all([
          fetch(`/api/league/${leagueId}/history/franchise?nflTeamId=${selectedFranchiseId}`, { cache: "no-store" }),
          fetch(`/api/league/${leagueId}/history/owner?userId=${selectedOwnerId}`, { cache: "no-store" })
        ]);

        const [franchiseData, ownerData] = await Promise.all([
          parseJsonResponse<FranchiseHistoryResponse>(franchiseResponse),
          parseJsonResponse<OwnerHistoryResponse>(ownerResponse)
        ]);

        setFranchiseHistory(franchiseData.franchiseHistory);
        setOwnerHistory(ownerData.ownerHistory);
      } catch (error) {
        setDetailError(error instanceof Error ? error.message : "Unable to load history details.");
      }
    })();
  }, [leagueId, selectedFranchiseId, selectedOwnerId]);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">League History & Analytics</h2>
        <p className="text-muted-foreground">
          Browse season-by-season ownership history, offseason draft records, and continuity analytics.
        </p>
      </div>

      {errorMessage ? (
        <Card>
          <CardContent className="p-4 text-sm text-red-600">{errorMessage}</CardContent>
        </Card>
      ) : isLoading || !overview || !analytics ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading league history...</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>League History Overview</CardTitle>
                <CardDescription>High-level continuity and turnover stats.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Seasons tracked: {overview.totalSeasonsTracked}</p>
                <p>Offseason drafts tracked: {overview.totalDraftsTracked}</p>
                <p>Ownership records: {overview.totalOwnershipRecords}</p>
                <p>Historical owners: {overview.totalHistoricalOwners}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Continuity Snapshot</CardTitle>
                <CardDescription>What the current ownership history already reveals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Longest streak:{" "}
                  {overview.continuitySummary.longestOwnershipStreak
                    ? `${overview.continuitySummary.longestOwnershipStreak.ownerDisplayName} with ${overview.continuitySummary.longestOwnershipStreak.teamAbbreviation} (${overview.continuitySummary.longestOwnershipStreak.streakLength} seasons)`
                    : "Not available yet"}
                </p>
                <p>
                  Most frequently owned:{" "}
                  {overview.continuitySummary.mostFrequentlyOwnedTeam
                    ? `${overview.continuitySummary.mostFrequentlyOwnedTeam.teamAbbreviation} (${overview.continuitySummary.mostFrequentlyOwnedTeam.ownershipCount} seasons)`
                    : "Not available yet"}
                </p>
                <p>
                  Most frequently changing:{" "}
                  {overview.continuitySummary.mostFrequentlyChangingTeam
                    ? `${overview.continuitySummary.mostFrequentlyChangingTeam.teamAbbreviation} (${overview.continuitySummary.mostFrequentlyChangingTeam.transitionCount} transitions)`
                    : "Not available yet"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Draft History Snapshot</CardTitle>
                <CardDescription>What the offseason record already supports.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Keeper selections tracked: {overview.totalKeeperSelections}</p>
                <p>Draft picks recorded: {overview.totalDraftPicksMade}</p>
                <p>Most recent draft: {draftHistory[0] ? seasonLabel(draftHistory[0].targetSeasonName, draftHistory[0].targetSeasonYear) : "None"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Results-Based Metrics</CardTitle>
                <CardDescription>Ready for standings/results ingestion later.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {overview.deferredMetrics.slice(0, 3).map((metric) => (
                  <p key={metric.id}>{metric.label}: Available in Prompt 8</p>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Season History Table</CardTitle>
                <CardDescription>Season-by-season ownership and draft readiness history.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {seasonHistory.map((season) => (
                  <div className="rounded-lg border border-border p-4 text-sm" key={season.seasonId}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{seasonLabel(season.name, season.year)}</p>
                        <p className="text-muted-foreground">
                          {season.status} - {season.isLocked ? "Locked" : "Open"}
                        </p>
                      </div>
                      <div className="text-right text-muted-foreground">
                        <p>Ownership: {season.assignedTeamCount}/30 assigned</p>
                        <p>Unassigned: {season.unassignedTeamCount}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-muted-foreground md:grid-cols-2">
                      <p>Draft tracked: {season.hasDraft ? `Yes (${season.draftStatus})` : "No"}</p>
                      <p>Historical ownership data: {season.historicalDataAvailable.ownership ? "Available" : "Not yet populated"}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analytics Leaderboards</CardTitle>
                <CardDescription>Ownership and draft metrics available now.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    title: "Longest Ownership Streaks",
                    rows: analytics.franchiseLeaderboards.longestOwnershipStreak
                  },
                  {
                    title: "Most Kept Teams",
                    rows: analytics.franchiseLeaderboards.mostKept
                  },
                  {
                    title: "Most Drafted Teams",
                    rows: analytics.franchiseLeaderboards.mostDrafted
                  },
                  {
                    title: "Widest Franchise History",
                    rows: analytics.ownerLeaderboards.widestFranchiseHistory
                  }
                ].map((leaderboard) => (
                  <div key={leaderboard.title}>
                    <p className="font-medium text-foreground">{leaderboard.title}</p>
                    <div className="mt-2 space-y-2">
                      {leaderboard.rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Not enough history yet.</p>
                      ) : (
                        leaderboard.rows.slice(0, 3).map((row) => (
                          <div className="rounded-lg border border-border p-3 text-sm" key={`${leaderboard.title}-${row.label}`}>
                            <p className="font-medium text-foreground">{row.label}</p>
                            <p className="text-muted-foreground">{row.value}</p>
                            <p className="text-muted-foreground">{row.supportingText}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Franchise History Explorer</CardTitle>
                <CardDescription>Track ownership continuity, keepers, and draft acquisitions by NFL team.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => setSelectedFranchiseId(event.target.value)}
                  value={selectedFranchiseId}
                >
                  {overview.franchiseOptions.map((option) => (
                    <option key={option.nflTeamId} value={option.nflTeamId}>
                      {option.abbreviation} - {option.name}
                    </option>
                  ))}
                </select>

                {detailError ? (
                  <p className="text-sm text-red-600">{detailError}</p>
                ) : !franchiseHistory ? (
                  <p className="text-sm text-muted-foreground">Loading franchise history...</p>
                ) : (
                  <>
                    <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                      <p>Seasons owned: {franchiseHistory.analytics.seasonsOwned}</p>
                      <p>Distinct owners: {franchiseHistory.analytics.distinctOwners}</p>
                      <p>Ownership transitions: {franchiseHistory.analytics.ownershipTransitions}</p>
                      <p>
                        Longest streak:{" "}
                        {franchiseHistory.analytics.longestContinuousStreak
                          ? `${franchiseHistory.analytics.longestContinuousStreak.ownerDisplayName} (${franchiseHistory.analytics.longestContinuousStreak.length})`
                          : "Not available yet"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {franchiseHistory.rows.map((row) => (
                        <div className="rounded-lg border border-border p-3 text-sm" key={`${row.seasonId}-${row.ownerUserId}`}>
                          <p className="font-medium text-foreground">{seasonLabel(row.seasonName, row.seasonYear)}</p>
                          <p className="text-muted-foreground">{row.ownerDisplayName}</p>
                          <p className="text-muted-foreground">
                            Acquisition: {row.acquisitionType}
                            {row.draftPickNumber ? ` (Pick ${row.draftPickNumber})` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Owner History Explorer</CardTitle>
                <CardDescription>Review portfolio history, keeper patterns, and longest tenures by owner.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => setSelectedOwnerId(event.target.value)}
                  value={selectedOwnerId}
                >
                  {overview.ownerOptions.map((option) => (
                    <option key={option.userId} value={option.userId}>
                      {option.displayName}
                    </option>
                  ))}
                </select>

                {detailError ? (
                  <p className="text-sm text-red-600">{detailError}</p>
                ) : !ownerHistory ? (
                  <p className="text-sm text-muted-foreground">Loading owner history...</p>
                ) : (
                  <>
                    <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                      <p>Seasons participated: {ownerHistory.analytics.totalSeasonsParticipated}</p>
                      <p>Distinct teams controlled: {ownerHistory.analytics.totalDistinctTeamsControlled}</p>
                      <p>Keeper selections made: {ownerHistory.analytics.totalKeeperSelections}</p>
                      <p>Drafted teams acquired: {ownerHistory.analytics.totalDraftedTeamsAcquired}</p>
                    </div>

                    <div className="space-y-2">
                      {ownerHistory.rows.map((row) => (
                        <div className="rounded-lg border border-border p-3 text-sm" key={row.seasonId}>
                          <p className="font-medium text-foreground">{seasonLabel(row.seasonName, row.seasonYear)}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {row.teams.map((entry) => (
                              <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground" key={`${row.seasonId}-${entry.team.id}`}>
                                {entry.team.abbreviation} ({entry.acquisitionType})
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Draft History</CardTitle>
                <CardDescription>Review keepers, picks, and offseason transitions by season.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {draftHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No offseason drafts have been recorded yet.</p>
                ) : (
                  draftHistory.map((draft) => (
                    <div className="rounded-lg border border-border p-4" key={draft.draftId}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{seasonLabel(draft.targetSeasonName, draft.targetSeasonYear)}</p>
                          <p className="text-sm text-muted-foreground">
                            Source season: {seasonLabel(draft.sourceSeasonName, draft.sourceSeasonYear)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">{draft.status}</p>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                        <p>Keepers saved: {draft.keeperCount}</p>
                        <p>Picks completed: {draft.picksCompleted}/10</p>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {draft.picks.map((pick) => (
                          <p key={`${draft.draftId}-${pick.overallPickNumber}`}>
                            Pick {pick.overallPickNumber}: {pick.ownerDisplayName}{" "}
                            {pick.team ? `-> ${pick.team.abbreviation} - ${pick.team.name}` : "-> Waiting for selection"}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Standings & Results Placeholders</CardTitle>
                <CardDescription>These analytics will populate after Prompt 8 adds results ingestion.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.deferredMetrics.map((metric) => (
                  <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground" key={metric.id}>
                    <p className="font-medium text-foreground">{metric.label}</p>
                    <p>{metric.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
