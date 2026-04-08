"use client";

import { useEffect, useState } from "react";

import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SeasonSummary } from "@/types/season";
import type { OwnerSeasonResponse, OwnerSeasonSummary } from "@/types/owner";

function seasonLabel(name: string | null, year: number) {
  return name ?? `${year} Season`;
}

function ordinal(value: number) {
  const remainder10 = value % 10;
  const remainder100 = value % 100;

  if (remainder10 === 1 && remainder100 !== 11) {
    return `${value}st`;
  }

  if (remainder10 === 2 && remainder100 !== 12) {
    return `${value}nd`;
  }

  if (remainder10 === 3 && remainder100 !== 13) {
    return `${value}rd`;
  }

  return `${value}th`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  }).format(value);
}

function phaseLabel(phase: OwnerSeasonSummary["season"]["phase"]) {
  return phase.replaceAll("_", " ");
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

interface LeagueOwnerPanelProps {
  activeSeason: SeasonSummary | null;
  leagueName: string;
}

export function LeagueOwnerPanel({ activeSeason, leagueName }: LeagueOwnerPanelProps) {
  const [seasonDetail, setSeasonDetail] = useState<OwnerSeasonSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSeason) {
      setSeasonDetail(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    const seasonId = activeSeason.id;
    const controller = new AbortController();

    async function loadOwnerView() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const response = await fetch(`/api/owner/season/${seasonId}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const data = await parseJsonResponse<OwnerSeasonResponse>(response);
        setSeasonDetail(data.season);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSeasonDetail(null);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load owner view.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadOwnerView();

    return () => controller.abort();
  }, [activeSeason]);

  if (!activeSeason) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Owner View</CardTitle>
          <CardDescription>This league does not have an active season selected yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Once a commissioner sets an active season, your league-specific owner snapshot will appear here.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Owner View</CardTitle>
          <CardDescription>Loading your read-only season context for {leagueName}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="h-20 animate-pulse rounded-lg border border-border bg-secondary/20" key={index} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (errorMessage || !seasonDetail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Owner View</CardTitle>
          <CardDescription>Unable to load your owner-specific context for this league right now.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{errorMessage ?? "Owner view is unavailable."}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {seasonDetail.season.leagueName} | {seasonLabel(seasonDetail.season.name, seasonDetail.season.year)}
          </CardTitle>
          <CardDescription>
            Read-only owner view for this league. {seasonDetail.season.status} | {phaseLabel(seasonDetail.season.phase)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
            <div className="text-muted-foreground">Your Role</div>
            <div className="font-medium">{seasonDetail.membership.role}</div>
          </div>
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
            <div className="text-muted-foreground">Owned Teams</div>
            <div className="font-medium">{seasonDetail.teams.length}</div>
          </div>
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
            <div className="text-muted-foreground">Season Ledger</div>
            <div className="font-medium">{formatCurrency(seasonDetail.ledger.total)}</div>
          </div>
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
            <div className="text-muted-foreground">Final Standing</div>
            <div className="font-medium">
              {seasonDetail.standing ? ordinal(seasonDetail.standing.rank) : "Not available yet"}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Teams</CardTitle>
              <CardDescription>Every team currently attached to your account in this league's active season.</CardDescription>
            </CardHeader>
            <CardContent>
              {seasonDetail.teams.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No teams are assigned to your account for this season.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {seasonDetail.teams.map((team) => (
                    <div key={team.id} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                      <div className="font-medium">
                        <NFLTeamLabel size="detail" team={team} />
                      </div>
                      <div className="text-muted-foreground">
                        {team.conference} | {team.division}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {seasonDetail.dropPhase ? (
            <Card>
              <CardHeader>
                <CardTitle>DROP_PHASE Context</CardTitle>
                <CardDescription>Your keeper and released-team context for this league.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Eligible Teams</div>
                    <div className="font-medium">{seasonDetail.dropPhase.eligibleTeams.length}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Saved Keepers</div>
                    <div className="font-medium">{seasonDetail.dropPhase.keptTeams.length}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Ready For Draft</div>
                    <div className="font-medium">{seasonDetail.dropPhase.isComplete ? "Yes" : "Not yet"}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Saved Keepers</div>
                  {seasonDetail.dropPhase.keptTeams.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                      No keepers are saved for your account yet.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {seasonDetail.dropPhase.keptTeams.map((team) => (
                        <span
                          key={`keeper-${team.id}`}
                          className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-900"
                        >
                          <NFLTeamLabel size="compact" team={team} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Released Team</div>
                  {seasonDetail.dropPhase.releasedTeam ? (
                    <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                      <NFLTeamLabel size="detail" team={seasonDetail.dropPhase.releasedTeam} />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                      A released team will appear here once exactly 2 keepers are saved.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {seasonDetail.draftPhase ? (
            <Card>
              <CardHeader>
                <CardTitle>DRAFT_PHASE Context</CardTitle>
                <CardDescription>Your draft position and replacement-draft progress for this league.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Draft Status</div>
                    <div className="font-medium">{seasonDetail.draftPhase.status}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Draft Position</div>
                    <div className="font-medium">
                      {seasonDetail.draftPhase.draftPosition ? `Pick ${seasonDetail.draftPhase.draftPosition}` : "Not assigned"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Progress</div>
                    <div className="font-medium">
                      {seasonDetail.draftPhase.picksCompleted} / {seasonDetail.draftPhase.totalPicks}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Current Pick</div>
                    <div className="font-medium">
                      {seasonDetail.draftPhase.currentPickNumber ? `Pick ${seasonDetail.draftPhase.currentPickNumber}` : "Not started"}
                    </div>
                  </div>
                </div>

                {seasonDetail.draftPhase.isOnClock ? (
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    You are currently on the clock.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </section>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Season Ledger Feed</CardTitle>
              <CardDescription>Your read-only ledger history for this league's active season.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {seasonDetail.ledger.entries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No ledger entries are recorded for your account in this season yet.
                </div>
              ) : (
                seasonDetail.ledger.entries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{entry.description}</div>
                        <div className="text-muted-foreground">{entry.category}</div>
                      </div>
                      <div className={cn("font-medium", entry.amount >= 0 ? "text-emerald-700" : "text-rose-700")}>
                        {formatCurrency(entry.amount)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
