import Link from "next/link";

import { BrandMasthead } from "@/components/brand/brand-masthead";
import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OwnerDashboardSummary, OwnerSeasonSummary } from "@/types/owner";

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

export function OwnerDashboard({
  dashboard,
  seasonDetail
}: {
  dashboard: OwnerDashboardSummary;
  seasonDetail: OwnerSeasonSummary | null;
}) {
  return (
    <main className="min-h-screen py-10 sm:py-12">
      <div className="container py-12">
        <BrandMasthead
          actions={
            <>
              <Link className={buttonVariants({ variant: "outline" })} href="/">
                Home
              </Link>
              <Link className={buttonVariants()} href="/league">
                Commissioner Hub
              </Link>
            </>
          }
          className="mb-8"
          description="Review your current teams, season finances, standings, and offseason context without touching commissioner controls."
          eyebrow="Owner View"
          title={`Welcome back, ${dashboard.user.displayName}`}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <section className="space-y-6">
            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>Current League Activity</CardTitle>
                <CardDescription>
                  Your current-season view across every league where you have an active season.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboard.currentSeasons.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    None of your leagues has an active season assigned to your account right now.
                  </div>
                ) : (
                  dashboard.currentSeasons.map((season) => (
                    <Card key={season.seasonId} className="brand-muted-panel shadow-none">
                      <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-xl">{season.leagueName}</CardTitle>
                            <CardDescription>
                              {seasonLabel(season.seasonName, season.seasonYear)} | {season.seasonStatus} |{" "}
                              {phaseLabel(season.phase)}
                            </CardDescription>
                          </div>
                          <Link
                            className={buttonVariants({ variant: "outline" })}
                            href={`/owner?seasonId=${season.seasonId}`}
                          >
                            View Season
                          </Link>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                            <div className="text-muted-foreground">Teams</div>
                            <div className="font-medium">{season.teams.length}</div>
                          </div>
                          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                            <div className="text-muted-foreground">Season Ledger</div>
                            <div className="font-medium">{formatCurrency(season.ledgerTotal)}</div>
                          </div>
                          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                            <div className="text-muted-foreground">Standing</div>
                            <div className="font-medium">
                              {season.standing ? ordinal(season.standing.rank) : "Not final yet"}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Current Teams</div>
                          {season.teams.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                              No teams are assigned to your account in this active season yet.
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {season.teams.map((team) => (
                                <span
                                  key={`${season.seasonId}-${team.id}`}
                                  className="rounded-full border border-border bg-background px-3 py-1 text-sm"
                                >
                                  <NFLTeamLabel size="compact" team={team} />
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {season.draftStatus ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                              <div className="text-muted-foreground">Draft Status</div>
                              <div className="font-medium">{season.draftStatus.status}</div>
                            </div>
                            <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                              <div className="text-muted-foreground">Draft Position</div>
                              <div className="font-medium">
                                {season.draftStatus.draftPosition
                                  ? `Pick ${season.draftStatus.draftPosition}`
                                  : "Not assigned yet"}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            {seasonDetail ? (
              <Card className="brand-surface">
                <CardHeader>
                  <CardTitle>
                    {seasonDetail.season.leagueName} | {seasonLabel(seasonDetail.season.name, seasonDetail.season.year)}
                  </CardTitle>
                  <CardDescription>
                    {seasonDetail.season.status} | {phaseLabel(seasonDetail.season.phase)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-3">
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
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Teams</div>
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
                  </div>

                  {seasonDetail.dropPhase ? (
                    <div className="space-y-3">
                      <div className="text-sm font-medium">DROP_PHASE Context</div>
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
                          <div className="text-muted-foreground">Ready for Draft</div>
                          <div className="font-medium">{seasonDetail.dropPhase.isComplete ? "Yes" : "Not yet"}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Eligible Previous-Season Teams</div>
                        <div className="flex flex-wrap gap-2">
                          {seasonDetail.dropPhase.eligibleTeams.map((team) => (
                            <span
                              key={`eligible-${team.id}`}
                              className="rounded-full border border-border bg-background px-3 py-1 text-sm"
                            >
                              <NFLTeamLabel size="compact" team={team} />
                            </span>
                          ))}
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

                      {seasonDetail.dropPhase.warnings.length > 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          {seasonDetail.dropPhase.warnings.join(" ")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {seasonDetail.draftPhase ? (
                    <div className="space-y-3">
                      <div className="text-sm font-medium">DRAFT_PHASE Context</div>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                          <div className="text-muted-foreground">Draft Status</div>
                          <div className="font-medium">{seasonDetail.draftPhase.status}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                          <div className="text-muted-foreground">Draft Position</div>
                          <div className="font-medium">
                            {seasonDetail.draftPhase.draftPosition
                              ? `Pick ${seasonDetail.draftPhase.draftPosition}`
                              : "Not assigned"}
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
                            {seasonDetail.draftPhase.currentPickNumber
                              ? `Pick ${seasonDetail.draftPhase.currentPickNumber}`
                              : "Not started"}
                          </div>
                        </div>
                      </div>

                      {seasonDetail.draftPhase.isOnClock ? (
                        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                          You are currently on the clock.
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Drafted Team</div>
                        {seasonDetail.draftPhase.draftedTeam ? (
                          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                            <NFLTeamLabel size="detail" team={seasonDetail.draftPhase.draftedTeam} />
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                            No drafted team has been recorded for your account yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div className="text-sm font-medium">Season Ledger Entries</div>
                    {seasonDetail.ledger.entries.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        No ledger entries are recorded for your account in this season yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {seasonDetail.ledger.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-lg border border-border bg-background px-4 py-3 text-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{entry.description}</div>
                                <div className="text-muted-foreground">{entry.category}</div>
                              </div>
                              <div
                                className={cn(
                                  "font-medium",
                                  entry.amount >= 0 ? "text-emerald-700" : "text-rose-700"
                                )}
                              >
                                {formatCurrency(entry.amount)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>Owner History</CardTitle>
                <CardDescription>Your recorded teams, placements, and season totals across league history.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboard.history.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Your account does not have any recorded ownership history yet.
                  </div>
                ) : (
                  dashboard.history.map((entry) => (
                    <Card key={entry.seasonId} className="brand-muted-panel shadow-none">
                      <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg">
                              {entry.leagueName} | {seasonLabel(entry.seasonName, entry.seasonYear)}
                            </CardTitle>
                            <CardDescription>
                              {entry.finalPlacement
                                ? `${ordinal(entry.finalPlacement)} place${entry.isChampion ? " | Champion" : ""}`
                                : "Final placement not recorded."}
                            </CardDescription>
                          </div>
                          <Link
                            className={buttonVariants({ variant: "outline" })}
                            href={`/owner?seasonId=${entry.seasonId}`}
                          >
                            View Season
                          </Link>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm text-muted-foreground">
                          Season ledger total: <span className="font-medium text-foreground">{formatCurrency(entry.ledgerTotal)}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {entry.teams.map((teamEntry) => (
                            <div
                              key={`${entry.seasonId}-${teamEntry.team.id}`}
                              className="rounded-lg border border-border bg-background px-4 py-3 text-sm"
                            >
                              <div className="font-medium">
                                <NFLTeamLabel size="detail" team={teamEntry.team} />
                              </div>
                              <div className="text-muted-foreground">
                                Slot {teamEntry.slot} | {teamEntry.acquisitionType}
                                {teamEntry.draftPickNumber ? ` | Pick ${teamEntry.draftPickNumber}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>Financial View</CardTitle>
                <CardDescription>Your season-by-season ledger totals and cumulative earnings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Current Season Total</div>
                    <div className="font-medium">{formatCurrency(dashboard.financialSummary.currentSeasonTotal)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                    <div className="text-muted-foreground">Cumulative Earnings</div>
                    <div className="font-medium">{formatCurrency(dashboard.financialSummary.cumulativeEarnings)}</div>
                  </div>
                </div>

                {dashboard.financialSummary.seasons.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    No season ledger history is recorded for your account yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.financialSummary.seasons.map((entry) => (
                      <div key={entry.seasonId} className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              {entry.leagueName} | {seasonLabel(entry.seasonName, entry.seasonYear)}
                            </div>
                            <div className="text-muted-foreground">
                              {entry.entryCount} entries | +{formatCurrency(entry.totalPositive)} /{" "}
                              {formatCurrency(entry.totalNegative)}
                            </div>
                          </div>
                          <div className="font-medium">{formatCurrency(entry.ledgerTotal)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>League Membership</CardTitle>
                <CardDescription>Your memberships and roles across the leagues you belong to.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.memberships.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    You are not a member of any leagues yet.
                  </div>
                ) : (
                  dashboard.memberships.map((membership) => (
                    <div
                      key={`${membership.leagueId}-${membership.role}`}
                      className="rounded-lg border border-border bg-background px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{membership.leagueName}</div>
                          <div className="text-sm text-muted-foreground">
                            League Code: {membership.leagueCode ?? membership.leagueId}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium",
                            membership.role === "COMMISSIONER"
                              ? "bg-accent text-foreground"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {membership.role}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
