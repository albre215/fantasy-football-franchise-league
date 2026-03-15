"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeagueDashboardResponse, LeagueListItem, ListLeaguesResponse } from "@/types/league";

interface LeagueDashboardProps {
  leagueId?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function LeagueDashboard({ leagueId }: LeagueDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [league, setLeague] = useState<LeagueDashboardResponse["league"] | null>(null);
  const [leagueOptions, setLeagueOptions] = useState<LeagueListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);

    void (async () => {
      try {
        const listResponse = await fetch("/api/league/list", {
          cache: "no-store"
        });
        const listData = await parseJsonResponse<ListLeaguesResponse>(listResponse);

        if (isActive) {
          setLeagueOptions(listData.leagues);
        }

        if (!leagueId) {
          if (isActive) {
            setLeague(null);
            setErrorMessage(null);
          }

          return;
        }

        const dashboardResponse = await fetch(`/api/league/${leagueId}`, {
          cache: "no-store"
        });
        const dashboardData = await parseJsonResponse<LeagueDashboardResponse>(dashboardResponse);

        if (isActive) {
          setLeague(dashboardData.league);
          setErrorMessage(null);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load league.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [leagueId]);

  if (!leagueId) {
    return (
      <main className="container py-12">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">League Dashboard</h1>
          <p className="text-muted-foreground">Select a league to load its current members and season history.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {leagueOptions.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No leagues available</CardTitle>
                <CardDescription>Create a league from the home page to populate this dashboard.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            leagueOptions.map((option) => (
              <Card key={option.id}>
                <CardHeader>
                  <CardTitle>{option.name}</CardTitle>
                  <CardDescription>{option.description ?? "No description provided yet."}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link className={buttonVariants()} href={`/league?leagueId=${option.id}`}>
                    Open League
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="container py-12">
      <div className="max-w-4xl space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">League Dashboard</h1>
            <p className="text-muted-foreground">
              Membership and season state loaded from the new league domain layer.
            </p>
          </div>
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            Back to Home
          </Link>
        </div>
        {errorMessage && (
          <Card className="bg-red-50">
            <CardContent className="p-4 text-sm">{errorMessage}</CardContent>
          </Card>
        )}
        {!league && !errorMessage && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {isLoading ? "Loading league dashboard..." : "League not found."}
            </CardContent>
          </Card>
        )}
        {league && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{league.name}</CardTitle>
                <CardDescription>{league.description ?? "No description provided yet."}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                <p>League ID: {league.id}</p>
                <p>Slug: {league.slug}</p>
                <p>Created: {new Date(league.createdAt).toLocaleDateString()}</p>
              </CardContent>
            </Card>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Members</CardTitle>
                  <CardDescription>Commissioner and owner records for this league.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {league.members.map((member) => (
                    <div
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                      key={member.id}
                    >
                      <div>
                        <p className="font-medium text-foreground">{member.user.displayName}</p>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium text-foreground">{member.role}</p>
                        <p className="text-muted-foreground">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Seasons</CardTitle>
                  <CardDescription>Configured seasons attached to this league.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {league.seasons.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No seasons have been created yet.
                    </div>
                  ) : (
                    league.seasons.map((season) => (
                      <div className="rounded-lg border border-border p-4" key={season.id}>
                        <p className="font-medium text-foreground">{season.name ?? `${season.year} Season`}</p>
                        <p className="text-sm text-muted-foreground">{season.year} - {season.status}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
