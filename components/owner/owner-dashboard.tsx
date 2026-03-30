import Link from "next/link";

import { BrandMasthead } from "@/components/brand/brand-masthead";
import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OwnerDashboardSummary } from "@/types/owner";

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

export function OwnerDashboard({ dashboard }: { dashboard: OwnerDashboardSummary }) {
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
          description="Review your current teams, historical portfolio, offseason draft context, and league memberships."
          eyebrow="Owner Dashboard"
          title={`Welcome back, ${dashboard.user.displayName}`}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="space-y-6">
            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>Current Season</CardTitle>
                <CardDescription>
                  Your active-season NFL franchises, grouped by league so active-season context stays explicit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboard.currentTeams.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    None of your leagues has an active season with teams assigned to your account yet.
                  </div>
                ) : (
                  dashboard.currentTeams.map((entry) => (
                    <Card key={entry.season.seasonId} className="brand-muted-panel shadow-none">
                      <CardHeader>
                        <CardTitle className="text-xl">{entry.leagueName}</CardTitle>
                        <CardDescription>
                          {seasonLabel(entry.season.name, entry.season.year)} | {entry.season.status}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {entry.teams.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                            You belong to this league, but no teams are assigned to your account for the active season yet.
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {entry.teams.map((team) => (
                              <div
                                key={team.id}
                                className="rounded-lg border border-border bg-background px-4 py-3 text-sm"
                              >
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
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>Your season-by-season franchise portfolio, sorted newest to oldest.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboard.history.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Your account does not have any recorded season ownership history yet.
                  </div>
                ) : (
                  dashboard.history.map((entry) => (
                    <Card key={entry.seasonId} className="brand-muted-panel shadow-none">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {entry.leagueName} | {seasonLabel(entry.seasonName, entry.seasonYear)}
                        </CardTitle>
                        <CardDescription>
                          {entry.finalPlacement
                            ? `${ordinal(entry.finalPlacement)} place${entry.isChampion ? " | Champion" : ""}`
                            : "Final placement has not been recorded for this season."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {entry.teams.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                            No teams were recorded for your account in this season.
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {entry.teams.map((team) => (
                              <div
                                key={`${entry.seasonId}-${team.id}`}
                                className="rounded-lg border border-border bg-background px-4 py-3 text-sm"
                              >
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
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>Offseason Context</CardTitle>
                <CardDescription>
                  Your keeper and draft context for any active offseason workflows in your leagues.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboard.offseasonContext.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Your leagues do not have an offseason draft context for your account right now.
                  </div>
                ) : (
                  dashboard.offseasonContext.map((entry) => (
                    <Card key={entry.targetSeasonId} className="brand-muted-panel shadow-none">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {entry.leagueName} | {seasonLabel(entry.targetSeasonName, entry.targetSeasonYear)}
                        </CardTitle>
                        <CardDescription>
                          Source season: {seasonLabel(entry.sourceSeasonName, entry.sourceSeasonYear)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-border bg-background px-4 py-3">
                            <div className="text-muted-foreground">Draft Status</div>
                            <div className="font-medium">{entry.draftStatus}</div>
                          </div>
                          <div className="rounded-lg border border-border bg-background px-4 py-3">
                            <div className="text-muted-foreground">Draft Position</div>
                            <div className="font-medium">
                              {entry.draftPosition ? `Pick ${entry.draftPosition}` : "Draft slot is not assigned yet."}
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-background px-4 py-3">
                            <div className="text-muted-foreground">Keeper Progress</div>
                            <div className="font-medium">
                              {entry.keeperCount} / {entry.keeperEligibleCount} saved
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-background px-4 py-3">
                            <div className="text-muted-foreground">Current Pick</div>
                            <div className="font-medium">
                              {entry.currentPickNumber ? `Pick ${entry.currentPickNumber}` : "The draft has not started."}
                            </div>
                          </div>
                        </div>

                        {entry.isOnClock ? (
                          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
                            You are currently on the clock for this offseason draft.
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Previous Season Teams</div>
                          {entry.previousSeasonTeams.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border p-3 text-muted-foreground">
                              No previous-season teams were found for your account in this draft context.
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {entry.previousSeasonTeams.map((team) => (
                                <span
                                  key={`${entry.targetSeasonId}-previous-${team.id}`}
                                  className="rounded-full border border-border bg-background px-3 py-1 text-sm"
                                >
                                  <NFLTeamLabel size="compact" team={team} />
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Saved Keepers</div>
                          {entry.keepers.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border p-3 text-muted-foreground">
                              No keepers are saved for your account yet.
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {entry.keepers.map((team) => (
                                <span
                                  key={`${entry.targetSeasonId}-keeper-${team.id}`}
                                  className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-900"
                                >
                                  <NFLTeamLabel size="compact" team={team} />
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Drafted Team</div>
                          {entry.draftedTeam ? (
                            <div className="rounded-lg border border-border bg-background px-4 py-3">
                              <NFLTeamLabel size="detail" team={entry.draftedTeam} />
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-border p-3 text-muted-foreground">
                              No drafted team has been recorded for your account yet.
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>League Membership</CardTitle>
                <CardDescription>Your memberships and roles across all leagues in the system.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.leagues.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    You are not a member of any leagues yet. Join a league or create one from the home page.
                  </div>
                ) : (
                  dashboard.leagues.map((membership) => (
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
